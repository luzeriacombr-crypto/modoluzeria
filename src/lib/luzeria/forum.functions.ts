import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { LUZERIA_ORG_ID } from "./api.functions";

/* ===== FÓRUM ENTRE AGÊNCIAS =====
 * Único ponto do app que atravessa org_id de propósito — todo master de
 * qualquer agência lê e escreve; moderar (fixar/apagar) é exclusivo do
 * platform admin (org Luzeria). Ver supabase/migrations/20260817150000_forum.sql. */

async function assertMaster(supabase: any, userId: string) {
  const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
  if (!isMaster) throw new Error("O Fórum é exclusivo pra masters de cada agência.");
}

function assertPlatformAdmin(orgId: string) {
  if (orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
}

export type ForumCategory = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  sortOrder: number;
};

export const getForumCategories = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<ForumCategory[]> => {
    await assertMaster(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("forum_categories")
      .select("id, name, description, icon, color, sort_order")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((c: any) => ({
      id: c.id, name: c.name, description: c.description, icon: c.icon, color: c.color, sortOrder: c.sort_order,
    }));
  });

export type ForumPost = {
  id: string;
  categoryId: string;
  title: string;
  body: string;
  linkUrl: string | null;
  pinned: boolean;
  replyCount: number;
  createdAt: string;
  authorId: string;
  authorName: string;
  orgId: string;
  orgName: string;
};

export const getForumPosts = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { categoryId?: string | null }) =>
    z.object({ categoryId: z.string().uuid().nullable().optional() }).parse(d))
  .handler(async ({ data, context }): Promise<ForumPost[]> => {
    await assertMaster(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase.rpc("list_forum_posts", {
      _category_id: (data.categoryId ?? null) as any,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id, categoryId: r.category_id, title: r.title, body: r.body, linkUrl: r.link_url,
      pinned: r.pinned, replyCount: r.reply_count, createdAt: r.created_at,
      authorId: r.author_id, authorName: r.author_name ?? "—",
      orgId: r.org_id, orgName: r.org_name ?? "—",
    }));
  });

export type ForumReply = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  orgId: string;
  orgName: string;
};

export const getForumPostDetail = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { postId: string }) => z.object({ postId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ post: ForumPost; replies: ForumReply[] }> => {
    await assertMaster(context.supabase, context.userId);
    const [{ data: postRows, error: postErr }, { data: replyRows, error: replyErr }] = await Promise.all([
      context.supabase.rpc("get_forum_post", { _post_id: data.postId }),
      context.supabase.rpc("list_forum_replies", { _post_id: data.postId }),
    ]);
    if (postErr) throw new Error(postErr.message);
    if (replyErr) throw new Error(replyErr.message);
    const r = (postRows ?? [])[0];
    if (!r) throw new Error("Post não encontrado.");
    return {
      post: {
        id: r.id, categoryId: r.category_id, title: r.title, body: r.body, linkUrl: r.link_url,
        pinned: r.pinned, replyCount: r.reply_count, createdAt: r.created_at,
        authorId: r.author_id, authorName: r.author_name ?? "—",
        orgId: r.org_id, orgName: r.org_name ?? "—",
      },
      replies: (replyRows ?? []).map((x: any) => ({
        id: x.id, body: x.body, createdAt: x.created_at,
        authorId: x.author_id, authorName: x.author_name ?? "—",
        orgId: x.org_id, orgName: x.org_name ?? "—",
      })),
    };
  });

export const createForumPost = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { categoryId: string; title: string; body: string; linkUrl?: string | null }) =>
    z.object({
      categoryId: z.string().uuid(),
      title: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1).max(8000),
      linkUrl: z.string().trim().max(500).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("forum_posts")
      .insert({
        org_id: context.orgId,
        author_id: context.userId,
        category_id: data.categoryId,
        title: data.title,
        body: data.body,
        link_url: data.linkUrl?.trim() || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const createForumReply = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { postId: string; body: string }) =>
    z.object({ postId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);
    const { error } = await context.supabase.from("forum_replies").insert({
      post_id: data.postId,
      org_id: context.orgId,
      author_id: context.userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moderateForumPost = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { postId: string; action: "pin" | "unpin" | "delete" }) =>
    z.object({ postId: z.string().uuid(), action: z.enum(["pin", "unpin", "delete"]) }).parse(d))
  .handler(async ({ data, context }) => {
    assertPlatformAdmin(context.orgId);
    await assertMaster(context.supabase, context.userId);
    const patch =
      data.action === "pin" ? { pinned: true } :
      data.action === "unpin" ? { pinned: false } :
      { deleted_at: new Date().toISOString() };
    const { error } = await context.supabase.from("forum_posts").update(patch).eq("id", data.postId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moderateForumReply = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { replyId: string }) => z.object({ replyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    assertPlatformAdmin(context.orgId);
    await assertMaster(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("forum_replies")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.replyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
