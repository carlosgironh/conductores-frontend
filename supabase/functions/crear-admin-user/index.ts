import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Cliente con Service Role para bypass de reglas
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Autenticar al usuario que hace la peticion
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: adminUser }, error: adminError } = await supabaseAdmin.auth.getUser(token);

    if (adminError || !adminUser) {
      throw new Error('No autorizado');
    }

    // Validar que el admin sea carlosgironh@hotmail.com
    if (adminUser.email !== 'carlosgironh@hotmail.com') {
       throw new Error('No tienes permisos de Super Admin');
    }

    const body = await req.json();
    const { email, password, nombres, apellidos, cedula, rol, qrBase64 } = body;

    if (!email || !nombres || !rol || !qrBase64) {
      throw new Error('Faltan datos requeridos');
    }

    // 1. Crear el usuario en Supabase Auth
    const { data: newUserAuth, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { nombres, apellidos, rol }
    });

    if (createError) throw createError;

    const newUserId = newUserAuth.user.id;

    // 2. Insertar en la tabla pública correspondiente
    if (rol === 'conductor') {
      const { error: insertError } = await supabaseAdmin.from('conductores').insert({
        id: newUserId,
        auth_user_id: newUserId,
        nombres,
        apellidos,
        email,
        cedula,
        rol,
        estado: true
      });
      if (insertError) throw insertError;
    } else {
      const { error: insertError } = await supabaseAdmin.from('pasajeros').insert({
        id: newUserId,
        auth_user_id: newUserId,
        nombres,
        apellidos,
        email,
        cedula,
        rol,
        estado: true
      });
      if (insertError) throw insertError;
    }

    // 3. Enviar correo SMTP a gerencia
    try {
      const client = new SmtpClient();
      await client.connectTLS({
        hostname: Deno.env.get('SMTP_HOST') || "smtp.gmail.com",
        port: parseInt(Deno.env.get('SMTP_PORT') || "465"),
        username: Deno.env.get('SMTP_USER') || "",
        password: Deno.env.get('SMTP_PASS') || "",
      });

      // Formatear el base64 eliminando el prefijo de data url
      const base64Data = qrBase64.replace(/^data:image\/(png|jpeg);base64,/, "");
      
      await client.send({
        from: Deno.env.get('SMTP_USER') || "no-reply@nrdesingcorp.com",
        to: "gerencia@nrdesingcorp.com",
        subject: `QR de ${nombres} ${apellidos}`,
        content: `Buen dia/noche sr nestor romero adjunto el QR del conductor ${nombres} ${apellidos}`,
        attachments: [
          {
            filename: `QR_${nombres.replace(/ /g, '_')}.png`,
            content: Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)),
            encoding: "base64",
          },
        ],
      });

      await client.close();
    } catch (smtpError) {
      console.error('Error enviando SMTP:', smtpError);
      // No hacemos throw aquí para que al menos el usuario se cree correctamente.
    }

    return new Response(JSON.stringify({ success: true, userId: newUserId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
