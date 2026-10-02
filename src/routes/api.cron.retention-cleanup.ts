import { createFileRoute } from "@tanstack/react-router";

// Limpeza de retenção, chamada uma vez por dia por cron externo (GitHub
// Actions — mesmo padrão de /api/cron/send-push-notifications). Faz duas
// coisas: apaga notificação lida com mais de 90 dias (a tabela crescia sem
// nada limpando: 965 em julho, 6.576 em agosto) e purga da lixeira o que
// passou dos 7 dias — antes isso só acontecia quando alguém abria a página
// da Lixeira, então o prazo não era garantido. Também apaga as fotos do Nativo
// que ficaram sem uso há mais de 30 dias. Protegido por CRON_SECRET.
export const Route = createFileRoute("/api/cron/retention-cleanup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const auth = request.headers.get("authorization");
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("run_retention_cleanup" as any);
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        const row = Array.isArray(data) ? data[0] : data;
        // Nativo: apaga do Storage as fotos de projeto sem uso há mais de 30 dias (promessa da
        // Política de Privacidade). A lista vem do banco; arquivo só sai pelo Storage.
        let nativoOrphans = 0;
        try {
          const { data: orphans } = await supabaseAdmin.rpc("nativo_orphan_media" as any, { p_days: 30, p_limit: 500 });
          const names = ((orphans as { name: string }[] | null) ?? []).map((o) => o.name);
          for (let i = 0; i < names.length; i += 100) {
            const { data: removed } = await supabaseAdmin.storage.from("nativo-media").remove(names.slice(i, i + 100));
            nativoOrphans += removed?.length ?? 0;
          }
        } catch {
          // Limpeza do Nativo nunca derruba a limpeza principal.
        }
        return new Response(JSON.stringify({ ok: true, ...(row ?? {}), nativo_orphans_removed: nativoOrphans }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
