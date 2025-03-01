
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Tratar solicitações OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Extrair o FormData da solicitação
    const formData = await req.formData()
    const file = formData.get('file')
    const clientId = formData.get('clientId')
    const documentType = formData.get('documentType') || 'other'

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'Nenhum arquivo enviado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Criar cliente Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Sanitizar o nome do arquivo para evitar caracteres problemáticos
    const fileName = file.name.replace(/[^\x00-\x7F]/g, '_')
    const fileExt = fileName.split('.').pop()
    
    // Criar um caminho único para o arquivo
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filePath = `${clientId ? `client_${clientId}/` : ''}${documentType}/${timestamp}_${fileName}`

    // Fazer upload do arquivo para o bucket 'documents'
    const { data, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: 'Falha ao fazer upload do arquivo', details: uploadError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Obter a URL pública do arquivo
    const { data: publicUrlData } = await supabase.storage
      .from('documents')
      .getPublicUrl(filePath)

    // Registrar o documento no banco de dados (se a tabela documents existir)
    try {
      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          client_id: clientId,
          filename: fileName,
          file_path: filePath,
          document_type: documentType,
          url: publicUrlData.publicUrl,
          created_at: new Date()
        })

      if (dbError) {
        console.error('Erro ao salvar metadados do documento:', dbError)
      }
    } catch (error) {
      console.error('Erro ao acessar a tabela de documentos:', error)
      // Continua mesmo se não conseguir salvar na tabela (pode não existir ainda)
    }

    return new Response(
      JSON.stringify({ 
        message: 'Arquivo enviado com sucesso', 
        filePath,
        publicUrl: publicUrlData.publicUrl 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Ocorreu um erro inesperado', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
