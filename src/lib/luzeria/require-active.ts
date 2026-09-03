import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Enforces server-side that the calling user's profile is active.
 * New sign-ups land with active=false until a master approves them; without
 * this check, an unapproved JWT could still call every server function.
 */
export const requireActiveProfile = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("active, org_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Unauthorized");
    if (!data || data.active !== true) {
      throw new Error("Unauthorized: account pending approval or deactivated");
    }

    // requireSupabaseAuth só confere que o token é válido, nunca se a sessão
    // completou o segundo fator — a tela de MFA (_authenticated/route.tsx)
    // só controla pra qual página a pessoa vai, não protege nenhum dado.
    // Sem isso, um token só de senha (aal1) de alguém com MFA cadastrado
    // acessava qualquer função do servidor como se tivesse passado pelo
    // segundo fator. Se a própria checagem falhar tecnicamente (não "a
    // pessoa não tem aal2", mas "não deu nem pra perguntar pro Supabase"),
    // libera — uma instabilidade ali não pode derrubar o app inteiro.
    let blockedByMfa = false;
    try {
      const { data: factors, error: factorsError } = await context.supabase.auth.mfa.listFactors();
      if (!factorsError) {
        const hasVerifiedTotp = (factors?.totp ?? []).some((f: any) => f.status === "verified");
        if (hasVerifiedTotp && (context.claims as any)?.aal !== "aal2") {
          blockedByMfa = true;
        }
      }
    } catch {
      // Erro técnico ao consultar fatores — ver comentário acima.
    }
    if (blockedByMfa) {
      throw new Error("Unauthorized: segundo fator de autenticação necessário");
    }

    return next({ context: { ...context, orgId: data.org_id as string } });
  });