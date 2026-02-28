import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {

    const url = new URL(req.url)
    const token = url.searchParams.get("token")

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token requerido" }),
        { status: 400 }
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { data: conductor, error } =
      await supabase
        .from("conductores")
        .select("id,nombres,apellidos,placa,modelo,marca,color")
        .eq("qr_token", token)
        .single()

    if (error || !conductor) {
      return new Response(
        JSON.stringify({ error: "No encontrado" }),
        { status: 404 }
      )
    }

    const { data: documentos } =
      await supabase
        .from("documentos")
        .select("tipo,file_path")
        .eq("conductor_id", conductor.id)

    const docsConUrl = await Promise.all(
      (documentos || []).map(async (doc) => {

        const { data } =
          await supabase.storage
            .from("documentos-conductores")
            .createSignedUrl(doc.file_path, 300)

        return {
          tipo: doc.tipo,
          url: data?.signedUrl
        }
      })
    )

    return new Response(
      JSON.stringify({
        conductor,
        documentos: docsConUrl
      }),
      { status: 200 }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Error cargando perfil" }),
      { status: 500 }
    )
  }
})