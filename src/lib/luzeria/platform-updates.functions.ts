import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { LUZERIA_ORG_ID } from "./api.functions";

export const PLATFORM_UPDATE_CATEGORIES = [
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

export type PlatformUpdate = {
  id: string;
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
    const { data, error } = await (context.supabase as any)
      .from("platform_updates")
      .select("id, title, description, category, link_path, link_label, published_at, notified_at")
      .order("published_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
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
  .inputValidator((d: { title: string; description: string; category: string; linkPath?: string; linkLabel?: string; publishedAt?: string }) =>
    z.object({
      title: z.string().trim().min(1).max(120),
      description: z.string().trim().min(1).max(1000),
      category: z.string().trim().min(1).max(60),
      linkPath: z.string().trim().max(300).optional(),
      linkLabel: z.string().trim().max(60).optional(),
      publishedAt: z.string().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    const { error } = await context.supabase.from("platform_updates").insert({
      title: data.title,
      description: data.description,
      category: data.category,
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
      .from("platform_updates").select("id, title").is("notified_at", null);
    const headline = (pending ?? []).find((u: any) => u.id === data.headlineId);
    if (!headline) throw new Error("Essa novidade não está mais na lista de não-avisadas.");
    const otherCount = (pending ?? []).length - 1;

    const message = otherCount > 0
      ? `${headline.title} e outras ${otherCount} novidade${otherCount === 1 ? "" : "s"}... Clica aqui!`
      : `${headline.title} Clica aqui!`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: activeProfiles, error: profilesErr } = await supabaseAdmin
      .from("profiles").select("id").eq("active", true);
    if (profilesErr) throw new Error(profilesErr.message);

    const rows = (activeProfiles ?? []).map((p: any) => ({
      user_id: p.id, type: "platform_update", message,
    }));
    if (rows.length > 0) {
      const { error: insErr } = await (supabaseAdmin as any).from("notifications").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }

    const idsToMark = (pending ?? []).map((u: any) => u.id);
    await db.from("platform_updates").update({ notified_at: new Date().toISOString() }).in("id", idsToMark);

    return { ok: true, notifiedUsers: rows.length, totalUpdates: idsToMark.length };
  });
