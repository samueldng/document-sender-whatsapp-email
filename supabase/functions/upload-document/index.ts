
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const clientId = formData.get('clientId')
    const documentType = formData.get('documentType')

    if (!file || !clientId || !documentType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Ensure the documents bucket exists and is public
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

    // Sanitize filename and generate unique path
    const sanitizedFileName = (file as File).name.replace(/[^\x00-\x7F]/g, '')
    const fileExt = sanitizedFileName.split('.').pop()
    const filePath = `${clientId}/${crypto.randomUUID()}.${fileExt}`

    // Upload file to storage
    const { data: storageData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, {
        contentType: (file as File).type,
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return new Response(
        JSON.stringify({ error: 'Failed to upload file', details: uploadError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Get public URL for the file
    const { data: urlData, error: urlError } = await supabase.storage
      .from('documents')
      .getPublicUrl(filePath);
      
    if (urlError) {
      console.error('Error getting public URL:', urlError);
    }

    // Save document metadata to database
    const { error: dbError } = await supabase
      .from('documents')
      .insert({
        client_id: clientId,
        filename: sanitizedFileName,
        file_path: filePath,
        document_type: documentType,
        url: urlData?.publicUrl || null
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Failed to save document metadata', details: dbError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    return new Response(
      JSON.stringify({ 
        message: 'Document uploaded successfully', 
        filePath,
        publicUrl: urlData?.publicUrl || null 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
