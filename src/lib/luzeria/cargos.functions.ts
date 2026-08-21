import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";
import { PERMISSION_KEYS, type PermissionKey } from "./types";

export type Cargo = {
  id: string;
  name: string;
  permissions: PermissionKey[];
};

/** Sugestão inicial pra agências novas — atômicos e combináveis (uma
 * pessoa pode ter "Editor" + "Videomaker" juntos, por exemplo), editáveis
 * e apagáveis depois por qualquer admin. Master não precisa de permissão
 * nenhuma aqui (o papel "master" já libera tudo, ver hasPermission em
 * types.ts) — o cargo "Adm Master" existe só como rótulo/etiqueta. */
export const DEFAULT_CARGOS: { name: string; permissions: PermissionKey[] }[] = [
  { name: "Editor", permissions: [] },
  { name: "Videomaker", permissions: [] },
  { name: "Redator(a)", permissions: [] },
  { name: "Social Media", permissions: ["instagram_publish", "approve_finalize"] },
  { name: "Financeiro", permissions: ["view_financeiro"] },
  { name: "Atendimento/Vendas", permissions: ["sales_pipeline"] },
  { name: "Adm Master", permissions: [] },
];

/** Chamado na criação de uma agência nova (signup.functions.ts), mesmo
 * padrão de seedJourneyStagesForOrg. */
export async function seedCargosForOrg(supabase: any, orgId: string): Promise<void> {
  const rows = DEFAULT_CARGOS.map((c) => ({ org_id: orgId, name: c.name, permissions: c.permissions }));
  const { error } = await supabase.from("cargos").insert(rows);
  if (error) console.error("[seedCargosForOrg] failed:", error.message);
}

export const listCargos = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("cargos").select("id, name, permissions").eq("org_id", context.orgId).order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Cargo[];
  });

export const upsertCargo = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id?: string; name: string; permissions: string[] }) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().trim().min(1).max(60),
      permissions: z.array(z.enum(PERMISSION_KEYS)).max(PERMISSION_KEYS.length),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const db: any = context.supabase;
    if (data.id) {
      const { error } = await db.from("cargos")
        .update({ name: data.name, permissions: data.permissions }).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("cargos")
        .insert({ org_id: context.orgId, name: data.name, permissions: data.permissions });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteCargo = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase.from("cargos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Substitui de uma vez o conjunto inteiro de cargos da pessoa — mais
 * simples pro cliente (um seletor de múltipla escolha) do que
 * adicionar/remover cargo por cargo. */
export const setProfileCargos = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { profileId: string; cargoIds: string[] }) =>
    z.object({
      profileId: z.string().uuid(),
      cargoIds: z.array(z.string().uuid()).max(20),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const db: any = context.supabase;
    // Confere que o perfil é da mesma org antes de mexer — RLS já barraria
    // no INSERT, mas o DELETE por profile_id sozinho não tem esse filtro.
    const { data: profile } = await db.from("profiles").select("org_id").eq("id", data.profileId).maybeSingle();
    if (!profile || profile.org_id !== context.orgId) throw new Error("Forbidden");
    const { error: delErr } = await db.from("profile_cargos").delete().eq("profile_id", data.profileId);
    if (delErr) throw new Error(delErr.message);
    if (data.cargoIds.length > 0) {
      const { error: insErr } = await db.from("profile_cargos")
        .insert(data.cargoIds.map((cargoId) => ({ profile_id: data.profileId, cargo_id: cargoId })));
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });
