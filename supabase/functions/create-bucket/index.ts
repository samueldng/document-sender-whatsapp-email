
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
    // First try direct createBucket with catch for 'already exists' error
    // This is more reliable than listBuckets which sometimes returns empty arrays
    try {
      const { error } = await supabaseAdmin.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: null,
        downloadExpiration: 0
      });
      
      if (error) {
        if (error.message.includes("already exists")) {
          console.log(`Bucket '${bucketName}' already exists based on creation attempt`);
          return { exists: true };
        }
        console.error("Error in bucket creation check:", error);
      } else {
        console.log(`Bucket '${bucketName}' was just created`);
        return { exists: true, wasJustCreated: true };
      }
    } catch (creationError) {
      console.error("Error in creation check:", creationError);
    }
    
    // Fallback to listBuckets method
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
    // Create the bucket with public access explicitly set to true
    const { data, error } = await supabaseAdmin.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: null,
      downloadExpiration: 0,
    });

    if (error) {
      // Check if error is because bucket already exists
      if (error.message.includes("already exists")) {
        console.log(`Bucket '${bucketName}' already exists (from error message)`);
        
        // Attempt to update bucket policies to ensure public access
        try {
          // Create policies for public access
          await createPublicPoliciesForBucket(supabaseAdmin, bucketName);
          
          return { success: true, message: `Bucket '${bucketName}' already exists and public policies have been set` };
        } catch (policyError) {
          console.warn("Warning: Could not ensure public access for existing bucket:", policyError);
          return { success: true, message: `Bucket '${bucketName}' already exists but could not ensure public access` };
        }
      }
      
      console.error("Error creating bucket:", error);
      throw new Error(`Failed to create bucket: ${error.message}`);
    }

    // Create policies for public access
    await createPublicPoliciesForBucket(supabaseAdmin, bucketName);

    return { success: true, message: "Bucket created successfully" };
  } catch (error) {
    console.error("Error in createNewBucket:", error);
    return { success: false, error: error.message };
  }
}

// Function to create public policies for a bucket
async function createPublicPoliciesForBucket(supabaseAdmin, bucketName) {
  console.log(`Setting bucket '${bucketName}' as public through policies`);
  
  try {
    // Create a policy for public read access
    const policyName = `allow-public-read-${bucketName}`;
    
    // Using RPC to create a policy
    await supabaseAdmin.rpc('create_storage_policy', {
      name: policyName,
      bucket: bucketName,
      definition: {
        name: policyName,
        action: 'SELECT',
        role: 'anon',
        bucket: bucketName,
        condition: 'TRUE'
      }
    }).catch(e => {
      // Policy might already exist, which is fine
      console.log("Policy creation note:", e.message);
    });
    
    // Also try direct API approach as fallback
    try {
      await supabaseAdmin.storage.from(bucketName).getPublicUrl('dummy-test-path');
    } catch (dummyError) {
      console.log("Public URL test resulted in:", dummyError.message);
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error creating public policies:", error);
    return { success: false, error: error.message };
  }
}

// Function to verify a bucket is accessible
async function verifyBucketAccess(supabaseAdmin, bucketName) {
  console.log(`Verifying access to bucket: ${bucketName}`);
  
  try {
    // Try to upload a small test file to verify we have full access
    const testContent = new Blob(['test'], { type: 'text/plain' });
    const testPath = `test-${Date.now()}.txt`;
    
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(testPath, testContent, { upsert: true });
    
    if (uploadError) {
      console.error("Error in test upload:", uploadError);
      return { accessible: false, error: uploadError.message };
    }
    
    console.log("Test upload successful:", uploadData);
    
    // Try to get a public URL for the test file
    const { data: urlData, error: urlError } = await supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(testPath);
    
    if (urlError) {
      console.error("Error getting public URL:", urlError);
      // Still accessible for upload, but URL generation failed
      return { accessible: true, publicUrlWorking: false, error: urlError.message };
    }
    
    console.log("Public URL obtained:", urlData);
    
    // Clean up test file
    await supabaseAdmin.storage.from(bucketName).remove([testPath]);
    
    return { 
      accessible: true, 
      publicUrlWorking: !!urlData?.publicUrl,
      publicUrl: urlData?.publicUrl
    };
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
      const { exists, bucket, wasJustCreated, error } = await checkBucketExists(supabaseAdmin, bucketName);
      
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
        
        // Create policies to ensure the bucket is public
        await createPublicPoliciesForBucket(supabaseAdmin, bucketName);
        
        // Verify we can access the bucket and get public URLs
        const accessCheck = await verifyBucketAccess(supabaseAdmin, bucketName);
        
        // If we can't access the bucket or get public URLs, try to fix it
        if (!accessCheck.accessible || !accessCheck.publicUrlWorking) {
          console.log("Bucket exists but has issues - attempting to fix");
          
          try {
            // Try to update bucket to be public directly 
            const { error: updateError } = await supabaseAdmin.storage.updateBucket(bucketName, {
              public: true
            });
            
            if (updateError) {
              console.error("Error updating bucket:", updateError);
            } else {
              console.log("Bucket updated to public successfully");
            }
          } catch (updateError) {
            console.error("Error trying to update bucket:", updateError);
          }
          
          // Try again to verify access after fix attempts
          const retryAccessCheck = await verifyBucketAccess(supabaseAdmin, bucketName);
          
          return createSuccessResponse({
            success: true,
            message: `Bucket '${bucketName}' exists, attempted to fix access issues`,
            bucket: bucketName,
            accessible: retryAccessCheck.accessible,
            publicUrlWorking: retryAccessCheck.publicUrlWorking
          });
        }
        
        return createSuccessResponse({
          success: true,
          message: `Bucket '${bucketName}' already exists and is ready to use`,
          bucket: bucketName,
          details: bucket,
          accessible: accessCheck.accessible,
          publicUrlWorking: accessCheck.publicUrlWorking
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

      // Create the bucket with public access
      const createResult = await createNewBucket(supabaseAdmin, bucketName);
      
      if (!createResult.success) {
        console.error("Error creating bucket:", createResult.error);
        return createErrorResponse(500, createResult.error || "Failed to create bucket");
      }

      // Wait a bit to ensure bucket is created
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify we can access the bucket and get public URLs
      const accessCheck = await verifyBucketAccess(supabaseAdmin, bucketName);
      
      // Final check of bucket existence
      const finalCheck = await checkBucketExists(supabaseAdmin, bucketName);

      return createSuccessResponse({
        success: true,
        message: `Bucket '${bucketName}' created successfully`,
        bucket: bucketName,
        details: finalCheck.bucket,
        accessible: accessCheck.accessible,
        publicUrlWorking: accessCheck.publicUrlWorking
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
