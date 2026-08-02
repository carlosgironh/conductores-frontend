import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { SmtpClient } from 'https://deno.land/x/smtp@v0.7.0/mod.ts'
import { decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { qrBase64, conductorNombre, conductorEmail } = await req.json()

    if (!qrBase64 || !conductorNombre) {
      throw new Error("Missing required fields: qrBase64 or conductorNombre")
    }

    // Remover el prefijo 'data:image/png;base64,' si viene incluido
    const base64Data = qrBase64.replace(/^data:image\/png;base64,/, '');
    const imageBytes = decode(base64Data);

    const client = new SmtpClient();
    
    // Obtener credenciales desde las variables de entorno
    const smtpHost = Deno.env.get('SMTP_HOST') || '';
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '465');
    const smtpUser = Deno.env.get('SMTP_USER') || '';
    const smtpPass = Deno.env.get('SMTP_PASS') || '';

    if (!smtpHost || !smtpUser || !smtpPass) {
       throw new Error("SMTP variables (SMTP_HOST, SMTP_USER, SMTP_PASS) no están configuradas en Supabase Secrets");
    }

    await client.connectTLS({
      hostname: smtpHost,
      port: smtpPort,
      username: smtpUser,
      password: smtpPass,
    });

    await client.send({
      from: smtpUser,
      to: 'gerencia@nrdesingcorp.com',
      subject: `Código QR de acceso para: ${conductorNombre}`,
      content: 'auto',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Nuevo Código QR Generado</h2>
          <p>Se ha generado el código QR de acceso para <strong>${conductorNombre}</strong>.</p>
          <p>Correo asociado: ${conductorEmail || 'No especificado'}</p>
          <p>Encuentra el código QR adjunto a este correo.</p>
        </div>
      `,
      attachments: [
        {
          filename: `QR_${conductorNombre.replace(/\s+/g, '_')}.png`,
          content: imageBytes,
          encoding: 'binary',
          contentType: 'image/png'
        }
      ]
    });

    await client.close();

    return new Response(
      JSON.stringify({ success: true, message: 'Correo enviado a gerencia exitosamente' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Error al enviar correo' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
