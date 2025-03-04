
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

    // Check if the documents bucket exists
    console.log("Checking if documents bucket exists");
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error("Error listing buckets:", bucketsError);
      return new Response(
        JSON.stringify({ error: 'Failed to check bucket existence', details: bucketsError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }
    
    const bucketExists = buckets?.some(bucket => bucket.name === 'documents');
    
    if (!bucketExists) {
      console.log("Documents bucket doesn't exist, creating it");
      
      const { data: createData, error: createError } = await supabase.storage.createBucket(
        'documents',
        { public: true }
      );
      
      if (createError) {
        console.error("Error creating documents bucket:", createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create documents bucket', details: createError }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }
      
      console.log("Documents bucket created successfully");
    } else {
      console.log("Documents bucket already exists");
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
