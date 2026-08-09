import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { LUZERIA_ORG_ID } from "./api.functions";

const BACKGROUND = z.enum(["white", "gray", "blue", "blue2"]);
const SIZE = z.enum(["compact", "normal", "spacious"]).optional();
const BACKGROUND_IMAGE = z.string().max(2000).optional().nullable();

const imageSpecSchema = z.object({
  id: z.string().max(60),
  source: z.enum(["upload", "builtin"]),
  url: z.string().max(2000).optional(),
  builtinKey: z.string().max(60).optional(),
  floating: z.boolean(),
  floatVariant: z.enum(["a", "b", "c"]).optional(),
  widthPct: z.number().min(5).max(100),
  top: z.number().min(-20).max(120),
  left: z.number().min(-20).max(120),
  z: z.number().min(0).max(10),
});

const heroContentSchema = z.object({
  eyebrowIcon: z.string().max(40),
  eyebrowLabel: z.string().max(120),
  titleLine1: z.string().max(120),
  titleLine2: z.string().max(120),
  titleAccentLine1: z.string().max(120),
  titleAccentLine2: z.string().max(120),
  subtitle: z.string().max(600),
  ctaLabel: z.string().max(60),
  images: z.array(imageSpecSchema).max(4),
});

const bulletListContentSchema = z.object({
  heading: z.string().max(160),
  icon: z.enum(["check", "x"]),
  items: z.array(z.string().max(300)).max(20),
  closingTextPlain: z.string().max(200).optional(),
  closingTextAccent: z.string().max(200).optional(),
  background: BACKGROUND,
  backgroundImage: BACKGROUND_IMAGE,
  size: SIZE,
});

const stepsContentSchema = z.object({
  heading: z.string().max(160),
  background: BACKGROUND,
  backgroundImage: BACKGROUND_IMAGE,
  size: SIZE,
  items: z.array(z.object({
    icon: z.string().max(40),
    number: z.string().max(10),
    title: z.string().max(120),
    description: z.string().max(300),
  })).max(12),
});

const featureContentSchema = z.object({
  eyebrowIcon: z.string().max(40),
  eyebrowLabel: z.string().max(120),
  title: z.string().max(200),
  description: z.string().max(600),
  background: BACKGROUND,
  backgroundImage: BACKGROUND_IMAGE,
  size: SIZE,
  reverse: z.boolean(),
  images: z.array(imageSpecSchema).max(4),
});

const galleryContentSchema = z.object({
  heading: z.string().max(160),
  background: BACKGROUND,
  backgroundImage: BACKGROUND_IMAGE,
  size: SIZE,
  images: z.array(imageSpecSchema).max(12),
});

const textBlurbContentSchema = z.object({
  eyebrowIcon: z.string().max(40),
  eyebrowLabel: z.string().max(120),
  paragraph: z.string().max(800),
  background: BACKGROUND,
  backgroundImage: BACKGROUND_IMAGE,
  size: SIZE,
});

// Uma única imagem de ponta a ponta na horizontal — sem texto, sem container
// centralizado. `background` serve só de placeholder enquanto nenhuma imagem
// foi enviada ainda.
const imageBannerContentSchema = z.object({
  imageUrl: z.string().max(2000).optional().nullable(),
  alt: z.string().max(200).optional(),
  background: BACKGROUND,
  size: SIZE,
});

const CONTENT_BY_TYPE = {
  hero: heroContentSchema,
  bullet_list: bulletListContentSchema,
  steps: stepsContentSchema,
  feature: featureContentSchema,
  gallery: galleryContentSchema,
  text_blurb: textBlurbContentSchema,
  image_banner: imageBannerContentSchema,
} as const;

const blockInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hero"), content: heroContentSchema }),
  z.object({ type: z.literal("bullet_list"), content: bulletListContentSchema }),
  z.object({ type: z.literal("steps"), content: stepsContentSchema }),
  z.object({ type: z.literal("feature"), content: featureContentSchema }),
  z.object({ type: z.literal("gallery"), content: galleryContentSchema }),
  z.object({ type: z.literal("text_blurb"), content: textBlurbContentSchema }),
  z.object({ type: z.literal("image_banner"), content: imageBannerContentSchema }),
]);

export type SalesPageBlockType = keyof typeof CONTENT_BY_TYPE;

export type SalesPageBlock = {
  id: string;
  type: SalesPageBlockType;
  content: any;
  draftContent: any | null;
  sortOrder: number;
  isVisible: boolean;
};

function mapRow(r: any): SalesPageBlock {
  return {
    id: r.id, type: r.type, content: r.content, draftContent: r.draft_content ?? null,
    sortOrder: r.sort_order, isVisible: r.is_visible,
  };
}

/** Público — visitante deslogado do site de vendas. Mesmo padrão de
 * getPublicPlans/getPublicFeed: cliente anon novo, sem middleware,
 * a RLS ("anon read visible blocks") é quem garante que só vem o visível. */
export const getSalesPageBlocks = createServerFn({ method: "GET" })
  .handler(async (): Promise<SalesPageBlock[]> => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
    const { data, error } = await supabase
      .from("sales_page_blocks")
      .select("id, type, content, sort_order, is_visible")
      .eq("is_visible", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapRow);
  });

async function assertLuzeriaMaster(context: any) {
  if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
  const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
  if (!isMaster) throw new Error("Forbidden");
}

export const listSalesPageBlocksAdmin = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<SalesPageBlock[]> => {
    await assertLuzeriaMaster(context);
    const { data, error } = await context.supabase
      .from("sales_page_blocks")
      .select("id, type, content, draft_content, sort_order, is_visible")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapRow);
  });

export const createSalesPageBlock = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: z.infer<typeof blockInputSchema>) => blockInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertLuzeriaMaster(context);
    if (data.type === "hero") throw new Error("Já existe um bloco hero — não é possível criar outro.");
    const { data: maxRow } = await context.supabase
      .from("sales_page_blocks")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (maxRow?.sort_order ?? -1) + 1;
    const { data: inserted, error } = await context.supabase
      .from("sales_page_blocks")
      .insert({ type: data.type, content: data.content, sort_order: nextOrder, updated_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });

/** Edições de conteúdo (texto/imagem) gravam em draft_content — só viram
 * públicas quando publishSalesPageBlocks copia pra content. isVisible
 * continua imediato (não é "conteúdo", é estrutura da página). */
export const updateSalesPageBlock = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; type: SalesPageBlockType; content: any; isVisible?: boolean }) => {
    const schema = CONTENT_BY_TYPE[d.type as SalesPageBlockType];
    if (!schema) throw new Error("Tipo de bloco inválido.");
    return {
      id: z.string().uuid().parse(d.id),
      type: d.type,
      content: schema.parse(d.content),
      isVisible: z.boolean().optional().parse(d.isVisible),
    };
  })
  .handler(async ({ data, context }) => {
    await assertLuzeriaMaster(context);
    const patch: { draft_content: any; updated_by: string; is_visible?: boolean } = { draft_content: data.content, updated_by: context.userId };
    if (data.isVisible !== undefined) patch.is_visible = data.isVisible;
    const { error } = await context.supabase.from("sales_page_blocks").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Copia draft_content -> content em todos os blocos com rascunho pendente,
 * publicando de uma vez tudo que foi editado desde a última publicação. */
export const publishSalesPageBlocks = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    await assertLuzeriaMaster(context);
    const { data, error } = await context.supabase
      .from("sales_page_blocks")
      .select("id, draft_content")
      .not("draft_content", "is", null);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const { error: updErr } = await context.supabase
        .from("sales_page_blocks")
        .update({ content: row.draft_content, draft_content: null, updated_by: context.userId })
        .eq("id", row.id);
      if (updErr) throw new Error(updErr.message);
    }
    return { ok: true, count: (data ?? []).length };
  });

/** Zera draft_content em todos os blocos com rascunho pendente, descartando
 * as edições de texto/imagem não publicadas (volta a mostrar `content`). */
export const discardSalesPageDraft = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    await assertLuzeriaMaster(context);
    const { data, error } = await context.supabase
      .from("sales_page_blocks")
      .update({ draft_content: null })
      .not("draft_content", "is", null)
      .select("id");
    if (error) throw new Error(error.message);
    return { ok: true, count: (data ?? []).length };
  });

export const deleteSalesPageBlock = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertLuzeriaMaster(context);
    const { data: row, error: fetchError } = await context.supabase
      .from("sales_page_blocks").select("type").eq("id", data.id).single();
    if (fetchError) throw new Error(fetchError.message);
    if (row.type === "hero") throw new Error("O bloco hero não pode ser removido.");
    const { error } = await context.supabase.from("sales_page_blocks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderSalesPageBlocks = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { orderedIds: string[] }) =>
    z.object({ orderedIds: z.array(z.string().uuid()).min(1).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertLuzeriaMaster(context);
    for (let i = 0; i < data.orderedIds.length; i++) {
      const { error } = await context.supabase
        .from("sales_page_blocks")
        .update({ sort_order: i + 1 })
        .eq("id", data.orderedIds[i]);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
