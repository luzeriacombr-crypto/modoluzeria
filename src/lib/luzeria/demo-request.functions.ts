// Rota pública (sem sessão) — mesma razão do signup-rate-limit.server.ts:
// getRequest() fica isolado aqui pra não entrar no bundle client do
// SalesPage.tsx, que importa este arquivo direto (não atrás de rota lazy).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { LUZERIA_ORG_ID, MODO_CRIADOR_OWNER_ID } from "./api.functions";
import { getTrustedClientIp } from "./signup-rate-limit.server";

const PLATFORM_SUPPORT_EMAIL = "junioreisfoto2@gmail.com";
const DEMO_REQUEST_LIMIT_PER_HOUR = 5;

export const requestDemo = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; email: string; phone: string; website?: string }) =>
    z.object({
      name: z.string().trim().min(1).max(120),
      email: z.string().trim().email().max(160),
      phone: z.string().trim().min(8).max(30),
      website: z.string().max(0).optional().or(z.literal("")), // honeypot
    }).parse(d))
  .handler(async ({ data }) => {
    if (data.website) return { ok: true }; // bot preencheu o honeypot — finge sucesso

    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const ip = getTrustedClientIp(request);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("demo_requests").select("id", { count: "exact", head: true })
      .eq("ip", ip).gte("created_at", windowStart);
    if ((count ?? 0) >= DEMO_REQUEST_LIMIT_PER_HOUR) {
      throw new Error("Muitas tentativas. Tente novamente em algumas horas.");
    }

    const { error } = await supabaseAdmin.from("demo_requests").insert({
      name: data.name, email: data.email, phone: data.phone, ip,
    });
    if (error) throw new Error(error.message);

    try {
      const { sendEmail } = await import("./resend.server");
      await sendEmail({
        to: PLATFORM_SUPPORT_EMAIL,
        subject: `Pedido de demonstração — ${data.name}`,
        html: `
          <p><strong>Nome:</strong> ${data.name}</p>
          <p><strong>E-mail:</strong> ${data.email}</p>
          <p><strong>Telefone:</strong> ${data.phone}</p>
        `,
      });
    } catch (e) {
      // Lead já está salvo na tabela mesmo se o e-mail falhar — não derruba a resposta pro usuário.
      console.error("Falha ao enviar e-mail de pedido de demonstração:", e);
    }

    try {
      // Notificação no sino, além do e-mail.
      await supabaseAdmin.from("notifications").insert({
        user_id: MODO_CRIADOR_OWNER_ID,
        type: "demo_request",
        message: `Novo pedido de demonstração — ${data.name}`,
      });
    } catch (e) {
      console.error("Falha ao criar notificação de pedido de demonstração:", e);
    }

    return { ok: true };
  });

/** Platform-admin only: leads capturados pelo popup de demo no site.
 * demo_requests tem RLS ligado sem nenhuma policy (só service role acessa —
 * ver comentário na migration), então precisa de supabaseAdmin mesmo pra
 * leitura; o gate de org é o que protege isso de qualquer outra agência. */
export const listDemoRequests = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("demo_requests")
      .select("id, name, email, phone, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
