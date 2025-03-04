
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

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bucketName }: CreateBucketRequest = await req.json();
    console.log("Request received to create bucket:", bucketName);

    if (!bucketName) {
      console.error("No bucket name provided");
      return new Response(
        JSON.stringify({ error: "bucketName is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // First check if bucket exists
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    
    if (listError) {
      console.error("Error listing buckets:", listError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Failed to list buckets",
          details: listError
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (bucketExists) {
      console.log(`Bucket '${bucketName}' already exists`);
      return new Response(
        JSON.stringify({ 
          success: true,
          message: `Bucket '${bucketName}' already exists and is ready to use`,
          bucket: bucketName 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Creating new bucket: ${bucketName}`);
    
    // Create bucket with public access
    const { data, error } = await supabaseAdmin.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: null,
      downloadExpiration: 0,
    });

    if (error) {
      console.error("Error creating bucket:", error);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Failed to create bucket",
          details: error
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Wait a bit to ensure bucket is created
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify bucket was created
    const { data: verifyBuckets, error: verifyError } = await supabaseAdmin.storage.listBuckets();
    
    if (verifyError) {
      console.error("Error verifying bucket creation:", verifyError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Failed to verify bucket creation",
          details: verifyError
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const bucketCreated = verifyBuckets?.some(bucket => bucket.name === bucketName);
    
    if (!bucketCreated) {
      console.error(`Failed to verify bucket '${bucketName}' creation`);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Failed to verify bucket '${bucketName}' creation`
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Successfully created bucket: ${bucketName}`);

    // Create public access policies
    try {
      // Allow read access to all files
      await supabaseAdmin.storage.from(bucketName).setPublic(true);
      console.log(`Set public access for bucket: ${bucketName}`);
    } catch (policyError) {
      console.error("Error setting bucket policy:", policyError);
      // Continue despite policy error, bucket is still created
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Bucket '${bucketName}' created successfully`,
        bucket: bucketName
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in create-bucket function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || "An unexpected error occurred",
        details: error
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
