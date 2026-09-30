// Orçamentos (Financeiro → Orçamentos): catálogo de produtos/serviços da
// agência + orçamentos gerados a partir dele, exportados em PDF. Plano
// aprovado: claude.ai/artifact/41X9c5BsGyRCCDYvMckid1. Mesmo padrão de
// acesso do resto do Financeiro (master ou cargo "view_financeiro").
import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";

async function assertFinanceiroAccess(supabase: any, userId: string) {
  const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
  if (isMaster) return;
  const { data: hasPerm } = await supabase.rpc("has_cargo_permission", { _user_id: userId, _perm: "view_financeiro" });
  if (!hasPerm) throw new Error("Forbidden");
}

async function signPaths(supabase: any, paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  const result = new Map<string, string>();
  if (unique.length === 0) return result;
  const signed = await Promise.all(unique.map(async (path) => {
    const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
    return { path, url: data?.signedUrl as string | undefined };
  }));
  signed.forEach(({ path, url }) => { if (url) result.set(path, url); });
  return result;
}

// ---- Catálogo de produtos ----

export type BudgetProductPlan = { label: string; priceCents: number; description: string | null };
export type BudgetProduct = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  plans: BudgetProductPlan[];
  icon: string | null;
  photoPath: string | null;
  photoUrl: string | null;
  createdAt: string;
};

const planSchema = z.object({
  label: z.string().trim().min(1).max(80),
  priceCents: z.number().int().min(0),
  description: z.string().trim().max(300).nullable().optional(),
});

export const listBudgetProducts = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<BudgetProduct[]> => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const { data, error } = await (context.supabase as any)
      .from("budget_products").select("id, name, description, price_cents, plans, icon, photo_path, created_at")
      .eq("org_id", context.orgId).order("created_at");
    if (error) throw new Error(error.message);
    const urls = await signPaths(context.supabase, (data ?? []).map((r: any) => r.photo_path));
    return (data ?? []).map((r: any) => ({
      id: r.id, name: r.name, description: r.description, priceCents: r.price_cents,
      plans: r.plans ?? [], icon: r.icon, photoPath: r.photo_path,
      photoUrl: r.photo_path ? (urls.get(r.photo_path) ?? null) : null,
      createdAt: r.created_at,
    }));
  });

export const addBudgetProduct = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { name: string; description?: string | null; priceCents: number; plans?: BudgetProductPlan[]; icon?: string | null; photoPath?: string | null }) =>
    z.object({
      name: z.string().trim().min(1).max(120),
      description: z.string().trim().max(300).nullable().optional(),
      priceCents: z.number().int().min(0),
      plans: z.array(planSchema).max(10).optional(),
      icon: z.string().trim().max(8).nullable().optional(),
      photoPath: z.string().max(300).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("budget_products").insert({
      org_id: context.orgId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      price_cents: data.priceCents,
      plans: data.plans ?? [],
      icon: data.icon?.trim() || null,
      photo_path: data.photoPath ?? null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateBudgetProduct = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; name: string; description?: string | null; priceCents: number; plans?: BudgetProductPlan[]; icon?: string | null; photoPath?: string | null }) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().trim().min(1).max(120),
      description: z.string().trim().max(300).nullable().optional(),
      priceCents: z.number().int().min(0),
      plans: z.array(planSchema).max(10).optional(),
      icon: z.string().trim().max(8).nullable().optional(),
      photoPath: z.string().max(300).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("budget_products").update({
      name: data.name.trim(),
      description: data.description?.trim() || null,
      price_cents: data.priceCents,
      plans: data.plans ?? [],
      icon: data.icon?.trim() || null,
      photo_path: data.photoPath ?? null,
    }).eq("id", data.id).eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeBudgetProduct = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("budget_products").delete().eq("id", data.id).eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Orçamentos ----

export type BudgetItem = { label: string; description: string | null; priceCents: number };
export type BudgetFrontItem = { title: string; description: string | null };
export type BudgetFront = { title: string; items: BudgetFrontItem[] };

export type Budget = {
  id: string;
  clientName: string;
  clientSegment: string | null;
  version: "simples" | "completo";
  items: BudgetItem[];
  logoVariant: "light" | "dark";
  headerImagePath: string | null;
  headerImageUrl: string | null;
  footerText: string | null;
  coverPhrase: string | null;
  introTitle: string | null;
  introText: string | null;
  fronts: BudgetFront[];
  paymentTerms: string | null;
  cronograma: string | null;
  notIncluded: string | null;
  afterApproval: string | null;
  backPhrase: string | null;
  gradientFrom: string | null;
  gradientTo: string | null;
  accentColor: string | null;
  totalCents: number;
  createdAt: string;
  updatedAt: string;
};

const itemSchema = z.object({
  label: z.string().trim().min(1).max(140),
  description: z.string().trim().max(300).nullable().optional(),
  priceCents: z.number().int().min(0),
});
const frontSchema = z.object({
  title: z.string().trim().min(1).max(100),
  items: z.array(z.object({
    title: z.string().trim().min(1).max(140),
    description: z.string().trim().max(400).nullable().optional(),
  })).max(20),
});

const budgetInputSchema = z.object({
  id: z.string().uuid().optional(),
  clientName: z.string().trim().min(1).max(140),
  clientSegment: z.string().trim().max(140).nullable().optional(),
  version: z.enum(["simples", "completo"]),
  items: z.array(itemSchema).max(40),
  logoVariant: z.enum(["light", "dark"]),
  headerImagePath: z.string().max(300).nullable().optional(),
  footerText: z.string().trim().max(200).nullable().optional(),
  coverPhrase: z.string().trim().max(200).nullable().optional(),
  introTitle: z.string().trim().max(160).nullable().optional(),
  introText: z.string().trim().max(4000).nullable().optional(),
  fronts: z.array(frontSchema).max(10).optional(),
  paymentTerms: z.string().trim().max(500).nullable().optional(),
  cronograma: z.string().trim().max(500).nullable().optional(),
  notIncluded: z.string().trim().max(500).nullable().optional(),
  afterApproval: z.string().trim().max(500).nullable().optional(),
  backPhrase: z.string().trim().max(200).nullable().optional(),
  gradientFrom: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  gradientTo: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
});

function totalFromItems(items: { priceCents: number }[]): number {
  return items.reduce((s, i) => s + i.priceCents, 0);
}

export const listBudgets = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<Budget[]> => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const { data, error } = await (context.supabase as any)
      .from("budgets").select("*").eq("org_id", context.orgId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const urls = await signPaths(context.supabase, (data ?? []).map((r: any) => r.header_image_path));
    return (data ?? []).map((r: any) => rowToBudget(r, urls));
  });

function rowToBudget(r: any, urls: Map<string, string>): Budget {
  return {
    id: r.id, clientName: r.client_name, clientSegment: r.client_segment,
    version: r.version, items: r.items ?? [], logoVariant: r.logo_variant,
    headerImagePath: r.header_image_path,
    headerImageUrl: r.header_image_path ? (urls.get(r.header_image_path) ?? null) : null,
    footerText: r.footer_text, coverPhrase: r.cover_phrase, introTitle: r.intro_title, introText: r.intro_text,
    fronts: r.fronts ?? [], paymentTerms: r.payment_terms, cronograma: r.cronograma,
    notIncluded: r.not_included, afterApproval: r.after_approval, backPhrase: r.back_phrase,
    gradientFrom: r.gradient_from, gradientTo: r.gradient_to, accentColor: r.accent_color,
    totalCents: r.total_cents, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

/** Cria (sem id) ou atualiza (com id) um orçamento — o construtor salva
 * antes de gerar o PDF, pra virar um item na lista "Meus orçamentos". */
export const saveBudget = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: z.infer<typeof budgetInputSchema>) => budgetInputSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const totalCents = totalFromItems(data.items);
    const row = {
      org_id: context.orgId,
      client_name: data.clientName.trim(),
      client_segment: data.clientSegment?.trim() || null,
      version: data.version,
      items: data.items,
      logo_variant: data.logoVariant,
      header_image_path: data.headerImagePath ?? null,
      footer_text: data.footerText?.trim() || null,
      cover_phrase: data.coverPhrase?.trim() || null,
      intro_title: data.introTitle?.trim() || null,
      intro_text: data.introText?.trim() || null,
      fronts: data.fronts ?? [],
      payment_terms: data.paymentTerms?.trim() || null,
      cronograma: data.cronograma?.trim() || null,
      not_included: data.notIncluded?.trim() || null,
      after_approval: data.afterApproval?.trim() || null,
      back_phrase: data.backPhrase?.trim() || null,
      gradient_from: data.gradientFrom ?? null,
      gradient_to: data.gradientTo ?? null,
      accent_color: data.accentColor ?? null,
      total_cents: totalCents,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { error } = await (context.supabase as any).from("budgets").update(row).eq("id", data.id).eq("org_id", context.orgId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await (context.supabase as any)
      .from("budgets").insert({ ...row, created_by: context.userId }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const removeBudget = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("budgets").delete().eq("id", data.id).eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Gera o PDF de um orçamento já salvo — logo e degradê/cor de destaque
 * caem no padrão da "Marca da agência" quando o orçamento não tem os seus
 * próprios (deixados em branco), mas cada orçamento pode ter as suas. */
export const exportBudgetPdf = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ pdfBase64: string }> => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const { data: b, error } = await (context.supabase as any)
      .from("budgets").select("*").eq("id", data.id).eq("org_id", context.orgId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!b) throw new Error("Orçamento não encontrado.");

    const { data: org } = await (context.supabase as any)
      .from("orgs").select("logo_path, logo_path_light, hero_gradient_from, hero_gradient_to, color_primary")
      .eq("id", context.orgId).maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    async function downloadBytes(path: string | null | undefined): Promise<Uint8Array | null> {
      if (!path) return null;
      try {
        const { data: file } = await supabaseAdmin.storage.from("avatars").download(path);
        return file ? new Uint8Array(await file.arrayBuffer()) : null;
      } catch { return null; }
    }

    const logoPath = b.logo_variant === "light" ? (org?.logo_path_light ?? org?.logo_path) : (org?.logo_path ?? org?.logo_path_light);
    const [logoBytes, headerBytes] = await Promise.all([
      downloadBytes(logoPath),
      downloadBytes(b.header_image_path),
    ]);

    const brandColor = org?.color_primary ?? "#CDFF00";
    const { renderBudgetPdf } = await import("./budget-pdf.server");
    const pdfBytes = await renderBudgetPdf({
      version: b.version,
      clientName: b.client_name,
      clientSegment: b.client_segment,
      items: (b.items ?? []).map((i: any) => ({ label: i.label, description: i.description ?? null, priceCents: i.priceCents })),
      totalCents: b.total_cents,
      logoBytes,
      headerBytes,
      footerText: b.footer_text,
      gradientFrom: b.gradient_from ?? org?.hero_gradient_from ?? brandColor,
      gradientTo: b.gradient_to ?? org?.hero_gradient_to ?? "#101010",
      accentColor: b.accent_color ?? brandColor,
      coverPhrase: b.cover_phrase,
      introTitle: b.intro_title,
      introText: b.intro_text,
      fronts: (b.fronts ?? []).map((f: any) => ({
        title: f.title,
        items: (f.items ?? []).map((it: any) => ({ title: it.title, description: it.description ?? null })),
      })),
      paymentTerms: b.payment_terms,
      cronograma: b.cronograma,
      notIncluded: b.not_included,
      afterApproval: b.after_approval,
      backPhrase: b.back_phrase,
    });

    return { pdfBase64: Buffer.from(pdfBytes).toString("base64") };
  });
