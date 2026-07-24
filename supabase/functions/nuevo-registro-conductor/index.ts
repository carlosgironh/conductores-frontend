import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json();
    const conductor = payload.conductor;
    // const archivos = payload.archivos; // Opcional: Subida de archivos aquí

    if (!conductor || !conductor.email || !conductor.password) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos (email, password)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 1. Crear usuario en auth con la Service Role Key
    const { data: newAuthUser, error: createUserError } = await supabaseClient.auth.admin.createUser({
      email: conductor.email,
      password: conductor.password,
      email_confirm: true,
      user_metadata: { role: 'conductor' }
    })

    if (createUserError) {
      return new Response(JSON.stringify({ error: createUserError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const newUserId = newAuthUser.user.id

    // 2. Insertar en la tabla conductores
    const insertData = {
      auth_user_id: newUserId,
      nombres: conductor.nombres,
      apellidos: conductor.apellidos,
      email: conductor.email,
      celular: conductor.celular,
      cedula: conductor.cedula,
      licencia: conductor.licencia,
      placa: conductor.placa,
      modelo: conductor.modelo,
      marca: conductor.marca,
      color: conductor.color,
      poliza_numero: conductor.poliza_numero,
      es_propietario: conductor.es_propietario,
      tiene_aviso_operaciones: conductor.tiene_aviso_operaciones,
      tipo_propiedad: conductor.tipo_propiedad,
      estado: false // Estado pendiente por defecto
    };

    const { error: dbError } = await supabaseClient
      .from('conductores')
      .insert([insertData])

    if (dbError) {
      // Rollback
      await supabaseClient.auth.admin.deleteUser(newUserId)
      return new Response(JSON.stringify({ error: dbError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Aquí se procesarían los archivos (archivos base64) y se subirían al bucket...
    // (Omitido por simplicidad y tiempo, pero se puede agregar lógica de supabase.storage)

    return new Response(JSON.stringify({ success: true, conductorId: newUserId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
