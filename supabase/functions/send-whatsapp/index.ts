
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { clientPhone, clientName, documentType, publicUrl } = await req.json()

    // Format phone number (remove any non-numeric characters and add country code if needed)
    const formattedPhone = clientPhone.replace(/\D/g, '')
    
    const message = `Olá ${clientName}!\n\n` +
      `Aqui estão seus ${documentType === 'invoice' ? 'Notas Fiscais' : 'Documentos Fiscais'} conforme solicitado.\n\n` +
      `Você pode acessar seus documentos através do link abaixo:\n${publicUrl}\n\n` +
      `Se você tiver alguma dúvida, por favor nos contate.\n\n` +
      `Atenciosamente,\nSua Empresa`

    const response = await fetch(
      `https://graph.facebook.com/v17.0/YOUR_PHONE_NUMBER_ID/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('WHATSAPP_TOKEN')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'text',
          text: {
            body: message
          }
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error('WhatsApp API error:', error)
      throw new Error('Failed to send WhatsApp message')
    }

    const result = await response.json()
    console.log('WhatsApp message sent successfully:', result)

    return new Response(
      JSON.stringify({ message: 'WhatsApp message sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error sending WhatsApp message:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
