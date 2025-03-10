
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateBucketRequest {
  bucketName: string;
  checkOnly?: boolean;
  create?: boolean;
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
  
  try {
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
  } catch (error) {
    console.error("Error checking bucket existence:", error);
    return { exists: false, error: error.message };
  }
}

// Function to create a new bucket with public access
async function createNewBucket(supabaseAdmin, bucketName) {
  console.log(`Creating new bucket: ${bucketName}`);
  
  try {
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
      throw new Error(`Failed to create bucket: ${error.message}`);
    }

    return { success: true, message: "Bucket created successfully" };
  } catch (error) {
    console.error("Error in createNewBucket:", error);
    return { success: false, error: error.message };
  }
}

// Function to verify a bucket is accessible
async function verifyBucketAccess(supabaseAdmin, bucketName) {
  console.log(`Verifying access to bucket: ${bucketName}`);
  
  try {
    // Try to list files in the bucket (this will verify we have access)
    const { data, error } = await supabaseAdmin.storage.from(bucketName).list();
    
    if (error) {
      console.error("Error accessing bucket:", error);
      return { accessible: false, error: error.message };
    }
    
    return { accessible: true, fileCount: data?.length || 0 };
  } catch (error) {
    console.error("Error verifying bucket access:", error);
    return { accessible: false, error: error.message };
  }
}

// Function to create a success response
function createSuccessResponse(data) {
  return new Response(
    JSON.stringify(data),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// Function to create an error response
function createErrorResponse(status, error) {
  return new Response(
    JSON.stringify({ 
      success: false,
      error: error.message || error
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
    const { bucketName, checkOnly, create }: CreateBucketRequest = await req.json();
    console.log("Request received:", { bucketName, checkOnly, create });

    if (!bucketName) {
      console.error("No bucket name provided");
      return createErrorResponse(400, "bucketName is required");
    }

    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdminClient();

    try {
      // Check if bucket exists
      const { exists, bucket, error } = await checkBucketExists(supabaseAdmin, bucketName);
      
      // If we're just checking, return the result
      if (checkOnly === true) {
        console.log(`Check only mode: bucket ${bucketName} ${exists ? 'exists' : 'does not exist'}`);
        return createSuccessResponse({ 
          success: true, 
          exists, 
          bucket: bucket || null 
        });
      }
      
      if (exists) {
        console.log(`Bucket '${bucketName}' already exists`);
        
        // Verify we can access the bucket
        const { accessible } = await verifyBucketAccess(supabaseAdmin, bucketName);
        
        return createSuccessResponse({
          success: true,
          message: `Bucket '${bucketName}' already exists and is ready to use`,
          bucket: bucketName,
          details: bucket,
          accessible
        });
      }

      // If create is explicitly false, don't create the bucket
      if (create === false) {
        console.log(`Create is false: not creating bucket ${bucketName}`);
        return createSuccessResponse({
          success: false,
          message: `Bucket '${bucketName}' does not exist`,
          exists: false
        });
      }

      // Create the bucket
      const createResult = await createNewBucket(supabaseAdmin, bucketName);
      
      if (!createResult.success) {
        console.error("Error creating bucket:", createResult.error);
        return createErrorResponse(500, createResult.error || "Failed to create bucket");
      }

      // Wait a bit to ensure bucket is created
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify we can access the bucket
      const { accessible, fileCount, error: accessError } = await verifyBucketAccess(supabaseAdmin, bucketName);
      
      // Final check of bucket existence
      const finalCheck = await checkBucketExists(supabaseAdmin, bucketName);

      return createSuccessResponse({
        success: true,
        message: `Bucket '${bucketName}' created successfully`,
        bucket: bucketName,
        details: finalCheck.bucket,
        accessible,
        fileCount,
        accessError: accessError || null
      });
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
