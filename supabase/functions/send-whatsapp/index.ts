
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { clientPhone, clientName, documentType, publicUrl } = await req.json()

    // Format phone number (remove any non-numeric characters)
    let formattedPhone = clientPhone.replace(/\D/g, '')
    
    // Add country code if not present (assuming Brazil)
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = `55${formattedPhone}`
    }
    
    console.log('Sending WhatsApp message to:', formattedPhone)
    
    const message = `Olá ${clientName}!\n\n` +
      `Aqui estão seus ${documentType === 'invoice' ? 'Notas Fiscais' : 'Documentos Fiscais'} conforme solicitado.\n\n` +
      `Você pode acessar seus documentos através do link abaixo:\n${publicUrl}\n\n` +
      `Se você tiver alguma dúvida, por favor nos contate.\n\n` +
      `Atenciosamente,\nSua Empresa`

    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_ID')
    if (!phoneNumberId) {
      throw new Error('WhatsApp Phone Number ID not configured')
    }
    
    console.log('Using WhatsApp Phone ID:', phoneNumberId)
    console.log('Using WhatsApp API with token:', Deno.env.get('WHATSAPP_TOKEN') ? 'Token present' : 'Token missing')
    
    const response = await fetch(
      `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
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

    const responseData = await response.json()
    console.log('WhatsApp API response:', responseData)

    if (!response.ok) {
      console.error('WhatsApp API error:', responseData)
      throw new Error(responseData.error?.message || 'Failed to send WhatsApp message')
    }

    return new Response(
      JSON.stringify({ message: 'WhatsApp message sent successfully', data: responseData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error sending WhatsApp message:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
