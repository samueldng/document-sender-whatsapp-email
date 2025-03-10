
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

    // Use the create-bucket function to ensure the bucket exists and is public
    try {
      console.log("Ensuring documents bucket exists and is public");
      const { data: bucketResult, error: bucketError } = await supabase.functions.invoke('create-bucket', {
        body: { bucketName: 'documents', create: true }
      });
      
      if (bucketError) {
        console.error("Error invoking create-bucket function:", bucketError);
        throw new Error(`Failed to ensure bucket: ${bucketError.message}`);
      }
      
      if (!bucketResult?.success) {
        console.error("create-bucket function was unsuccessful:", bucketResult);
        throw new Error('Failed to ensure bucket: function returned unsuccessful result');
      }
      
      console.log("Bucket check result:", bucketResult);
    } catch (bucketCheckError) {
      console.error("Error checking/creating bucket:", bucketCheckError);
      // We'll try to continue with the upload anyway
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

    // Get the public URL for the file
    const { data: publicUrlData } = await supabase.storage
      .from('documents')
      .getPublicUrl(filePath)

    if (!publicUrlData || !publicUrlData.publicUrl) {
      console.error("Failed to get public URL for uploaded file");
      return new Response(
        JSON.stringify({ error: 'Failed to get public URL for uploaded file' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
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
          url: publicUrlData.publicUrl,
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
        publicUrl: publicUrlData.publicUrl 
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
