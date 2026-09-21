import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { LUZERIA_ORG_ID } from "./api.functions";
import { mergeLanding, type LandingContent } from "./sales-landing-content";

/** Conteúdo da página de vendas em site_tracking_settings (tabela chave/valor
 * que já existe): 'sales_landing' = publicado, 'sales_landing_draft' =
 * rascunho. Edições gravam no rascunho; só "Publicar" copia pro publicado. */
const PUBLISHED_KEY = "sales_landing";
const DRAFT_KEY = "sales_landing_draft";

const str = (n: number) => z.string().max(n);
const img = z.string().max(2000).nullable();

const contentSchema = z.object({
  hero: z.object({
    badge: str(30), pill: str(120), title: str(200), titleAccent: str(200), titleSize: z.number().min(28).max(90), subtitle: str(600),
    ctaLabel: str(60), ctaSecondaryLabel: str(60), trust: z.array(str(80)).max(6),
    chipTitle: str(60), chipSub: str(80), chip2Title: str(60), chip2Sub: str(80), image: img,
  }),
  numbers: z.object({ clientsLabel: str(120), deliveriesLabel: str(120), trialValue: str(40), trialLabel: str(120) }),
  beforeAfter: z.object({
    eyebrow: str(80), heading: str(200),
    rows: z.array(z.object({ icon: str(30), before: str(200), title: str(120), desc: str(300) })).max(10),
  }),
  features: z.object({
    eyebrow: str(80), heading: str(200), subheading: str(300),
    tabs: z.array(z.object({
      id: str(40), label: str(60),
      feats: z.array(z.object({ icon: str(30), title: str(120), desc: str(400), chip: str(60) })).max(6),
      image: img, image2: img,
    })).max(8),
  }),
  ai: z.object({
    eyebrow: str(80), heading: str(200),
    steps: z.array(z.object({ bold: str(160), rest: str(300) })).max(8),
    ctaLabel: str(60), note: str(300),
  }),
  sections: z.object({ order: z.array(str(30)).max(12), hidden: z.array(str(30)).max(12) }),
});

async function assertLuzeriaMaster(context: any) {
  if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
  const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
  if (!isMaster) throw new Error("Forbidden");
}

async function readKey(supabase: any, key: string): Promise<unknown | null> {
  const { data, error } = await supabase.from("site_tracking_settings").select("value").eq("key", key).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.value ?? null;
}

/** Público — o site de vendas. Sem nada salvo, devolve o padrão. */
export const getSalesLanding = createServerFn({ method: "GET" })
  .handler(async (): Promise<LandingContent> => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
    return mergeLanding(await readKey(supabase, PUBLISHED_KEY));
  });

/** Editor — rascunho (se houver) e o publicado. */
export const getSalesLandingAdmin = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<{ published: LandingContent; draft: LandingContent | null }> => {
    await assertLuzeriaMaster(context);
    const [pub, draft] = await Promise.all([
      readKey(context.supabase, PUBLISHED_KEY), readKey(context.supabase, DRAFT_KEY),
    ]);
    return { published: mergeLanding(pub), draft: draft ? mergeLanding(draft) : null };
  });

export const saveSalesLandingDraft = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { content: unknown }) => ({ content: contentSchema.parse(d.content) }))
  .handler(async ({ data, context }) => {
    await assertLuzeriaMaster(context);
    const { error } = await (context.supabase as any).from("site_tracking_settings").upsert({
      key: DRAFT_KEY, value: data.content, updated_by: context.userId, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const publishSalesLanding = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    await assertLuzeriaMaster(context);
    const draft = await readKey(context.supabase, DRAFT_KEY);
    if (!draft) return { ok: true, published: false };
    const { error } = await (context.supabase as any).from("site_tracking_settings").upsert({
      key: PUBLISHED_KEY, value: draft, updated_by: context.userId, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    const { error: delErr } = await (context.supabase as any).from("site_tracking_settings").delete().eq("key", DRAFT_KEY);
    if (delErr) throw new Error(delErr.message);
    return { ok: true, published: true };
  });

export const discardSalesLandingDraft = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    await assertLuzeriaMaster(context);
    const { error } = await (context.supabase as any).from("site_tracking_settings").delete().eq("key", DRAFT_KEY);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
