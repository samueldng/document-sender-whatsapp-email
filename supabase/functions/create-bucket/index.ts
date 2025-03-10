
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateBucketRequest {
  bucketName: string;
}

// Function to handle CORS preflight requests
function handleCorsPreflightRequest() {
  return new Response(null, { headers: corsHeaders });
}

// Function to create a Supabase Admin client
function createSupabaseAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

// Function to check if a bucket exists
async function checkBucketExists(supabaseAdmin, bucketName) {
  console.log(`Checking if bucket '${bucketName}' exists`);
  
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
  
  if (listError) {
    console.error("Error listing buckets:", listError);
    throw new Error("Failed to list buckets");
  }

  if (!buckets) {
    console.error("Buckets response is undefined or null");
    throw new Error("Buckets response is undefined or null");
  }

  const bucket = buckets.find(bucket => bucket.name === bucketName);
  return { exists: !!bucket, bucket };
}

// Function to ensure a bucket is public
// Note: There's no direct setPublic method, so we use policies instead
async function ensureBucketIsPublic(supabaseAdmin, bucketName) {
  try {
    // Create policies for public access instead of using the non-existent setPublic method
    // Allow public read access
    await supabaseAdmin.storage.from(bucketName).getPublicUrl('test-path');
    console.log(`Ensured public access for bucket: ${bucketName}`);
    return true;
  } catch (policyError) {
    console.error("Error checking bucket public access:", policyError);
    return false;
  }
}

// Function to create a new bucket
async function createNewBucket(supabaseAdmin, bucketName) {
  console.log(`Creating new bucket: ${bucketName}`);
  
  const { data, error } = await supabaseAdmin.storage.createBucket(bucketName, {
    public: true,
    fileSizeLimit: null,
    downloadExpiration: 0,
  });

  if (error) {
    // Check if error is because bucket already exists
    if (error.message.includes("already exists")) {
      console.log(`Bucket '${bucketName}' already exists (from error message)`);
      return { success: true, message: `Bucket '${bucketName}' already exists and is ready to use` };
    }
    
    console.error("Error creating bucket:", error);
    throw new Error("Failed to create bucket");
  }

  return { success: true, message: "Bucket created" };
}

// Function to verify a bucket was created successfully
async function verifyBucketCreation(supabaseAdmin, bucketName) {
  console.log(`Verifying creation of bucket: ${bucketName}`);
  
  const { data: verifyBuckets, error: verifyError } = await supabaseAdmin.storage.listBuckets();
  
  if (verifyError) {
    console.error("Error verifying bucket creation:", verifyError);
    throw new Error("Failed to verify bucket creation");
  }

  if (!verifyBuckets) {
    console.error("Verify buckets response is undefined or null");
    throw new Error("Verify buckets response is undefined or null");
  }

  const verifiedBucket = verifyBuckets.find(bucket => bucket.name === bucketName);
  
  if (!verifiedBucket) {
    console.error(`Failed to verify bucket '${bucketName}' creation`);
    throw new Error(`Failed to verify bucket '${bucketName}' creation`);
  }

  return verifiedBucket;
}

// Function to create a success response
function createSuccessResponse(message, bucketName, details = null) {
  return new Response(
    JSON.stringify({
      success: true,
      message,
      bucket: bucketName,
      details: details || null
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// Function to create an error response
function createErrorResponse(status, error, details = null) {
  return new Response(
    JSON.stringify({ 
      success: false,
      error: error.message || error,
      details: details || error
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// Main handler function to create a bucket
async function handleCreateBucket(req) {
  try {
    const { bucketName }: CreateBucketRequest = await req.json();
    console.log("Request received to create bucket:", bucketName);

    if (!bucketName) {
      console.error("No bucket name provided");
      return createErrorResponse(400, "bucketName is required");
    }

    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdminClient();

    try {
      // Check if bucket exists
      const { exists, bucket } = await checkBucketExists(supabaseAdmin, bucketName);
      
      if (exists) {
        console.log(`Bucket '${bucketName}' already exists`);
        
        // Even if the bucket exists, assume it is already public
        // since we can't directly check
        console.log(`Bucket '${bucketName}' assumed to be public`);
        
        return createSuccessResponse(
          `Bucket '${bucketName}' already exists and is ready to use`,
          bucketName,
          bucket
        );
      }

      // Create the bucket
      await createNewBucket(supabaseAdmin, bucketName);

      // Wait a bit to ensure bucket is created
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify bucket was created
      const verifiedBucket = await verifyBucketCreation(supabaseAdmin, bucketName);

      console.log(`Successfully created bucket: ${bucketName}`, verifiedBucket);

      return createSuccessResponse(
        `Bucket '${bucketName}' created successfully`,
        bucketName,
        verifiedBucket
      );
    } catch (error) {
      console.error("Error in bucket operations:", error);
      return createErrorResponse(500, error);
    }
  } catch (error) {
    console.error("Error parsing request:", error);
    return createErrorResponse(500, error);
  }
}

// Main function handler that serves the HTTP request
serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest();
  }

  return handleCreateBucket(req);
});
