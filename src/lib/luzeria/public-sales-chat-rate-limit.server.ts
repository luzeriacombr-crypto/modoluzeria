// Server-only module — isolado do resto por causa do getRequest(), mesmo
// motivo de signup-rate-limit.server.ts (evita puxar isso pro grafo de
// módulos client da página de vendas, que importa o resto do arquivo de
// chat público de forma eager).
import { getTrustedClientIp } from "./signup-rate-limit.server";

const CHAT_LIMIT_PER_HOUR = 15;

export async function checkPublicSalesChatRateLimit(supabaseAdmin: any) {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  const ip = getTrustedClientIp(request);

  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("public_sales_chat_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", windowStart);
  if ((count ?? 0) >= CHAT_LIMIT_PER_HOUR) {
    throw new Error("Muitas mensagens por aqui — tenta de novo daqui a pouco, ou chama a gente no WhatsApp.");
  }
  await supabaseAdmin.from("public_sales_chat_attempts").insert({ ip });
}
