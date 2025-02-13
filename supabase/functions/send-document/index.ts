
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { Resend } from "npm:resend@2.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { clientEmail, clientName, documentType, filePath } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get file URL
    const { data: { publicUrl }, error: urlError } = await supabase.storage
      .from('documents')
      .getPublicUrl(filePath)

    if (urlError) {
      throw new Error('Failed to get file URL')
    }

    // Send email
    const emailResponse = await resend.emails.send({
      from: 'Documentos <onboarding@resend.dev>',
      to: clientEmail,
      subject: `Seus documentos - ${documentType === 'invoice' ? 'Notas Fiscais' : 'Documentos Fiscais'}`,
      html: `
        <h1>Olá ${clientName}!</h1>
        <p>Aqui estão seus documentos conforme solicitado.</p>
        <p>Você pode acessar seus documentos através do link abaixo:</p>
        <p><a href="${publicUrl}">Clique aqui para ver o documento</a></p>
        <p>Se você tiver alguma dúvida, por favor nos contate.</p>
        <br>
        <p>Atenciosamente,<br>Sua Empresa</p>
      `,
    })

    console.log('Email sent successfully:', emailResponse)

    return new Response(
      JSON.stringify({ message: 'Email sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error sending email:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
