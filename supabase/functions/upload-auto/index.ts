
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle OPTIONS requests for CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log("Receiving upload request")
    
    // Extract FormData from request
    const formData = await req.formData()
    const file = formData.get('file')
    const clientId = formData.get('clientId')
    const documentType = formData.get('documentType') || 'other'
    const originalFilename = formData.get('originalFilename')

    if (!file) {
      console.error("No file received in request")
      return new Response(
        JSON.stringify({ error: 'No file sent' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Use original filename if provided, otherwise use the file's name
    const fileName = originalFilename || file.name;
    console.log(`Processing file: ${fileName}, type: ${file.type}, size: ${file.size} bytes`)
    
    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // First, directly create the bucket with public access from this function
    try {
      console.log("Attempting to create 'documents' bucket directly if it doesn't exist");
      const { error: createBucketError } = await supabase.storage.createBucket('documents', {
        public: true, // Explicitly set as public
        fileSizeLimit: null,
        downloadExpiration: 0
      });
      
      if (createBucketError && !createBucketError.message.includes('already exists')) {
        console.error("Error creating bucket directly:", createBucketError);
        // Continue anyway, as we'll try the create-bucket function next
      } else {
        console.log("Documents bucket created successfully or already exists");
      }
    } catch (directCreateError) {
      console.error("Error in direct bucket creation attempt:", directCreateError);
      // Continue to next approach
    }

    // As a backup, also try using the create-bucket function
    try {
      console.log("Also ensuring documents bucket exists via edge function");
      const { data: bucketResult, error: bucketError } = await supabase.functions.invoke('create-bucket', {
        body: { bucketName: 'documents', create: true }
      });
      
      if (bucketError) {
        console.error("Error invoking create-bucket function:", bucketError);
      } else {
        console.log("Bucket check result from edge function:", bucketResult);
      }
    } catch (bucketCheckError) {
      console.error("Error checking/creating bucket via edge function:", bucketCheckError);
    }

    // Create public policies directly as a fallback
    try {
      console.log("Attempting to create public policies for documents bucket");
      await supabase.rpc('create_storage_policy', {
        name: 'allow-public-select-documents',
        bucket: 'documents',
        definition: {
          name: 'allow-public-select-documents',
          action: 'SELECT',
          role: 'anon',
          bucket: 'documents',
          condition: 'TRUE'
        }
      }).catch(e => console.log("Policy may already exist:", e.message));
    } catch (policyError) {
      console.error("Error creating policies:", policyError);
    }

    // Verify bucket exists with a test upload
    try {
      console.log("Verifying bucket with test upload");
      const testBlob = new Blob(['test'], { type: 'text/plain' });
      const testPath = `test-${Date.now()}.txt`;
      
      const { data: testUpload, error: testError } = await supabase.storage
        .from('documents')
        .upload(testPath, testBlob, { upsert: true });
        
      if (testError) {
        console.error("Test upload failed:", testError);
        throw new Error(`Bucket verification failed: ${testError.message}`);
      }
      
      console.log("Test upload successful:", testUpload);
      
      // Clean up test file
      await supabase.storage.from('documents').remove([testPath]);
    } catch (verifyError) {
      console.error("Error verifying bucket:", verifyError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify bucket access', details: verifyError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Sanitize filename to avoid problematic characters
    const sanitizedFileName = fileName.replace(/[^\x00-\x7F]/g, '_')
    const fileExt = sanitizedFileName.split('.').pop()
    
    // Create a unique path for the file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filePath = `${clientId ? `client_${clientId}/` : ''}${documentType}/${timestamp}_${sanitizedFileName}`

    console.log(`File path for upload: ${filePath}`)

    // Upload file to 'documents' bucket
    const { data, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true
      })

    if (uploadError) {
      console.error(`Upload error: ${JSON.stringify(uploadError)}`)
      return new Response(
        JSON.stringify({ error: 'Failed to upload file', details: uploadError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log("Upload to storage completed successfully")

    // Get public URL for the file - try multiple methods
    let publicUrl = null;
    
    try {
      // First method - use getPublicUrl
      const { data: urlData, error: urlError } = await supabase.storage
        .from('documents')
        .getPublicUrl(filePath);
        
      if (urlError) {
        console.error('Error getting public URL (method 1):', urlError);
      } else if (urlData && urlData.publicUrl) {
        console.log("Got public URL (method 1):", urlData.publicUrl);
        publicUrl = urlData.publicUrl;
      }
      
      // If first method failed, try creating a signed URL as fallback
      if (!publicUrl) {
        console.log("Attempting to create signed URL as fallback");
        const { data: signedData, error: signedError } = await supabase.storage
          .from('documents')
          .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year expiry
          
        if (signedError) {
          console.error('Error creating signed URL:', signedError);
        } else if (signedData && signedData.signedUrl) {
          console.log("Got signed URL:", signedData.signedUrl);
          publicUrl = signedData.signedUrl;
        }
      }
    } catch (urlGenerationError) {
      console.error('Error generating URL:', urlGenerationError);
    }

    if (!publicUrl) {
      // Construct URL directly as last resort
      publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/documents/${filePath}`;
      console.log("Constructed fallback URL:", publicUrl);
    }

    // Record the document in the database
    try {
      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          client_id: clientId || null,
          filename: sanitizedFileName,
          file_path: filePath,
          document_type: documentType,
          url: publicUrl,
          created_at: new Date().toISOString()
        })

      if (dbError) {
        console.error(`Error saving metadata: ${JSON.stringify(dbError)}`)
        // Don't interrupt the flow, just log the error
      } else {
        console.log("Metadata saved to database successfully")
      }
    } catch (dbException) {
      console.error(`Exception while saving metadata: ${dbException.message}`)
      // Don't interrupt the flow, just log the error
    }

    return new Response(
      JSON.stringify({ 
        message: 'File uploaded successfully', 
        filePath,
        originalFilename: sanitizedFileName,
        publicUrl 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error(`Unhandled error: ${error.message}`)
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
