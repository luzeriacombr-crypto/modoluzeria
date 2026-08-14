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
};

export const listPlatformUpdates = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<PlatformUpdate[]> => {
    const { data, error } = await context.supabase
      .from("platform_updates")
      .select("id, title, description, category, link_path, link_label, published_at")
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
