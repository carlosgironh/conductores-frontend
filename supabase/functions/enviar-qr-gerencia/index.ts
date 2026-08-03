import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import nodemailer from 'npm:nodemailer@6.9.11'
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

    // Obtener credenciales desde las variables de entorno
    const smtpHost = Deno.env.get('SMTP_HOST') || '';
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '465');
    const smtpUser = Deno.env.get('SMTP_USER') || '';
    const smtpPass = Deno.env.get('SMTP_PASS') || '';

    if (!smtpHost || !smtpUser || !smtpPass) {
       throw new Error("SMTP variables (SMTP_HOST, SMTP_USER, SMTP_PASS) no están configuradas en Supabase Secrets");
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: `"RoadTo Admin" <${smtpUser}>`,
      to: 'gerencia@nrdesingcorp.com',
      subject: `Código QR de acceso para: ${conductorNombre}`,
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
          content: base64Data,
          encoding: 'base64',
          contentType: 'image/png'
        }
      ]
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Correo enviado a gerencia exitosamente' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Error al enviar correo' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
