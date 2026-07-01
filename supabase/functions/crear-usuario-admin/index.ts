import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Solo un usuario admin autenticado debería poder llamar a esto
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Usuario no autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Opcional: Validar que `user.id` esté en la tabla admins
    const { data: isAdmin, error: adminError } = await supabaseClient
      .from('admins')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (adminError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Solo los administradores pueden crear nuevos usuarios' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Obtener los datos del cuerpo de la petición
    const { email, password, role, nombres, apellidos, telefono } = await req.json()

    if (!email || !password || !role) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos (email, password, role)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 1. Crear usuario en auth con la Service Role Key
    const { data: newAuthUser, error: createUserError } = await supabaseClient.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { role: role }
    })

    if (createUserError) {
      return new Response(JSON.stringify({ error: createUserError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const newUserId = newAuthUser.user.id

    // 2. Insertar en la tabla correspondiente
    let insertData;
    let table = '';

    if (role === 'admin') {
      table = 'admins'
      insertData = { auth_user_id: newUserId, email: email }
    } else if (role === 'coordinador') {
      table = 'coordinadores'
      insertData = { auth_user_id: newUserId, nombres, apellidos, email, telefono, permissions: {} }
    } else {
      // Rollback
      await supabaseClient.auth.admin.deleteUser(newUserId)
      return new Response(JSON.stringify({ error: 'Rol no válido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { error: dbError } = await supabaseClient
      .from(table)
      .insert([insertData])

    if (dbError) {
      // Rollback
      await supabaseClient.auth.admin.deleteUser(newUserId)
      return new Response(JSON.stringify({ error: dbError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ success: true, user: newAuthUser.user }), {
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
