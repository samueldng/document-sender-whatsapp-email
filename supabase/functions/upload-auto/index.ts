
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
    console.log("Recebendo solicitação de upload")
    
    // Extrair o FormData da solicitação
    const formData = await req.formData()
    const file = formData.get('file')
    const clientId = formData.get('clientId')
    const documentType = formData.get('documentType') || 'other'

    if (!file) {
      console.error("Nenhum arquivo recebido na solicitação")
      return new Response(
        JSON.stringify({ error: 'Nenhum arquivo enviado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log(`Processando arquivo: ${file.name}, tipo: ${file.type}, tamanho: ${file.size} bytes`)
    
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

    console.log(`Caminho do arquivo para upload: ${filePath}`)

    // Fazer upload do arquivo para o bucket 'documents'
    const { data, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true // Alterado para true para substituir arquivos existentes com mesmo nome
      })

    if (uploadError) {
      console.error(`Erro no upload: ${JSON.stringify(uploadError)}`)
      return new Response(
        JSON.stringify({ error: 'Falha ao fazer upload do arquivo', details: uploadError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log("Upload para storage concluído com sucesso")

    // Obter a URL pública do arquivo
    const { data: publicUrlData } = await supabase.storage
      .from('documents')
      .getPublicUrl(filePath)

    // Registrar o documento no banco de dados
    try {
      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          client_id: clientId || null,
          filename: fileName,
          file_path: filePath,
          document_type: documentType,
          url: publicUrlData.publicUrl,
          created_at: new Date().toISOString()
        })

      if (dbError) {
        console.error(`Erro ao salvar metadados: ${JSON.stringify(dbError)}`)
        // Não interrompe o fluxo, apenas loga o erro
      } else {
        console.log("Metadados salvos no banco de dados com sucesso")
      }
    } catch (dbException) {
      console.error(`Exceção ao salvar metadados: ${dbException.message}`)
      // Não interrompe o fluxo, apenas loga o erro
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
    console.error(`Erro não tratado: ${error.message}`)
    return new Response(
      JSON.stringify({ error: 'Ocorreu um erro inesperado', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
