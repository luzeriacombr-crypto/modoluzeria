// Rota pública (sem sessão) — mesma razão do signup-rate-limit.server.ts:
// getRequest() fica isolado aqui pra não entrar no bundle client do
// SalesPage.tsx, que importa este arquivo direto (não atrás de rota lazy).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
    const ip = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request?.headers.get("x-real-ip")
      || "unknown";

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

    return { ok: true };
  });
