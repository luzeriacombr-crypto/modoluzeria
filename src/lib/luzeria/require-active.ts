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
      .select("active, org_id, last_active_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Unauthorized");
    if (!data || data.active !== true) {
      throw new Error("Unauthorized: account pending approval or deactivated");
    }

    // Marca "usou o app agora" — trava de 10min pra não virar um UPDATE a
    // cada chamada de servidor (cada tela dispara várias). Fire-and-forget:
    // uma falha aqui não pode derrubar a requisição real do usuário.
    const lastActive = data.last_active_at ? new Date(data.last_active_at as string).getTime() : 0;
    if (Date.now() - lastActive > 10 * 60 * 1000) {
      context.supabase
        .from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", context.userId)
        .then(() => {}, () => {});
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

/**
 * Bloqueia mutações numa agência marcada como demo somente-leitura
 * (orgs.demo_read_only) — usado hoje só na Views Agência, a demo pública.
 * Master fica isento (conta interna, não a divulgada) pra poder manter os
 * dados da demo pelo próprio app. Nenhuma outra agência é afetada: a
 * coluna nasce `false`, então essa checagem some (early return) em todo o
 * resto do produto.
 */
export async function assertNotDemoReadOnly(
  supabase: any, orgId: string, userId: string,
): Promise<void> {
  const { data: org } = await supabase
    .from("orgs").select("demo_read_only").eq("id", orgId).maybeSingle();
  if (!org?.demo_read_only) return;
  const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
  if (isMaster) return;
  throw new Error("Esta é uma conta de demonstração — somente visualização, sem alterações.");
}