import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { LUZERIA_ORG_ID } from "./api.functions";
import type { BlogBlock } from "./blog-posts";

/** O blog é do Modo Criador em si, não de um cliente — só a própria
 * Luzeria (master, org da plataforma) pode escrever/editar, nunca o admin
 * de uma agência cliente. Mesmo padrão já usado nas outras rotinas restritas
 * à Luzeria em api.functions.ts (isPlatformAdmin). */
async function assertPlatformAdmin(supabase: any, userId: string, orgId: string) {
  if (orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
  const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
  if (!isMaster) throw new Error("Forbidden");
}

const blockSchema: z.ZodType<BlogBlock> = z.union([
  z.object({ type: z.literal("lead"), text: z.string() }),
  z.object({ type: z.literal("p"), text: z.string() }),
  z.object({ type: z.literal("h2"), text: z.string() }),
  z.object({ type: z.literal("h3"), text: z.string() }),
  z.object({ type: z.literal("quote"), text: z.string() }),
  z.object({ type: z.literal("callout"), title: z.string().optional(), text: z.string() }),
  z.object({ type: z.literal("list"), items: z.array(z.string()) }),
  z.object({ type: z.literal("rankedList"), items: z.array(z.object({ title: z.string(), text: z.string() })) }),
]);

export const BLOG_CATEGORIES = [
  { id: "tecnologia", label: "Ferramentas" },
  { id: "meta-instagram", label: "Meta/Instagram" },
  { id: "clientes", label: "Clientes" },
  { id: "dono-de-agencia", label: "Dono de Agência" },
] as const;
export type BlogCategory = (typeof BLOG_CATEGORIES)[number]["id"];
const BLOG_CATEGORY_IDS = BLOG_CATEGORIES.map((c) => c.id) as [BlogCategory, ...BlogCategory[]];

const postFieldsSchema = z.object({
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9-]+$/, "Só letras minúsculas, números e hífen."),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(500),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  readingMinutes: z.number().int().min(1).max(60),
  coverImageUrl: z.string().url().nullable(),
  coverImageAlt: z.string().max(300),
  relatedFeatureHref: z.string().max(200).nullable(),
  relatedFeatureLabel: z.string().max(200).nullable(),
  body: z.array(blockSchema),
  published: z.boolean(),
  category: z.enum(BLOG_CATEGORY_IDS),
});

type AdminBlogPostRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  date: string;
  readingMinutes: number;
  coverImageUrl: string | null;
  coverImageAlt: string;
  relatedFeatureHref: string | null;
  relatedFeatureLabel: string | null;
  body: BlogBlock[];
  published: boolean;
  category: BlogCategory;
  updatedAt: string;
};

function mapRow(r: any): AdminBlogPostRow {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    date: r.date,
    readingMinutes: r.reading_minutes,
    coverImageUrl: r.cover_image_url,
    coverImageAlt: r.cover_image_alt,
    relatedFeatureHref: r.related_feature_href,
    relatedFeatureLabel: r.related_feature_label,
    body: r.body,
    published: r.published,
    category: r.category,
    updatedAt: r.updated_at,
  };
}

export const listBlogPostsAdmin = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.supabase, context.userId, context.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("blog_posts")
      .select("id, slug, title, description, date, reading_minutes, cover_image_url, cover_image_alt, related_feature_href, related_feature_label, body, published, category, updated_at")
      .order("date", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapRow);
  });

export const getBlogPostAdmin = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId, context.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("blog_posts")
      .select("id, slug, title, description, date, reading_minutes, cover_image_url, cover_image_alt, related_feature_href, related_feature_label, body, published, category, updated_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Artigo não encontrado.");
    return mapRow(row);
  });

function toDbPatch(f: z.infer<typeof postFieldsSchema>) {
  return {
    slug: f.slug,
    title: f.title,
    description: f.description,
    date: f.date,
    reading_minutes: f.readingMinutes,
    cover_image_url: f.coverImageUrl,
    cover_image_alt: f.coverImageAlt,
    related_feature_href: f.relatedFeatureHref,
    related_feature_label: f.relatedFeatureLabel,
    body: f.body,
    published: f.published,
    category: f.category,
    updated_at: new Date().toISOString(),
  };
}

export const createBlogPost = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: unknown) => postFieldsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId, context.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("blog_posts")
      .insert(toDbPatch(data))
      .select("id")
      .single();
    if (error) throw new Error(error.code === "23505" ? "Já existe um artigo com esse endereço (slug)." : error.message);
    return { id: row.id as string };
  });

export const updateBlogPost = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: unknown) => postFieldsSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId, context.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...fields } = data;
    const { error } = await supabaseAdmin.from("blog_posts").update(toDbPatch(fields)).eq("id", id);
    if (error) throw new Error(error.code === "23505" ? "Já existe um artigo com esse endereço (slug)." : error.message);
    return { ok: true };
  });

export const deleteBlogPost = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId, context.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("blog_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ PÚBLICO (sem login — usado pelas páginas /blog) ============ */

export type PublicBlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  readingMinutes: number;
  coverImage: { src: string; alt: string } | null;
  relatedFeatureHref: string | null;
  relatedFeatureLabel: string | null;
  category: BlogCategory;
  body: BlogBlock[];
};

function mapPublicRow(r: any): PublicBlogPost {
  return {
    slug: r.slug,
    title: r.title,
    description: r.description,
    date: r.date,
    readingMinutes: r.reading_minutes,
    coverImage: r.cover_image_url ? { src: r.cover_image_url as string, alt: (r.cover_image_alt as string) ?? "" } : null,
    relatedFeatureHref: r.related_feature_href,
    relatedFeatureLabel: r.related_feature_label,
    category: r.category,
    body: r.body,
  };
}

export const getPublishedBlogPosts = createServerFn({ method: "GET" })
  .handler(async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
    const { data, error } = await supabase
      .from("blog_posts")
      .select("slug, title, description, date, reading_minutes, cover_image_url, cover_image_alt, related_feature_href, related_feature_label, category")
      .eq("published", true)
      .order("date", { ascending: false });
    if (error) return [];
    return (data ?? []).map(mapPublicRow);
  });

export const getPublishedBlogPost = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
    const { data: row, error } = await supabase
      .from("blog_posts")
      .select("slug, title, description, date, reading_minutes, cover_image_url, cover_image_alt, related_feature_href, related_feature_label, category, body")
      .eq("slug", data.slug)
      .eq("published", true)
      .maybeSingle();
    if (error || !row) return null;
    return mapPublicRow(row);
  });
