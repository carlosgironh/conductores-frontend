import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleAuth } from 'npm:google-auth-library@8.8.0'
import { serviceAccount } from './serviceAccount.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { conductor_id, titulo, mensaje } = await req.json()

    if (!conductor_id) {
      throw new Error("Missing conductor_id")
    }

    // 1. Obtener FCM Token del conductor
    const { data: conductor, error: fetchError } = await supabase
      .from('conductores')
      .select('fcm_token')
      .eq('id', conductor_id)
      .single()

    if (fetchError) throw fetchError

    if (!conductor?.fcm_token) {
      console.log(`Conductor ${conductor_id} no tiene fcm_token. Ignorando push.`)
      return new Response(
        JSON.stringify({ success: false, message: 'Conductor sin FCM token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const fcmToken = conductor.fcm_token
    console.log(`Listo para enviar Push a: ${fcmToken} | ${titulo}: ${mensaje}`)

    // 2. Obtener Access Token de Google OAuth
    const auth = new GoogleAuth({
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
      },
      scopes: ['https://www.googleapis.com/auth/firebase.messaging']
    })

    const client = await auth.getClient()
    const accessToken = await client.getAccessToken()

    // 3. Enviar a FCM v1 API
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`
    
    const fcmResponse = await fetch(fcmUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: {
            title: titulo,
            body: mensaje
          },
          android: {
            notification: {
              sound: 'default'
            }
          }
        }
      })
    })

    const fcmData = await fcmResponse.json()

    if (!fcmResponse.ok) {
      console.error('Error de FCM:', fcmData)
      throw new Error(`FCM API Error: ${fcmData.error?.message}`)
    }

    console.log('Push enviado exitosamente:', fcmData.name)

    return new Response(
      JSON.stringify({ success: true, message: 'Push enviado', message_id: fcmData.name }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
