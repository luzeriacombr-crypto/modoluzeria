import { createFileRoute } from "@tanstack/react-router";

// Capa reduzida pra GRADE do link público (preview do feed). As capas dos reels
// são PNGs de 1,7–2,5 MB; num feed com 8 reels o celular da cliente baixava ~16 MB
// só pra desenhar miniaturas de ~200 px, e isso atrasava o vídeo e a aprovação.
// Aqui a capa sai em webp ~480 px (dezenas de KB). A checagem é a mesma de
// getPublicItemFiles: o item precisa ser do cliente dono do token.
export const Route = createFileRoute("/api/public-cover")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? "";
        const itemId = url.searchParams.get("itemId") ?? "";
        const w = Math.min(Math.max(Number(url.searchParams.get("w")) || 480, 120), 960);
        if (token.length < 8 || token.length > 60 || !/^[0-9a-f-]{36}$/i.test(itemId)) {
          return new Response("Requisição inválida.", { status: 400 });
        }

        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
        const { data: clientId } = await supabase.rpc("get_client_id_for_token", { _token: token });
        if (!clientId) return new Response("Link inválido.", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: item } = await supabaseAdmin
          .from("content_items")
          .select("cover_path, months!inner(client_id)")
          .eq("id", itemId)
          .eq("months.client_id", clientId as string)
          .maybeSingle();
        const coverPath = (item as any)?.cover_path as string | null | undefined;
        if (!coverPath) return new Response("Sem capa.", { status: 404 });

        const { data: blob, error } = await supabaseAdmin.storage.from("reel-covers").download(coverPath);
        if (error || !blob) return new Response("Capa indisponível.", { status: 404 });

        try {
          const sharp = (await import("sharp")).default;
          const out = await sharp(Buffer.from(await blob.arrayBuffer()))
            .rotate()
            .resize({ width: w, withoutEnlargement: true })
            .webp({ quality: 74 })
            .toBuffer();
          return new Response(new Uint8Array(out), {
            status: 200,
            headers: { "content-type": "image/webp", "cache-control": "private, max-age=86400" },
          });
        } catch {
          // Se não der pra reduzir (formato estranho), devolve a original em vez de ficar sem capa.
          return new Response(blob, {
            status: 200,
            headers: { "content-type": blob.type || "image/png", "cache-control": "private, max-age=3600" },
          });
        }
      },
    },
  },
});
