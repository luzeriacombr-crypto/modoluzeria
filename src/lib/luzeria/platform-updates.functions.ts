import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { LUZERIA_ORG_ID } from "./api.functions";

export const PLATFORM_UPDATE_CATEGORIES = [
  "Redes sociais",
  "Roteiros e Planejamento",
  "Cliente e Preview",
  "Equipe",
  "Notificações",
  "Segurança e Conta",
  "Arquivos e Mídia",
  "Financeiro",
  "Vendas",
  "Automações",
  "Correções e Melhorias",
] as const;

export type UpdateAudience = "all" | "agency" | "house";
export const UPDATE_AUDIENCE_LABEL: Record<UpdateAudience, string> = { all: "Todos", agency: "Só agências", house: "Só houses" };

export type PlatformUpdate = {
  id: string;
  audience: UpdateAudience;
  title: string;
  description: string;
  category: string;
  linkPath: string | null;
  linkLabel: string | null;
  publishedAt: string;
  notifiedAt: string | null;
};

export const listPlatformUpdates = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<PlatformUpdate[]> => {
    // Cada conta vê o que é pra todos + o que é do tipo dela (agência ou house);
    // a conta da própria Luzeria (quem publica) vê tudo.
    const db = context.supabase as any;
    let q = db
      .from("platform_updates")
      .select("id, title, description, category, link_path, link_label, published_at, notified_at, audience")
      .order("published_at", { ascending: false });
    if (context.orgId !== LUZERIA_ORG_ID) {
      const { data: org } = await db.from("orgs").select("account_type").eq("id", context.orgId).maybeSingle();
      q = q.in("audience", ["all", org?.account_type === "house" ? "house" : "agency"]);
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      audience: (r.audience ?? "all") as UpdateAudience,
      title: r.title,
      description: r.description,
      category: r.category,
      linkPath: r.link_path,
      linkLabel: r.link_label,
      publishedAt: r.published_at,
      notifiedAt: r.notified_at ?? null,
    }));
  });

export const createPlatformUpdate = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { title: string; description: string; category: string; audience?: UpdateAudience; linkPath?: string; linkLabel?: string; publishedAt?: string }) =>
    z.object({
      title: z.string().trim().min(1).max(120),
      description: z.string().trim().min(1).max(1000),
      category: z.string().trim().min(1).max(60),
      audience: z.enum(["all", "agency", "house"]).optional(),
      linkPath: z.string().trim().max(300).optional(),
      linkLabel: z.string().trim().max(60).optional(),
      publishedAt: z.string().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    // audience ainda não está nos tipos gerados do Supabase.
    const { error } = await (context.supabase as any).from("platform_updates").insert({
      title: data.title,
      description: data.description,
      category: data.category,
      audience: data.audience ?? "all",
      link_path: data.linkPath || null,
      link_label: data.linkLabel || null,
      published_at: data.publishedAt || new Date().toISOString(),
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePlatformUpdate = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    const { error } = await context.supabase.from("platform_updates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Uma notificação por lote, nunca uma por atualização — card separado pra
 * cada novidade em /configuracoes?tab=updates, mas um único aviso in-app no
 * formato "{destaque} e outras N novidades... Clica aqui!" (pedido do
 * Junior). O admin escolhe qual das ainda-não-avisadas é o destaque; todas
 * as outras ainda-não-avisadas entram no "N" e viram avisadas junto. */
export const sendPlatformUpdateNotification = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { headlineId: string }) => z.object({ headlineId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");

    const db = context.supabase as any;
    const { data: pending } = await db
      .from("platform_updates").select("id, title, audience").is("notified_at", null);
    const all = (pending ?? []) as { id: string; title: string; audience: UpdateAudience }[];
    const headline = all.find((u) => u.id === data.headlineId);
    if (!headline) throw new Error("Essa novidade não está mais na lista de não-avisadas.");

    // Cada público recebe um aviso só com as novidades dele: o destaque escolhido
    // (se for do público) + "e outras N". Quem não tem nenhuma novidade não recebe nada.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: activeProfiles, error: profilesErr } = await (supabaseAdmin as any)
      .from("profiles").select("id, orgs!inner(account_type)").eq("active", true);
    if (profilesErr) throw new Error(profilesErr.message);

    const rows: { user_id: string; type: string; message: string }[] = [];
    for (const aud of ["agency", "house"] as const) {
      const mine = all.filter((u) => u.audience === "all" || u.audience === aud);
      if (mine.length === 0) continue;
      const head = mine.find((u) => u.id === headline.id) ?? mine[0];
      const otherCount = mine.length - 1;
      const message = otherCount > 0
        ? `${head.title} e outras ${otherCount} novidade${otherCount === 1 ? "" : "s"}... Clica aqui!`
        : `${head.title} Clica aqui!`;
      for (const p of activeProfiles ?? []) {
        const isHouseProfile = (p as any).orgs?.account_type === "house";
        if ((aud === "house") === isHouseProfile) rows.push({ user_id: p.id, type: "platform_update", message });
      }
    }
    if (rows.length > 0) {
      const { error: insErr } = await (supabaseAdmin as any).from("notifications").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }

    const idsToMark = all.map((u) => u.id);
    await db.from("platform_updates").update({ notified_at: new Date().toISOString() }).in("id", idsToMark);

    return { ok: true, notifiedUsers: rows.length, totalUpdates: idsToMark.length };
  });
