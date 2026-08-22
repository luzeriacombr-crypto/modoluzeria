import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";

/** Substitui de uma vez a restrição de clientes de um perfil: liga/desliga
 * `client_access_restricted` e troca a lista inteira de clientes liberados
 * (mesmo padrão de setProfileCargos — mais simples que adicionar/remover
 * um por um). Quando restricted=false, clientIds é ignorado (limpo). */
export const setProfileClientAccess = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { profileId: string; restricted: boolean; clientIds: string[] }) =>
    z.object({
      profileId: z.string().uuid(),
      restricted: z.boolean(),
      clientIds: z.array(z.string().uuid()).max(500),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const db: any = context.supabase;
    // Confere que o perfil é da mesma org antes de mexer — RLS já barraria
    // no INSERT, mas o DELETE por profile_id sozinho não tem esse filtro.
    const { data: profile } = await db.from("profiles").select("org_id").eq("id", data.profileId).maybeSingle();
    if (!profile || profile.org_id !== context.orgId) throw new Error("Forbidden");

    const { error: updErr } = await db.from("profiles")
      .update({ client_access_restricted: data.restricted }).eq("id", data.profileId);
    if (updErr) throw new Error(updErr.message);

    const { error: delErr } = await db.from("client_access").delete().eq("profile_id", data.profileId);
    if (delErr) throw new Error(delErr.message);

    if (data.restricted && data.clientIds.length > 0) {
      const { error: insErr } = await db.from("client_access")
        .insert(data.clientIds.map((clientId) => ({ profile_id: data.profileId, client_id: clientId })));
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });
