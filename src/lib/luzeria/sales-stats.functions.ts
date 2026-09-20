// Números públicos da página de vendas (clientes organizados, entregas) —
// contados direto do banco, com cache de 1h no servidor pra não fazer uma
// contagem pesada a cada visita. Só devolve totais, nenhum dado de agência.
import { createServerFn } from "@tanstack/react-start";

let cache: { at: number; value: { clients: number; deliveries: number } } | null = null;
const TTL_MS = 60 * 60 * 1000;

export const getPublicSalesStats = createServerFn({ method: "GET" }).handler(async () => {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ count: clients }, { count: deliveries }] = await Promise.all([
    supabaseAdmin.from("clients").select("id", { count: "exact", head: true }).eq("archived", false),
    supabaseAdmin
      .from("content_items")
      .select("id", { count: "exact", head: true })
      .in("status", ["PRONTO_PARA_PUBLICAR", "FINALIZADO", "CONCLUIDO"])
      .in("type", ["post", "reel", "story"]),
  ]);
  const value = { clients: clients ?? 0, deliveries: deliveries ?? 0 };
  cache = { at: Date.now(), value };
  return value;
});
