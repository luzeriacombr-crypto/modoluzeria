import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";
import type { Client, ContentItem, ContentType, MonthData, Profile, Role, Status } from "./types";
import { isActivityType, STATUS_META } from "./types";

/* ============== PROFILES & ROLES ============== */

/** Generate signed read URLs for avatar storage paths (1 year). */
async function signAvatarPaths(supabase: any, paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  const result = new Map<string, string>();
  if (unique.length === 0) return result;
  const { data } = await supabase.storage.from("avatars").createSignedUrls(unique, 60 * 60 * 24 * 365);
  (data ?? []).forEach((r: any) => {
    if (r?.path && r?.signedUrl) result.set(r.path, r.signedUrl);
  });
  return result;
}

/** Generate signed read URLs for reel-cover storage paths (1 year). */
async function signCoverPaths(supabase: any, paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  const result = new Map<string, string>();
  if (unique.length === 0) return result;
  const { data } = await supabase.storage.from("reel-covers").createSignedUrls(unique, 60 * 60 * 24 * 365);
  (data ?? []).forEach((r: any) => {
    if (r?.path && r?.signedUrl) result.set(r.path, r.signedUrl);
  });
  return result;
}

export const listProfiles = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data: profiles, error } = await context.supabase
      .from("profiles")
      .select("id, name, color, icon, active, avatar_url, onboarded_at, tour_completed_at")
      .order("name");
    if (error) throw new Error(error.message);
    const { data: roles } = await context.supabase.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, Role>();
    (roles ?? []).forEach((r) => roleMap.set(r.user_id, r.role as Role));
    // Emails are only readable by admins via a SECURITY DEFINER RPC.
    const emailMap = new Map<string, string>();
    const { data: emailRows } = await context.supabase.rpc("admin_list_profile_emails");
    (emailRows ?? []).forEach((r: any) => emailMap.set(r.id, r.email));
    const signed = await signAvatarPaths(context.supabase, (profiles ?? []).map((p: any) => p.avatar_url));
    return (profiles ?? []).map<Profile>((p: any) => ({
      id: p.id,
      email: emailMap.get(p.id) ?? "",
      name: p.name,
      color: p.color,
      icon: p.icon,
      active: p.active,
      role: roleMap.get(p.id) ?? "member",
      avatarPath: p.avatar_url ?? null,
      avatarUrl: p.avatar_url ? signed.get(p.avatar_url) ?? null : null,
      onboardedAt: p.onboarded_at ?? null,
      tourCompletedAt: p.tour_completed_at ?? null,
    }));
  });

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id, name, color, icon, active, avatar_url, onboarded_at, tour_completed_at")
      .eq("id", context.userId).maybeSingle();
    const { data: roleRow } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).maybeSingle();
    if (!profile) return null;
    const { data: myEmail } = await context.supabase.rpc("get_my_email");
    const signed = await signAvatarPaths(context.supabase, [profile.avatar_url]);
    return {
      id: profile.id, email: (myEmail as string | null) ?? "", name: profile.name,
      color: profile.color, icon: profile.icon, active: profile.active,
      role: (roleRow?.role ?? "member") as Role,
      avatarPath: profile.avatar_url ?? null,
      avatarUrl: profile.avatar_url ? signed.get(profile.avatar_url) ?? null : null,
      onboardedAt: profile.onboarded_at ?? null,
      tourCompletedAt: (profile as any).tour_completed_at ?? null,
    } satisfies Profile;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { name?: string; color?: string; icon?: string | null; avatarPath?: string | null; onboarded?: boolean; tourCompleted?: boolean }) =>
    z.object({
      name: z.string().trim().min(1).max(80).optional(),
      color: z.string().trim().max(32).optional(),
      icon: z.string().max(64).nullable().optional(),
      avatarPath: z.string().trim().max(400).nullable().optional(),
      onboarded: z.boolean().optional(),
      tourCompleted: z.boolean().optional(),
    }).strict().parse(d))
  .handler(async ({ data, context }) => {
    const update: {
      name?: string; color?: string; icon?: string | null;
      avatar_url?: string | null; onboarded_at?: string;
      tour_completed_at?: string | null;
    } = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.color !== undefined) update.color = data.color;
    if (data.icon !== undefined) update.icon = data.icon;
    if (data.avatarPath !== undefined) update.avatar_url = data.avatarPath;
    if (data.onboarded) update.onboarded_at = new Date().toISOString();
    if (data.tourCompleted === true) update.tour_completed_at = new Date().toISOString();
    if (data.tourCompleted === false) update.tour_completed_at = null;
    if (Object.keys(update).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("profiles").update(update).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId: string; role: Role }) =>
    z.object({ userId: z.string().uuid(), role: z.enum(["master","setor","member"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    await context.supabase.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await context.supabase.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId: string; active: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    const { error } = await context.supabase.from("profiles").update({ active: data.active }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function callAdminEdgeFn(
  operation: string,
  params: Record<string, unknown>,
): Promise<any> {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("Sessão inválida.");
  const url = `${process.env.SUPABASE_URL}/functions/v1/admin-auth-operations`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": authHeader,
      "apikey": process.env.SUPABASE_PUBLISHABLE_KEY!,
    },
    body: JSON.stringify({ operation, ...params }),
  });
  const json = await res.json() as any;
  if (!json.success) throw new Error(json.error || "Erro na operação de admin.");
  return json.data;
}

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("Não é possível remover a si mesmo.");
    await callAdminEdgeFn("deleteUser", { targetUserId: data.userId });
    return { ok: true };
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { email: string; password: string; name: string; role: Role }) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().min(1).max(80),
      role: z.enum(["master","setor","member"]),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const result = await callAdminEdgeFn("createUser", {
      email: data.email,
      password: data.password,
      name: data.name,
      role: data.role,
    });
    return { ok: true, id: result?.id };
  });

export const adminSendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const result = await callAdminEdgeFn("sendPasswordReset", {
      targetUserId: data.userId,
    });
    return { ok: true, email: result?.email };
  });

/* ============== CLIENTS ============== */

export const updateMyAccount = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { name?: string; email?: string; password?: string }) =>
    z.object({
      name: z.string().trim().min(1).max(80).optional(),
      email: z.string().trim().email().max(255).optional(),
      password: z.string().min(6).max(128).optional(),
    }).strict().parse(d))
  .handler(async ({ data, context }) => {
    if (!data.name && !data.email && !data.password) return { ok: true };
    await callAdminEdgeFn("updateUser", {
      targetUserId: context.userId,
      email: data.email,
      password: data.password,
      name: data.name,
    });
    return { ok: true };
  });

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("clients")
      .select("id, name, color, icon, favorite, archived, category, niche, posts_per_week, reels_per_week, fixed_responsible_id, review_day, notes, created_at, description, photo_url")
      .order("name");
    if (error) throw new Error(error.message);
    const photoPaths = (data ?? []).map((c: any) => c.photo_url).filter(Boolean) as string[];
    const signedPhotos = await signAvatarPaths(context.supabase, photoPaths);
    return (data ?? []).map<Client>((c: any) => ({
      id: c.id, name: c.name, color: c.color, icon: c.icon,
      favorite: c.favorite, archived: c.archived,
      category: c.category ?? "Social Media",
      customFields: {
        niche: c.niche ?? "",
        postsPerWeek: c.posts_per_week ?? 0,
        reelsPerWeek: c.reels_per_week ?? 0,
        fixedResponsibleId: c.fixed_responsible_id,
        reviewDay: c.review_day ?? "",
        notes: c.notes ?? "",
      },
      createdAt: c.created_at,
      description: c.description ?? null,
      photoPath: c.photo_url ?? null,
      photoUrl: c.photo_url ? (signedPhotos.get(c.photo_url) ?? null) : null,
    }));
  });

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nextMonthKey(key: string) {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m, 1));
}

async function seedMonth(supabase: any, clientId: string, key: string) {
  const { data: month, error: mErr } = await supabase
    .from("months").insert({ client_id: clientId, key }).select().single();
  if (mErr) throw new Error(mErr.message);
  const items = [];
  for (let i = 1; i <= 6; i++) items.push({ month_id: month.id, type: "post", idx: i, title: `Post ${i}` });
  for (let i = 1; i <= 6; i++) items.push({ month_id: month.id, type: "reel", idx: i, title: `Reels ${i}` });
  const { error: iErr } = await supabase.from("content_items").insert(items);
  if (iErr) throw new Error(iErr.message);
  return month;
}

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { name: string; category?: string; color?: string; icon?: string | null }) =>
    z.object({
      name: z.string().trim().min(1).max(80),
      category: z.string().trim().min(1).max(40).optional(),
      color: z.string().trim().optional(),
      icon: z.string().nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const insert: any = { name: data.name };
    if (data.category) insert.category = data.category;
    if (data.color) insert.color = data.color;
    if (data.icon !== undefined) insert.icon = data.icon;
    const { data: client, error } = await context.supabase
      .from("clients").insert(insert).select().single();
    if (error) throw new Error(error.message);
    if ((data.category ?? "Social Media") !== "Avulsos") {
      const key = monthKey(new Date());
      await seedMonth(context.supabase, client.id, key);
    } else {
      // Avulsos: create empty month container so items can be added.
      await context.supabase.from("months").insert({ client_id: client.id, key: monthKey(new Date()) });
    }
    return { id: client.id };
  });

export const updateClient = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; patch: Record<string, any> }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("clients").update(data.patch as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("clients").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function computeLateDays(dueDate: string | null | undefined, finalizedAt: string | null | undefined): number {
  if (!dueDate || !finalizedAt) return 0;
  // dueDate is YYYY-MM-DD; treat as end-of-day UTC.
  const due = new Date(dueDate + "T23:59:59Z").getTime();
  const fin = new Date(finalizedAt).getTime();
  if (Number.isNaN(due) || Number.isNaN(fin) || fin <= due) return 0;
  return Math.ceil((fin - due) / 86400000);
}

export const duplicateMonth = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; fromKey: string }) => d)
  .handler(async ({ data, context }) => {
    const newKey = nextMonthKey(data.fromKey);
    const { data: exists } = await context.supabase
      .from("months").select("id").eq("client_id", data.clientId).eq("key", newKey).maybeSingle();
    if (exists) return { key: newKey };
    const { data: fromMonth } = await context.supabase
      .from("months").select("id").eq("client_id", data.clientId).eq("key", data.fromKey).maybeSingle();
    const { data: newMonth, error: mErr } = await context.supabase
      .from("months").insert({ client_id: data.clientId, key: newKey }).select().single();
    if (mErr) throw new Error(mErr.message);
    if (fromMonth) {
      const { data: oldItems } = await context.supabase
        .from("content_items").select("type, idx").eq("month_id", fromMonth.id);
      if (oldItems?.length) {
        // Copy only the QUANTITY per type (post/reel/outros).
        // No titles, no assignees, no due dates, no comments, no files.
        const counts: Record<string, number> = {};
        oldItems.forEach((it: any) => { counts[it.type] = (counts[it.type] ?? 0) + 1; });
        const rows: any[] = [];
        (["post", "reel", "outros"] as const).forEach((t) => {
          const n = counts[t] ?? 0;
          const status: Status = isActivityType(t) ? "PENDENTE" : "PLANEJAMENTO";
          for (let i = 1; i <= n; i++) {
            rows.push({ month_id: newMonth.id, type: t, idx: i, title: "", status });
          }
        });
        if (rows.length) {
          const { error: insErr } = await context.supabase.from("content_items").insert(rows);
          if (insErr) throw new Error(insErr.message);
        }
      }
    }
    // If there was nothing to duplicate from, leave the new month empty —
    // fabricating placeholder content here was the source of a real bug.
    return { key: newKey };
  });

export const listMonthKeys = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: months } = await context.supabase
      .from("months").select("key").eq("client_id", data.clientId).order("key");
    return (months ?? []).map((m) => m.key);
  });

export const getMonth = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; key: string }) => d)
  .handler(async ({ data, context }): Promise<MonthData | null> => {
    // Reading a month must never have side effects — creating it (empty or
    // seeded) is an explicit action (addContentItem, duplicateMonth), not
    // something that should happen just because someone viewed the page.
    const { data: month } = await context.supabase
      .from("months").select("id, key").eq("client_id", data.clientId).eq("key", data.key).maybeSingle();
    if (!month) return null;
    const { data: items } = await context.supabase
      .from("content_items")
      .select("id, type, idx, title, status, copy, drive_link, caption, updated_at, reel_type, editor_id, due_date, scheduled_at, started_at, finished_at, blocked_reason, checklist, rework_count, quality_rating, feed_order, cover_path, cover_source")
      .eq("month_id", month.id).order("type").order("idx");
    const itemIds = (items ?? []).map((it: any) => it.id);
    const [{ data: assignees }, { data: comments }] = await Promise.all([
      context.supabase.from("item_assignees").select("item_id, user_id").in("item_id", itemIds),
      context.supabase.from("comments").select("id, item_id, author_id, text, is_system, created_at").in("item_id", itemIds).order("created_at"),
    ]);
    const itemAssignees = new Map<string, string[]>();
    (assignees ?? []).forEach((a) => {
      const arr = itemAssignees.get(a.item_id) ?? [];
      arr.push(a.user_id); itemAssignees.set(a.item_id, arr);
    });
    const itemComments = new Map<string, ContentItem["comments"]>();
    (comments ?? []).forEach((c) => {
      const arr = itemComments.get(c.item_id) ?? [];
      arr.push({ id: c.id, text: c.text, authorId: c.author_id, createdAt: c.created_at, system: c.is_system });
      itemComments.set(c.item_id, arr);
    });
    const mapped = (items ?? []).map<ContentItem>((it) => ({
      id: it.id, type: it.type as ContentType, idx: it.idx, title: it.title,
      status: it.status as Status, copy: it.copy, driveLink: it.drive_link,
      caption: ((it as any).caption ?? "") as string,
      assigneeIds: itemAssignees.get(it.id) ?? [],
      comments: itemComments.get(it.id) ?? [],
      updatedAt: it.updated_at,
      reelType: ((it as any).reel_type ?? null) as any,
      editorId: ((it as any).editor_id ?? null) as any,
      dueDate: ((it as any).due_date ?? null) as any,
      scheduledAt: ((it as any).scheduled_at ?? null) as any,
      startedAt: ((it as any).started_at ?? null) as any,
      finishedAt: ((it as any).finished_at ?? null) as any,
      blockedReason: ((it as any).blocked_reason ?? null) as any,
      checklist: ((it as any).checklist ?? []) as any,
      reworkCount: ((it as any).rework_count ?? 0) as any,
      qualityRating: ((it as any).quality_rating ?? null) as any,
      feedOrder: ((it as any).feed_order ?? null) as any,
    }));
    const coverPaths = (items ?? []).map((it: any) => it.cover_path).filter(Boolean);
    const signedCovers = await signCoverPaths(context.supabase, coverPaths);
    mapped.forEach((m, idx) => {
      const raw = (items ?? [])[idx] as any;
      m.coverPath = raw?.cover_path ?? null;
      m.coverSource = (raw?.cover_source ?? null) as any;
      m.coverUrl = raw?.cover_path ? signedCovers.get(raw.cover_path) ?? null : null;
    });
    return {
      id: month.id, key: month.key,
      posts: mapped.filter((i) => i.type === "post"),
      reels: mapped.filter((i) => i.type === "reel"),
      outros: mapped.filter((i) => i.type === "outros"),
      gravacoes: mapped.filter((i) => i.type === "gravacao"),
      roteiros: mapped.filter((i) => i.type === "roteiro"),
      sistemas: mapped.filter((i) => i.type === "sistema"),
    };
  });

/* ============== ITEMS ============== */

export const updateItem = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: {
    id: string;
    patch: {
      title?: string; copy?: string; caption?: string; drive_link?: string;
      reel_type?: string | null; editor_id?: string | null;
      due_date?: string | null; scheduled_at?: string | null; blocked_reason?: string | null;
    };
  }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("content_items").update(data.patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateFeedOrder = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { monthId: string; orderedItemIds: string[] }) =>
    z.object({
      monthId: z.string().uuid(),
      orderedItemIds: z.array(z.string().uuid()).max(500),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Apenas admins podem reordenar o feed.");
    // Update each item's feed_order to its position in the array.
    // Items not in the list are reset to null so they fall to the end.
    const { data: existing } = await context.supabase
      .from("content_items").select("id").eq("month_id", data.monthId);
    const allIds = (existing ?? []).map((x: any) => x.id);
    const ordered = data.orderedItemIds.filter((id) => allIds.includes(id));
    const missing = allIds.filter((id) => !ordered.includes(id));
    const rows = [
      ...ordered.map((id, pos) => ({ id, feed_order: pos })),
      ...missing.map((id) => ({ id, feed_order: null })),
    ];
    if (rows.length) {
      const { error } = await context.supabase.rpc("update_feed_order", { p_updates: rows });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/* ============== ITEM COVER (Reels) ============== */

async function assertCanEditCover(supabase: any, userId: string, itemId: string) {
  const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
  if (isAdmin) return;
  const { data: row } = await supabase
    .from("item_assignees").select("user_id").eq("item_id", itemId).eq("user_id", userId).maybeSingle();
  if (!row) throw new Error("Sem permissão para editar a capa deste item.");
}

export const setItemCover = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; coverPath: string | null; coverSource: "frame" | "upload" | null }) =>
    z.object({
      itemId: z.string().uuid(),
      coverPath: z.string().trim().max(400).nullable(),
      coverSource: z.enum(["frame", "upload"]).nullable(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanEditCover(context.supabase, context.userId, data.itemId);
    // Fetch previous cover to clean up old file
    const { data: prev } = await context.supabase
      .from("content_items").select("cover_path").eq("id", data.itemId).maybeSingle();
    const prevPath = (prev as any)?.cover_path as string | null;
    const { error } = await context.supabase
      .from("content_items")
      .update({ cover_path: data.coverPath, cover_source: data.coverSource })
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    if (prevPath && prevPath !== data.coverPath) {
      await context.supabase.storage.from("reel-covers").remove([prevPath]).catch(() => {});
    }
    return { ok: true };
  });

export const uploadItemCover = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; base64: string; contentType: string; source: "frame" | "upload" }) =>
    z.object({
      itemId: z.string().uuid(),
      base64: z.string().min(1).max(15_000_000), // ~10 MB image
      contentType: z.string().min(3).max(80),
      source: z.enum(["frame", "upload"]),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanEditCover(context.supabase, context.userId, data.itemId);
    const ext = data.contentType.includes("png") ? "png"
      : data.contentType.includes("webp") ? "webp"
      : "jpg";
    const path = `${data.itemId}/${Date.now()}.${ext}`;
    const bin = Buffer.from(data.base64, "base64");
    const { error: upErr } = await context.supabase.storage
      .from("reel-covers")
      .upload(path, bin, { contentType: data.contentType, upsert: false });
    if (upErr) throw new Error(upErr.message);

    // Remove previous cover if exists
    const { data: prev } = await context.supabase
      .from("content_items").select("cover_path").eq("id", data.itemId).maybeSingle();
    const prevPath = (prev as any)?.cover_path as string | null;

    const { error } = await context.supabase
      .from("content_items")
      .update({ cover_path: path, cover_source: data.source })
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);

    if (prevPath && prevPath !== path) {
      await context.supabase.storage.from("reel-covers").remove([prevPath]).catch(() => {});
    }

    const { data: signed } = await context.supabase.storage
      .from("reel-covers").createSignedUrl(path, 60 * 60 * 24 * 365);
    return { ok: true, coverPath: path, coverUrl: signed?.signedUrl ?? null };
  });

/* ============== CLIENT FICHA ============== */

export const getClientFicha = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) =>
    z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });

    const { data: client } = await context.supabase
      .from("clients").select("description").eq("id", data.clientId).maybeSingle();

    const [linksRes, contactsRes, secretsRes] = await Promise.all([
      context.supabase.from("client_links")
        .select("id, client_id, label, url, position")
        .eq("client_id", data.clientId).order("position"),
      context.supabase.from("client_contacts")
        .select("id, client_id, name, role, email, phone, notes, position")
        .eq("client_id", data.clientId).order("position"),
      isAdmin
        ? context.supabase.from("client_secrets")
            .select("id, client_id, label, value, notes")
            .eq("client_id", data.clientId).order("label")
        : Promise.resolve({ data: [] }),
    ]);

    // ---- metrics ----
    const { data: months } = await context.supabase
      .from("months").select("id").eq("client_id", data.clientId);
    const monthIds = (months ?? []).map((m: any) => m.id);
    let totalItems = 0, finalized = 0, blocked = 0;
    let avgLeadTimeHours: number | null = null;
    let lastDeliveryAt: string | null = null;
    if (monthIds.length) {
      const { data: items } = await context.supabase
        .from("content_items")
        .select("status, started_at, finished_at")
        .in("month_id", monthIds);
      totalItems = (items ?? []).length;
      let sumHours = 0, leadCount = 0;
      (items ?? []).forEach((it: any) => {
        if (it.status === "PRONTO_PARA_PUBLICAR") {
          finalized++;
          if (it.finished_at) {
            if (!lastDeliveryAt || it.finished_at > lastDeliveryAt) lastDeliveryAt = it.finished_at;
          }
          if (it.started_at && it.finished_at) {
            const diffMs = new Date(it.finished_at).getTime() - new Date(it.started_at).getTime();
            if (diffMs > 0) { sumHours += diffMs / 3_600_000; leadCount++; }
          }
        }
        if (it.status === "TRAVADO") blocked++;
      });
      if (leadCount > 0) avgLeadTimeHours = Math.round((sumHours / leadCount) * 10) / 10;
    }

    return {
      description: (client as any)?.description ?? "",
      links: (linksRes.data ?? []).map((l: any) => ({
        id: l.id, clientId: l.client_id, label: l.label, url: l.url, sortOrder: l.position,
      })),
      contacts: (contactsRes.data ?? []).map((c: any) => ({
        id: c.id, clientId: c.client_id, name: c.name, role: c.role,
        email: c.email, phone: c.phone, notes: c.notes, sortOrder: c.position,
      })),
      secrets: (secretsRes.data ?? []).map((s: any) => ({
        id: s.id, clientId: s.client_id, label: s.label, value: s.value, notes: s.notes,
      })),
      metrics: { totalItems, finalized, blocked, avgLeadTimeHours, lastDeliveryAt },
    };
  });

export const upsertClientLink = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id?: string; clientId: string; label: string; url: string; sortOrder?: number }) =>
    z.object({
      id: z.string().uuid().optional(),
      clientId: z.string().uuid(),
      label: z.string().trim().min(1).max(120),
      url: z.string().trim().min(1).max(2000),
      sortOrder: z.number().int().min(0).max(9999).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const db: any = context.supabase;
    if (data.id) {
      const { error } = await db.from("client_links")
        .update({ label: data.label, url: data.url, position: data.sortOrder ?? 0 })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("client_links")
        .insert({ client_id: data.clientId, label: data.label, url: data.url, position: data.sortOrder ?? 0 });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteClientLink = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase.from("client_links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertClientContact = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: {
    id?: string; clientId: string; name: string;
    role?: string | null; email?: string | null; phone?: string | null; notes?: string | null;
    sortOrder?: number;
  }) => z.object({
    id: z.string().uuid().optional(),
    clientId: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    role: z.string().trim().max(120).nullable().optional(),
    email: z.string().trim().max(200).nullable().optional(),
    phone: z.string().trim().max(60).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const db: any = context.supabase;
    const payload: any = {
      name: data.name, role: data.role ?? null, email: data.email ?? null,
      phone: data.phone ?? null, notes: data.notes ?? null, position: data.sortOrder ?? 0,
    };
    if (data.id) {
      const { error } = await db.from("client_contacts").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      payload.client_id = data.clientId;
      const { error } = await db.from("client_contacts").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteClientContact = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase.from("client_contacts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertClientSecret = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id?: string; clientId: string; label: string; value: string; notes?: string | null }) =>
    z.object({
      id: z.string().uuid().optional(),
      clientId: z.string().uuid(),
      label: z.string().trim().min(1).max(120),
      value: z.string().min(1).max(2000),
      notes: z.string().trim().max(2000).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const db: any = context.supabase;
    if (data.id) {
      const { error } = await db.from("client_secrets")
        .update({ label: data.label, value: data.value, notes: data.notes ?? null })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("client_secrets")
        .insert({ client_id: data.clientId, label: data.label, value: data.value, notes: data.notes ?? null });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteClientSecret = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase.from("client_secrets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setItemStatus = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; status: Status }) => d)
  .handler(async ({ data, context }) => {
    // Fetch current status + assignees before changing
    const { data: current } = await context.supabase
      .from("content_items")
      .select("status, item_assignees(user_id)")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await context.supabase
      .rpc("set_item_status", { p_item_id: data.id, p_status: data.status });
    if (error) throw new Error(error.message);

    // Log transition (fire-and-forget, don't block on error)
    const assigneeIds = (current?.item_assignees ?? []).map((a: any) => a.user_id);
    context.supabase.from("status_transitions").insert({
      item_id: data.id,
      from_status: current?.status ?? null,
      to_status: data.status,
      changed_by: context.userId,
      assignee_ids: assigneeIds,
    }).then(() => {});

    // Push notification when item is approved — notify all assignees
    if (data.status === "PRONTO_PARA_PUBLICAR" && assigneeIds.length > 0) {
      try {
        const { data: item } = await context.supabase
          .from("content_items").select("title").eq("id", data.id).maybeSingle();
        const appId = process.env.ONESIGNAL_APP_ID;
        const restApiKey = process.env.ONESIGNAL_REST_API_KEY;
        if (appId && restApiKey) {
          await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Basic ${restApiKey}` },
            body: JSON.stringify({
              app_id: appId,
              include_external_user_ids: assigneeIds,
              channel_for_external_user_ids: "push",
              headings: { en: "✅ Item aprovado!", pt: "✅ Item aprovado!" },
              contents: {
                en: `"${item?.title ?? "Item"}" foi aprovado`,
                pt: `"${item?.title ?? "Item"}" foi aprovado`,
              },
              url: process.env.VITE_APP_URL ?? "https://modo.luzeriaestudio.com.br",
            }),
          });
        }
      } catch (e) {
        console.error("[OneSignal] setItemStatus notification failed:", e);
      }
    }

    return { ok: true };
  });

export const addAssignee = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; userId: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("item_assignees")
      .insert({ item_id: data.itemId, user_id: data.userId });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);

    // Push notification: notify the assigned user (skip if assigning themselves)
    if (data.userId !== context.userId) {
      try {
        const [{ data: item }, { data: assigner }] = await Promise.all([
          context.supabase.from("content_items").select("title").eq("id", data.itemId).maybeSingle(),
          context.supabase.from("profiles").select("name").eq("id", context.userId).maybeSingle(),
        ]);
        const appId = process.env.ONESIGNAL_APP_ID;
        const restApiKey = process.env.ONESIGNAL_REST_API_KEY;
        if (appId && restApiKey) {
          await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Basic ${restApiKey}` },
            body: JSON.stringify({
              app_id: appId,
              include_external_user_ids: [data.userId],
              channel_for_external_user_ids: "push",
              headings: { en: "Nova tarefa atribuída", pt: "Nova tarefa atribuída" },
              contents: {
                en: `${assigner?.name ?? "Alguém"} te atribuiu: ${item?.title ?? "uma tarefa"}`,
                pt: `${assigner?.name ?? "Alguém"} te atribuiu: ${item?.title ?? "uma tarefa"}`,
              },
              url: process.env.VITE_APP_URL ?? "https://modo.luzeriaestudio.com.br",
            }),
          });
        }
      } catch (e) {
        console.error("[OneSignal] addAssignee notification failed:", e);
      }
    }

    return { ok: true };
  });

export const addContentItem = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; key: string; type: ContentType; title?: string; dueDate?: string | null; notes?: string | null; location?: string | null }) =>
    z.object({
      clientId: z.string().uuid(),
      key: z.string(),
      type: z.enum(["post", "reel", "outros", "gravacao", "roteiro", "sistema"]),
      title: z.string().trim().max(200).optional(),
      dueDate: z.string().nullable().optional(),
      notes: z.string().trim().max(2000).nullable().optional(),
      location: z.string().trim().max(500).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    let { data: month } = await context.supabase
      .from("months").select("id").eq("client_id", data.clientId).eq("key", data.key).maybeSingle();
    if (!month) {
      const { data: m, error } = await context.supabase
        .from("months").insert({ client_id: data.clientId, key: data.key }).select("id").single();
      if (error) throw new Error(error.message);
      month = m;
    }
    const { data: maxRow } = await context.supabase
      .from("content_items").select("idx").eq("month_id", month.id).eq("type", data.type)
      .order("idx", { ascending: false }).limit(1).maybeSingle();
    const nextIdx = ((maxRow as any)?.idx ?? 0) + 1;
    const typeLabels: Record<string, string> = { post: "Post", reel: "Reel", outros: "Item", gravacao: "Gravação", roteiro: "Roteiro", sistema: "Sistema" };
    const fallback = `${typeLabels[data.type] ?? "Item"} ${nextIdx}`;
    const insertRow: Record<string, any> = {
      month_id: month.id, type: data.type, idx: nextIdx,
      title: (data.title?.trim() || fallback),
    };
    if (isActivityType(data.type)) insertRow.status = "PENDENTE";
    if (data.dueDate) insertRow.due_date = data.dueDate;
    if (data.notes) insertRow.copy = data.notes;
    if (data.location) insertRow.drive_link = data.location;
    const { data: inserted, error: iErr } = await context.supabase
      .from("content_items").insert(insertRow).select("id").single();
    if (iErr) throw new Error(iErr.message);
    return { id: inserted.id };
  });

export const deleteItem = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase.from("content_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeAssignee = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; userId: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("item_assignees")
      .delete().eq("item_id", data.itemId).eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; text: string }) =>
    z.object({ itemId: z.string().uuid(), text: z.string().trim().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("comments")
      .insert({ item_id: data.itemId, author_id: context.userId, text: data.text, is_system: false });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============== NOTIFICATIONS ============== */

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notifications")
      .select("*, content_items(month_id, months(client_id, key))")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false }).limit(50);
    return (data ?? []).map((n: any) => ({
      id: n.id, type: n.type, itemId: n.item_id,
      message: n.message, read: n.read, createdAt: n.created_at,
      clientId: n.content_items?.months?.client_id ?? null,
      monthKey: n.content_items?.months?.key ?? null,
    }));
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id?: string; all?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const q = context.supabase.from("notifications").update({ read: true }).eq("user_id", context.userId);
    if (data.id) await q.eq("id", data.id);
    else await q.eq("read", false);
    return { ok: true };
  });

export const listMyMentions = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data: mens } = await context.supabase
      .from("mentions")
      .select("id, item_id, comment_id, created_at, read_at, comments(text, author_id, profiles:author_id(name, color)), content_items(id, type, idx, title, status, month_id, months(key, clients(id, name, color, category)))")
      .eq("mentioned_user_id", context.userId)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(30);
    return (mens ?? [])
      .filter((m: any) => m.content_items && m.content_items.months?.clients)
      .map((m: any) => {
        const it = m.content_items;
        const c = it.months.clients;
        return {
          mentionId: m.id,
          itemId: it.id,
          type: it.type as "post" | "reel" | "outros",
          idx: it.idx as number,
          title: it.title as string,
          status: it.status as string,
          monthKey: it.months.key as string,
          clientId: c.id as string,
          clientName: c.name as string,
          clientColor: c.color as string,
          clientCategory: (c.category ?? "Social Media") as string,
          mentionedAt: m.created_at as string,
          authorName: (m.comments?.profiles?.name ?? null) as string | null,
          snippet: ((m.comments?.text ?? "") as string).replace(/@\[([^\]]+)\]\([0-9a-f-]{36}\)/g, "@$1").slice(0, 140),
        };
      });
  });

export const markMentionRead = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { mentionId?: string; itemId?: string; all?: boolean }) => d)
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("mentions").update({ read_at: new Date().toISOString() }).eq("mentioned_user_id", context.userId);
    if (data.mentionId) q = q.eq("id", data.mentionId);
    else if (data.itemId) q = q.eq("item_id", data.itemId);
    else q = q.is("read_at", null);
    await q;
    return { ok: true };
  });

/* ============== MY TASKS ============== */

export const listMyTasks = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId?: string }) => d)
  .handler(async ({ data, context }) => {
    let targetUser = context.userId;
    if (data.userId && data.userId !== context.userId) {
      const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
      if (!isAdmin) throw new Error("Forbidden");
      targetUser = data.userId;
    }
    const { data: assigns } = await context.supabase
      .from("item_assignees").select("item_id").eq("user_id", targetUser);
    const itemIds = (assigns ?? []).map((a) => a.item_id);
    if (itemIds.length === 0) return [];
    const { data: items } = await context.supabase
      .from("content_items")
      .select("id, type, idx, title, status, due_date, month_id, months!inner(client_id, key, clients!inner(id, name, color, category))")
      .in("id", itemIds);
    return (items ?? []).map((it: any) => ({
      id: it.id, type: it.type, idx: it.idx, title: it.title, status: it.status,
      dueDate: it.due_date ?? null,
      monthKey: it.months.key, clientId: it.months.clients.id,
      clientName: it.months.clients.name, clientColor: it.months.clients.color,
      clientCategory: it.months.clients.category ?? "Social Media",
    }));
  });

/* ============== PRODUCTIVITY ============== */

export const getProductivity = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId?: string; monthKey: string }) => d)
  .handler(async ({ data, context }) => {
    let targetUser = context.userId;
    if (data.userId && data.userId !== context.userId) {
      const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
      if (!isAdmin) throw new Error("Forbidden");
      targetUser = data.userId;
    }
    const [y, m] = data.monthKey.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const end = new Date(Date.UTC(y, m, 1)).toISOString();
    const [{ data: assigns }, { data: edited }] = await Promise.all([
      context.supabase.from("item_assignees").select("item_id").eq("user_id", targetUser),
      context.supabase.from("content_items").select("id").eq("editor_id", targetUser),
    ]);
    const itemIds = [...new Set([
      ...(assigns ?? []).map((a) => a.item_id),
      ...(edited ?? []).map((e) => e.id),
    ])];
    if (itemIds.length === 0) {
      return { weeks: [0, 0, 0, 0], items: [[], [], [], []] as string[][], total: 0, history: [] };
    }
    const { data: done } = await context.supabase
      .from("content_items").select("id, title, updated_at")
      .in("id", itemIds).eq("status", "PRONTO_PARA_PUBLICAR")
      .gte("updated_at", start).lt("updated_at", end);
    const weeks = [0, 0, 0, 0];
    const items: string[][] = [[], [], [], []];
    (done ?? []).forEach((it: any) => {
      const day = new Date(it.updated_at).getUTCDate();
      const w = Math.min(3, Math.floor((day - 1) / 7));
      weeks[w]++; items[w].push(it.title);
    });
    // 6-month history
    const histStart = new Date(Date.UTC(y, m - 6, 1)).toISOString();
    const { data: hist } = await context.supabase
      .from("content_items").select("updated_at")
      .in("id", itemIds).eq("status", "PRONTO_PARA_PUBLICAR")
      .gte("updated_at", histStart).lt("updated_at", end);
    const history: { key: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      history.push({ key: k, count: 0 });
    }
    (hist ?? []).forEach((it: any) => {
      const d = new Date(it.updated_at);
      const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const h = history.find((x) => x.key === k);
      if (h) h.count++;
    });
    return { weeks, items, total: (done ?? []).length, history };
  });

/** Monthly count of registered activities (gravação/roteiro/sistema/outros) — separate
 * from post/reel productivity, since these aren't "published" content. */
export const getMyActivityCounts = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId?: string; monthKey: string }) => d)
  .handler(async ({ data, context }) => {
    let targetUser = context.userId;
    if (data.userId && data.userId !== context.userId) {
      const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
      if (!isAdmin) throw new Error("Forbidden");
      targetUser = data.userId;
    }
    const [y, m] = data.monthKey.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const end = new Date(Date.UTC(y, m, 1)).toISOString();
    const { data: rows, error } = await context.supabase
      .from("finalizations")
      .select("finalized_at, content_items!inner(type)")
      .eq("user_id", targetUser)
      .gte("finalized_at", start).lt("finalized_at", end);
    if (error) throw new Error(error.message);
    const counts = { gravacao: 0, roteiro: 0, sistema: 0, outros: 0 };
    (rows ?? []).forEach((r: any) => {
      const t = r.content_items?.type;
      if (t && t in counts) (counts as any)[t]++;
    });
    return counts;
  });

/* ============== STORIES SCHEDULE ============== */

export const listStories = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { monthKey: string }) => d)
  .handler(async ({ data, context }) => {
    const [y, m] = data.monthKey.split("-").map(Number);
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const endDate = new Date(Date.UTC(y, m, 1));
    const end = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const { data: rows, error } = await context.supabase
      .from("stories_schedule")
      .select("id, day, user_id, label, status, done_at, done_by")
      .gte("day", start).lt("day", end);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id as string, day: r.day as string,
      userId: (r.user_id ?? null) as string | null,
      label: (r.label ?? null) as string | null,
      status: (r.status ?? "pending") as "pending" | "done" | "missed",
      doneAt: (r.done_at ?? null) as string | null,
      doneBy: (r.done_by ?? null) as string | null,
    }));
  });

export const upsertStoryDay = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { day: string; userId?: string | null; label?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    if (!data.userId && !data.label) {
      const { error } = await context.supabase.from("stories_schedule").delete().eq("day", data.day);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase
      .from("stories_schedule")
      .upsert({ day: data.day, user_id: data.userId ?? null, label: data.label ?? null, updated_at: new Date().toISOString() }, { onConflict: "day" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setStoryDone = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { day: string; done: boolean }) =>
    z.object({
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      done: z.boolean(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    // Check responsibility or admin
    const { data: row, error: selErr } = await context.supabase
      .from("stories_schedule")
      .select("id, user_id")
      .eq("day", data.day).maybeSingle();
    if (selErr) throw new Error(selErr.message);
    if (!row) throw new Error("Sem escala para esse dia");
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin && row.user_id !== context.userId) throw new Error("Forbidden");
    const patch = data.done
      ? { status: "done", done_at: new Date().toISOString(), done_by: context.userId }
      : { status: "pending", done_at: null, done_by: null };
    const { error } = await context.supabase
      .from("stories_schedule").update(patch).eq("id", row.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyToday = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId?: string; today: string; weekday: number }) => d)
  .handler(async ({ data, context }) => {
    let targetUser = context.userId;
    if (data.userId && data.userId !== context.userId) {
      const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
      if (!isAdmin) throw new Error("Forbidden");
      targetUser = data.userId;
    }
    const { data: story } = await context.supabase
      .from("stories_schedule").select("day, status").eq("day", data.today).eq("user_id", targetUser).maybeSingle();
    let cleaning: number[] = [];
    let cleaningStatuses: { taskIdx: number; status: "done" | "missed" }[] = [];
    if (data.weekday >= 0 && data.weekday <= 5) {
      const { data: rows } = await context.supabase
        .from("cleaning_schedule").select("task_idx").eq("weekday", data.weekday).eq("user_id", targetUser);
      cleaning = (rows ?? []).map((r: any) => r.task_idx as number);
      if (cleaning.length > 0) {
        const { data: logs } = await context.supabase
          .from("cleaning_log")
          .select("task_idx, status")
          .eq("occurrence_date", data.today)
          .eq("weekday", data.weekday)
          .in("task_idx", cleaning);
        cleaningStatuses = (logs ?? []).map((r: any) => ({ taskIdx: r.task_idx, status: r.status }));
      }
    }
    return {
      stories: !!story,
      storyStatus: (story?.status ?? null) as "pending" | "done" | "missed" | null,
      cleaningTaskIdx: cleaning,
      cleaningStatuses,
    };
  });

/* ============== CLEANING ============== */

export const getCleaning = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    // Compute Monday-based week start in UTC
    const now = new Date();
    const dow = now.getUTCDay(); // 0=Sun..6=Sat
    const diffToMon = (dow + 6) % 7;
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMon));
    const sunday = new Date(monday); sunday.setUTCDate(monday.getUTCDate() + 6);
    const weekStart = monday.toISOString().slice(0, 10);
    const weekEnd = sunday.toISOString().slice(0, 10);

    const [{ data: rows }, { data: settings }, { data: logs }] = await Promise.all([
      context.supabase.from("cleaning_schedule").select("id, task_idx, weekday, user_id, label"),
      context.supabase.from("cleaning_settings").select("note").eq("id", 1).maybeSingle(),
      context.supabase.from("cleaning_log")
        .select("task_idx, weekday, occurrence_date, status, done_at, done_by")
        .gte("occurrence_date", weekStart).lte("occurrence_date", weekEnd),
    ]);
    return {
      cells: (rows ?? []).map((r: any) => ({
        id: r.id as string,
        taskIdx: r.task_idx as number,
        weekday: r.weekday as number,
        userId: (r.user_id ?? null) as string | null,
        label: (r.label ?? null) as string | null,
      })),
      note: (settings?.note ?? "") as string,
      weekStart,
      weekLog: (logs ?? []).map((r: any) => ({
        taskIdx: r.task_idx as number,
        weekday: r.weekday as number,
        occurrenceDate: r.occurrence_date as string,
        status: r.status as "done" | "missed",
        doneAt: (r.done_at ?? null) as string | null,
        doneBy: (r.done_by ?? null) as string | null,
      })),
    };
  });

export const upsertCleaningCell = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { taskIdx: number; weekday: number; userId?: string | null; label?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    if (!data.userId && !data.label) {
      const { error } = await context.supabase
        .from("cleaning_schedule").delete().eq("task_idx", data.taskIdx).eq("weekday", data.weekday);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase
      .from("cleaning_schedule")
      .upsert({ task_idx: data.taskIdx, weekday: data.weekday, user_id: data.userId ?? null, label: data.label ?? null, updated_at: new Date().toISOString() }, { onConflict: "task_idx,weekday" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCleaningDone = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { taskIdx: number; weekday: number; occurrenceDate: string; done: boolean }) =>
    z.object({
      taskIdx: z.number().int().min(0),
      weekday: z.number().int().min(0).max(6),
      occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      done: z.boolean(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    // Validate responsibility (responsible scheduled OR admin)
    const [{ data: isAdmin }, { data: cell }] = await Promise.all([
      context.supabase.rpc("is_admin", { _user_id: context.userId }),
      context.supabase.from("cleaning_schedule")
        .select("user_id").eq("task_idx", data.taskIdx).eq("weekday", data.weekday).maybeSingle(),
    ]);
    if (!isAdmin && cell?.user_id !== context.userId) throw new Error("Forbidden");

    if (!data.done) {
      // Mark back to pending: remove the log row
      const { error } = await context.supabase
        .from("cleaning_log")
        .delete()
        .eq("task_idx", data.taskIdx)
        .eq("weekday", data.weekday)
        .eq("occurrence_date", data.occurrenceDate);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    const { error } = await context.supabase
      .from("cleaning_log")
      .upsert({
        task_idx: data.taskIdx,
        weekday: data.weekday,
        occurrence_date: data.occurrenceDate,
        user_id: cell?.user_id ?? null,
        status: "done",
        done_at: new Date().toISOString(),
        done_by: context.userId,
      }, { onConflict: "task_idx,weekday,occurrence_date" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateCleaningNote = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { note: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("cleaning_settings").upsert({ id: 1, note: data.note, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============== ADMIN DASHBOARD ============== */

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { monthKey: string }) =>
    z.object({ monthKey: z.string().regex(/^\d{4}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: clientsAll } = await context.supabase
      .from("clients").select("id, name, color, archived, category, photo_url, posts_per_week, reels_per_week").order("name");
    // "Ex-clientes" não entram nas métricas nem na listagem do dashboard.
    const clients = (clientsAll ?? []).filter(
      (c: any) => (c.category ?? "Social Media") !== "Ex-clientes"
    );
    const photoMap = await signAvatarPaths(context.supabase, clients.map((c: any) => c.photo_url));
    const { data: months } = await context.supabase
      .from("months").select("id, client_id").eq("key", data.monthKey);
    const monthIds = (months ?? []).map((m) => m.id);
    const monthByClient = new Map<string, string>();
    (months ?? []).forEach((m) => monthByClient.set(m.client_id, m.id));
    const { data: items } = monthIds.length
      ? await context.supabase
          .from("content_items").select("id, month_id, type, status").in("month_id", monthIds)
      : { data: [] as any[] };

    type Row = {
      id: string; name: string; color: string; archived: boolean; category: string;
      photoUrl: string | null;
      posts: number; reels: number; total: number; done: number; percent: number;
      contracted: number;
    };
    const rows: Row[] = (clients ?? []).map((c: any) => {
      const mid = monthByClient.get(c.id);
      const its = mid ? (items ?? []).filter((it: any) => it.month_id === mid) : [];
      const posts = its.filter((i) => i.type === "post").length;
      const reels = its.filter((i) => i.type === "reel").length;
      const total = its.length;
      const done = its.filter((i) => i.status === "PRONTO_PARA_PUBLICAR").length;
      // % contra o combinado no contrato (posts/reels por mês), não contra o
      // que foi criado no sistema — assim dá pra ultrapassar 100% quando a
      // equipe entrega mais do que o combinado.
      const contracted = (c.posts_per_week ?? 0) + (c.reels_per_week ?? 0);
      const percent = contracted > 0
        ? Math.round((done / contracted) * 100)
        : (total ? Math.round((done / total) * 100) : 0);
      return {
        id: c.id, name: c.name, color: c.color, archived: !!c.archived,
        category: c.category ?? "Social Media",
        photoUrl: c.photo_url ? (photoMap.get(c.photo_url) ?? null) : null,
        posts, reels, total, done, percent, contracted,
      };
    });

    const active = rows.filter((r) => !r.archived);
    const totalPlanned = active.reduce((a, r) => a + r.total, 0);
    const totalDone = active.reduce((a, r) => a + r.done, 0);
    const overallPct = totalPlanned ? Math.round((totalDone / totalPlanned) * 100) : 0;
    const ontime = active.filter((r) => r.total > 0 && r.percent >= 80).length;
    const behind = active.filter((r) => r.total > 0 && r.percent < 80).length;

    return {
      monthKey: data.monthKey,
      totals: {
        clients: active.length,
        planned: totalPlanned,
        done: totalDone,
        percent: overallPct,
        ontime,
        behind,
      },
      clients: rows,
    };
  });

export const getTopMembers = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { period: "month" | "3m" | "6m" | "year"; monthKey: string }) =>
    z.object({
      period: z.enum(["month", "3m", "6m", "year"]),
      monthKey: z.string().regex(/^\d{4}-\d{2}$/),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const [y, m] = data.monthKey.split("-").map(Number);
    const end = new Date(Date.UTC(y, m, 1)); // exclusive end = first day of next month
    let start: Date;
    if (data.period === "month") start = new Date(Date.UTC(y, m - 1, 1));
    else if (data.period === "3m") start = new Date(Date.UTC(y, m - 3, 1));
    else if (data.period === "6m") start = new Date(Date.UTC(y, m - 6, 1));
    else start = new Date(Date.UTC(y, 0, 1));

    const { data: finals } = await context.supabase
      .from("finalizations").select("user_id")
      .gte("finalized_at", start.toISOString())
      .lt("finalized_at", end.toISOString());
    const counts = new Map<string, number>();
    (finals ?? []).forEach((f: any) => counts.set(f.user_id, (counts.get(f.user_id) ?? 0) + 1));

    const { data: profiles } = await context.supabase
      .from("profiles").select("id, name, color, icon, avatar_url");
    const avatarMap = await signAvatarPaths(context.supabase, (profiles ?? []).map((p: any) => p.avatar_url));
    const ranking = (profiles ?? [])
      .map((p: any) => ({
        id: p.id, name: p.name, color: p.color, icon: p.icon,
        avatarUrl: p.avatar_url ? (avatarMap.get(p.avatar_url) ?? null) : null,
        count: counts.get(p.id) ?? 0,
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
    return { period: data.period, ranking };
  });

/* ============== MEMBER FINALIZATIONS ============== */

export const getMemberFinalizations = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId: string; period: "month" | "3m" | "6m" | "year"; monthKey: string }) =>
    z.object({
      userId: z.string().uuid(),
      period: z.enum(["month", "3m", "6m", "year"]),
      monthKey: z.string().regex(/^\d{4}-\d{2}$/),
    }).parse(d))
  .handler(async ({ data, context }) => {
    // Membros só veem as próprias finalizações; adm vê de qualquer um.
    if (data.userId !== context.userId) {
      const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
      if (!isAdmin) throw new Error("Forbidden");
    }
    const [y, m] = data.monthKey.split("-").map(Number);
    const end = new Date(Date.UTC(y, m, 1));
    let start: Date;
    if (data.period === "month") start = new Date(Date.UTC(y, m - 1, 1));
    else if (data.period === "3m") start = new Date(Date.UTC(y, m - 3, 1));
    else if (data.period === "6m") start = new Date(Date.UTC(y, m - 6, 1));
    else start = new Date(Date.UTC(y, 0, 1));

    const { data: rows, error } = await context.supabase
      .from("finalizations")
      .select(
        "finalized_at, content_items!inner(id, type, idx, title, months!inner(key, clients!inner(id, name, color, category)))"
      )
      .eq("user_id", data.userId)
      .gte("finalized_at", start.toISOString())
      .lt("finalized_at", end.toISOString())
      .order("finalized_at", { ascending: false });
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r: any) => ({
      itemId: r.content_items.id as string,
      type: r.content_items.type as ContentType,
      title: r.content_items.title as string,
      finalizedAt: r.finalized_at as string,
      clientId: r.content_items.months.clients.id as string,
      clientName: r.content_items.months.clients.name as string,
      clientColor: r.content_items.months.clients.color as string,
      clientCategory: (r.content_items.months.clients.category ?? "Social Media") as string,
    }));
  });

/* ============== ADMIN REPORT ============== */

const reportFiltersSchema = z.object({
  userId: z.string().uuid().optional().nullable(),
  from: z.string(),
  to: z.string(),
  type: z.enum(["all", "post", "reel", "outros", "gravacao", "roteiro", "sistema", "stories", "cleaning"]).optional(),
  clientId: z.string().uuid().optional().nullable(),
});

export const getReport = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: any) => reportFiltersSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");

    const fromISO = new Date(data.from).toISOString();
    const toISO = new Date(data.to).toISOString();
    const filterUser = data.userId || null;
    const filterType = data.type ?? "all";
    const filterClient = data.clientId || null;

    // ---- profiles map ----
    const { data: profiles } = await context.supabase
      .from("profiles").select("id, name, color, icon, active");
    const profileById = new Map<string, any>();
    (profiles ?? []).forEach((p: any) => profileById.set(p.id, p));
    const { data: roleRows } = await context.supabase.from("user_roles").select("user_id, role");
    const roleByUser = new Map<string, string>();
    (roleRows ?? []).forEach((r: any) => roleByUser.set(r.user_id, r.role));

    // ---- content finalizations (posts/reels/outros) ----
    let fq = context.supabase
      .from("finalizations")
      .select(
        "id, user_id, finalized_at, content_items!inner(id, type, title, editor_id, reel_type, due_date, months!inner(client_id, key, clients!inner(id, name, color, category)))"
      )
      .gte("finalized_at", fromISO)
      .lt("finalized_at", toISO);
    if (filterUser) fq = fq.eq("user_id", filterUser);
    const { data: finRows, error: finErr } = await fq;
    if (finErr) throw new Error(finErr.message);

    type HistRow = {
      kind: "content" | "stories" | "cleaning";
      finalizedAt: string;
      userId: string;
      type: "post" | "reel" | "outros" | "gravacao" | "roteiro" | "sistema" | "stories" | "cleaning";
      title: string;
      clientId: string | null;
      clientName: string | null;
      clientColor: string | null;
      clientCategory: string | null;
      reelType: string | null;
      editorId: string | null;
      lateDays: number;
    };
    const history: HistRow[] = [];
    (finRows ?? []).forEach((r: any) => {
      const it = r.content_items;
      if (!it) return;
      const c = it.months?.clients;
      const category = c?.category ?? "Social Media";
      if (filterClient && c?.id !== filterClient) return;
      if (filterType !== "all" && filterType !== "stories" && filterType !== "cleaning" && it.type !== filterType) return;
      if ((filterType === "stories" || filterType === "cleaning") && true) return; // skip content for stories/cleaning filter
      const lateDays = computeLateDays(it.due_date, r.finalized_at);
      history.push({
        kind: "content",
        finalizedAt: r.finalized_at,
        userId: r.user_id,
        type: it.type,
        title: it.title,
        clientId: c?.id ?? null,
        clientName: c?.name ?? null,
        clientColor: c?.color ?? null,
        clientCategory: category,
        reelType: it.reel_type ?? null,
        editorId: it.editor_id ?? null,
        lateDays,
      });
    });

    // ---- stories ----
    if (!filterClient && (filterType === "all" || filterType === "stories")) {
      const fromDay = data.from.slice(0, 10);
      const toDay = data.to.slice(0, 10);
      let sq = context.supabase
        .from("stories_schedule")
        .select("day, user_id, updated_at")
        .gte("day", fromDay).lt("day", toDay)
        .not("user_id", "is", null);
      if (filterUser) sq = sq.eq("user_id", filterUser);
      const { data: storyRows } = await sq;
      (storyRows ?? []).forEach((s: any) => {
        history.push({
          kind: "stories",
          finalizedAt: s.updated_at ?? new Date(s.day + "T12:00:00Z").toISOString(),
          userId: s.user_id,
          type: "stories",
          title: `Stories ${new Date(s.day + "T12:00:00Z").toLocaleDateString("pt-BR")}`,
          clientId: null, clientName: "STORIES", clientColor: "#7EFFD9", clientCategory: "Stories",
          reelType: null, editorId: null, lateDays: 0,
        });
      });
    }

    // ---- cleaning ----
    if (!filterClient && (filterType === "all" || filterType === "cleaning")) {
      let cq = context.supabase
        .from("cleaning_schedule")
        .select("task_idx, weekday, user_id, updated_at")
        .not("user_id", "is", null)
        .gte("updated_at", fromISO).lt("updated_at", toISO);
      if (filterUser) cq = cq.eq("user_id", filterUser);
      const { data: cleanRows } = await cq;
      (cleanRows ?? []).forEach((c: any) => {
        history.push({
          kind: "cleaning",
          finalizedAt: c.updated_at ?? new Date().toISOString(),
          userId: c.user_id,
          type: "cleaning",
          title: `Limpeza · tarefa ${c.task_idx + 1} (dia ${c.weekday})`,
          clientId: null, clientName: "LIMPEZA", clientColor: "#4A9EFF", clientCategory: "Limpeza",
          reelType: null, editorId: null, lateDays: 0,
        });
      });
    }

    history.sort((a, b) => b.finalizedAt.localeCompare(a.finalizedAt));

    // ---- broad activity feed (comments, files, status moves, item events) ----
    // Kept separate from `history` above: that array drives goal/finalization
    // stats (summary/byMember/etc.) and must stay finalization-only. This one
    // is the raw "everything that happened" feed for the Histórico display.
    type ActivityEntry = {
      kind: "finalized" | "status" | "comment" | "file" | "created" | "due_date" | "rated";
      at: string;
      userId: string;
      clientId: string | null;
      clientName: string | null;
      clientColor: string | null;
      itemId: string | null;
      itemTitle: string | null;
      itemType: string | null;
      description: string;
    };
    const activityFeed: ActivityEntry[] = [];

    let stq = context.supabase
      .from("status_transitions")
      .select("item_id, from_status, to_status, actor_id, at")
      .gte("at", fromISO).lt("at", toISO);
    if (filterUser) stq = stq.eq("actor_id", filterUser);
    const { data: statusRows } = await stq;

    let cmq = context.supabase
      .from("comments")
      .select("item_id, author_id, text, created_at")
      .eq("is_system", false)
      .gte("created_at", fromISO).lt("created_at", toISO);
    if (filterUser) cmq = cmq.eq("author_id", filterUser);
    const { data: commentRows } = await cmq;

    let ifq = context.supabase
      .from("item_files")
      .select("item_id, name, mime_type, added_by, created_at")
      .gte("created_at", fromISO).lt("created_at", toISO);
    if (filterUser) ifq = ifq.eq("added_by", filterUser);
    const { data: fileRows } = await ifq;

    let alq = context.supabase
      .from("activity_log")
      .select("entity_id, actor_id, action, meta, at")
      .eq("entity_type", "content_item")
      .in("action", ["created", "due_date_changed", "rated"])
      .gte("at", fromISO).lt("at", toISO);
    if (filterUser) alq = alq.eq("actor_id", filterUser);
    const { data: logRows } = await alq;

    const touchedItemIds = new Set<string>();
    (statusRows ?? []).forEach((r: any) => touchedItemIds.add(r.item_id));
    (commentRows ?? []).forEach((r: any) => touchedItemIds.add(r.item_id));
    (fileRows ?? []).forEach((r: any) => touchedItemIds.add(r.item_id));
    (logRows ?? []).forEach((r: any) => touchedItemIds.add(r.entity_id));

    const itemInfoById = new Map<string, any>();
    if (touchedItemIds.size > 0) {
      const { data: itemsInfo } = await context.supabase
        .from("content_items")
        .select("id, type, title, months!inner(client_id, key, clients!inner(id, name, color, category))")
        .in("id", [...touchedItemIds]);
      (itemsInfo ?? []).forEach((it: any) => itemInfoById.set(it.id, it));
    }

    function pushActivity(kind: ActivityEntry["kind"], itemId: string | null, userId: string | null, at: string, description: string) {
      if (!userId) return;
      if (filterType === "stories" || filterType === "cleaning") return;
      const it = itemId ? itemInfoById.get(itemId) : null;
      const c = it?.months?.clients;
      if (filterClient && c?.id !== filterClient) return;
      if (filterType !== "all" && it && it.type !== filterType) return;
      activityFeed.push({
        kind, at, userId,
        clientId: c?.id ?? null, clientName: c?.name ?? null, clientColor: c?.color ?? null,
        itemId, itemTitle: it?.title ?? null, itemType: it?.type ?? null,
        description,
      });
    }

    (statusRows ?? []).forEach((r: any) => {
      const fromLabel = r.from_status ? (STATUS_META[r.from_status as Status]?.label ?? r.from_status) : null;
      const toLabel = STATUS_META[r.to_status as Status]?.label ?? r.to_status;
      const isFinal = r.to_status === "PRONTO_PARA_PUBLICAR" || r.to_status === "CONCLUIDO";
      const desc = fromLabel ? `Mudou o status de "${fromLabel}" para "${toLabel}"` : `Definiu o status como "${toLabel}"`;
      pushActivity(isFinal ? "finalized" : "status", r.item_id, r.actor_id, r.at, desc);
    });
    (commentRows ?? []).forEach((r: any) => {
      const text = (r.text ?? "").length > 100 ? r.text.slice(0, 100) + "…" : (r.text ?? "");
      pushActivity("comment", r.item_id, r.author_id, r.created_at, `Comentou: "${text}"`);
    });
    (fileRows ?? []).forEach((r: any) => {
      const mime = r.mime_type ?? "";
      const verb = mime.startsWith("image/") ? "Adicionou a foto" : mime.startsWith("video/") ? "Adicionou o vídeo" : "Anexou o arquivo";
      pushActivity("file", r.item_id, r.added_by, r.created_at, `${verb} "${r.name}"`);
    });
    (logRows ?? []).forEach((r: any) => {
      if (r.action === "created") {
        pushActivity("created", r.entity_id, r.actor_id, r.at, `Criou "${r.meta?.title ?? ""}"`);
      } else if (r.action === "due_date_changed") {
        const to = r.meta?.to ? new Date(r.meta.to + "T12:00:00").toLocaleDateString("pt-BR") : "sem prazo";
        pushActivity("due_date", r.entity_id, r.actor_id, r.at, `Alterou o prazo para ${to}`);
      } else if (r.action === "rated") {
        const rating = r.meta?.rating ?? "?";
        pushActivity("rated", r.entity_id, r.actor_id, r.at, `Avaliou com ${rating} estrela${rating === 1 ? "" : "s"}`);
      }
    });

    const enrichedActivity = activityFeed
      .map((a) => ({
        ...a,
        userName: profileById.get(a.userId)?.name ?? "—",
        userColor: profileById.get(a.userId)?.color ?? "#888",
      }))
      .sort((a, b) => b.at.localeCompare(a.at));

    // ---- summary ----
    const contentHist = history.filter((h) => h.kind === "content");
    const summary = {
      total: history.length,
      posts: contentHist.filter((h) => h.type === "post").length,
      reels: contentHist.filter((h) => h.type === "reel").length,
      outros: contentHist.filter((h) => h.type === "outros").length,
      stories: history.filter((h) => h.kind === "stories").length,
      cleaning: history.filter((h) => h.kind === "cleaning").length,
    };

    // ---- by member ----
    const memberAgg = new Map<string, { posts: number; reels: number; outros: number; stories: number; cleaning: number; lateCount: number; lateDaysSum: number }>();
    history.forEach((h) => {
      const k = h.userId;
      const row = memberAgg.get(k) ?? { posts: 0, reels: 0, outros: 0, stories: 0, cleaning: 0, lateCount: 0, lateDaysSum: 0 };
      if (h.type === "post") row.posts++;
      else if (h.type === "reel") row.reels++;
      else if (h.type === "outros") row.outros++;
      else if (h.type === "stories") row.stories++;
      else if (h.type === "cleaning") row.cleaning++;
      if (h.kind === "content" && h.lateDays > 0) { row.lateCount++; row.lateDaysSum += h.lateDays; }
      memberAgg.set(k, row);
    });
    const byMember = [...memberAgg.entries()].map(([userId, v]) => {
      const p = profileById.get(userId);
      const total = v.posts + v.reels + v.outros + v.stories + v.cleaning;
      const { lateDaysSum, ...rest } = v;
      return {
        userId,
        name: p?.name ?? "—",
        color: p?.color ?? "#888",
        icon: p?.icon ?? null,
        role: roleByUser.get(userId) ?? "member",
        ...rest,
        avgLateDays: v.lateCount > 0 ? Math.round((lateDaysSum / v.lateCount) * 10) / 10 : 0,
        total,
      };
    }).sort((a, b) => b.total - a.total);
    const teamTotal = byMember.reduce((a, b) => a + b.total, 0);
    const byMemberWithPct = byMember.map((m) => ({ ...m, pct: teamTotal ? Math.round((m.total / teamTotal) * 100) : 0 }));

    // ---- activities (gravação/roteiro/sistema/outros) — separate from post/reel productivity ----
    const activityHist = contentHist.filter((h) => h.type !== "post" && h.type !== "reel");
    const activitySummary = {
      gravacao: activityHist.filter((h) => h.type === "gravacao").length,
      roteiro: activityHist.filter((h) => h.type === "roteiro").length,
      sistema: activityHist.filter((h) => h.type === "sistema").length,
      outros: activityHist.filter((h) => h.type === "outros").length,
    };
    const activityAgg = new Map<string, { gravacao: number; roteiro: number; sistema: number; outros: number }>();
    activityHist.forEach((h) => {
      const row = activityAgg.get(h.userId) ?? { gravacao: 0, roteiro: 0, sistema: 0, outros: 0 };
      (row as any)[h.type]++;
      activityAgg.set(h.userId, row);
    });
    const activityByMember = [...activityAgg.entries()].map(([userId, v]) => {
      const p = profileById.get(userId);
      return {
        userId, name: p?.name ?? "—", color: p?.color ?? "#888", icon: p?.icon ?? null,
        ...v, total: v.gravacao + v.roteiro + v.sistema + v.outros,
      };
    }).sort((a, b) => b.total - a.total);

    // ---- by editor / format ----
    const fmtAgg = new Map<string, { lofi: number; facil: number; basico: number; avancado: number }>();
    contentHist.forEach((h) => {
      if (h.type !== "reel") return;
      const eid = h.editorId ?? "__none__";
      const row = fmtAgg.get(eid) ?? { lofi: 0, facil: 0, basico: 0, avancado: 0 };
      const rt = (h.reelType as any) as "lofi" | "facil" | "basico" | "avancado" | null;
      if (rt && row[rt] !== undefined) row[rt]++;
      fmtAgg.set(eid, row);
    });
    const byEditorFormat = [...fmtAgg.entries()].map(([editorId, v]) => {
      const p = editorId === "__none__" ? null : profileById.get(editorId);
      const total = v.lofi + v.facil + v.basico + v.avancado;
      return {
        editorId: editorId === "__none__" ? null : editorId,
        name: p?.name ?? "— Sem editor",
        color: p?.color ?? "#555",
        icon: p?.icon ?? null,
        ...v,
        total,
      };
    }).sort((a, b) => b.total - a.total);
    const formatTotals = byEditorFormat.reduce(
      (a, r) => ({ lofi: a.lofi + r.lofi, facil: a.facil + r.facil, basico: a.basico + r.basico, avancado: a.avancado + r.avancado }),
      { lofi: 0, facil: 0, basico: 0, avancado: 0 },
    );

    // ---- enrich history with names ----
    const enriched = history.map((h) => ({
      ...h,
      userName: profileById.get(h.userId)?.name ?? "—",
      userColor: profileById.get(h.userId)?.color ?? "#888",
      editorName: h.editorId ? (profileById.get(h.editorId)?.name ?? null) : null,
    }));

    return { summary, byMember: byMemberWithPct, byEditorFormat, formatTotals, history: enriched, activitySummary, activityByMember, activityFeed: enrichedActivity };
  });

export const getMemberReportDetail = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId: string; from: string; to: string }) =>
    z.object({ userId: z.string().uuid(), from: z.string(), to: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");

    const fromISO = new Date(data.from).toISOString();
    const toISO = new Date(data.to).toISOString();

    // Monthly (last 6 months from `to`)
    const to = new Date(data.to);
    const monthly: { key: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - i, 1));
      monthly.push({ key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, count: 0 });
    }
    const monthlyStart = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 5, 1)).toISOString();

    const { data: finRows } = await context.supabase
      .from("finalizations")
      .select("finalized_at, content_items!inner(id, type, title, editor_id, reel_type, due_date, months!inner(key, clients!inner(id, name, color, category)))")
      .eq("user_id", data.userId)
      .gte("finalized_at", monthlyStart);

    (finRows ?? []).forEach((r: any) => {
      const d = new Date(r.finalized_at);
      const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const h = monthly.find((x) => x.key === k);
      if (h) h.count++;
    });

    // Lists within [from, to)
    const inRange = (r: any) => r.finalized_at >= fromISO && r.finalized_at < toISO;
    const baseList = (finRows ?? []).filter(inRange).map((r: any) => ({
      finalizedAt: r.finalized_at,
      itemId: r.content_items.id,
      type: r.content_items.type as "post" | "reel" | "outros",
      title: r.content_items.title,
      reelType: r.content_items.reel_type ?? null,
      editorId: r.content_items.editor_id ?? null,
      clientId: r.content_items.months.clients.id,
      clientName: r.content_items.months.clients.name,
      clientColor: r.content_items.months.clients.color,
      lateDays: computeLateDays(r.content_items.due_date, r.finalized_at),
    }));

    // Reels edited by this user (editor_id)
    const { data: editedRows } = await context.supabase
      .from("finalizations")
      .select("finalized_at, content_items!inner(id, type, title, editor_id, reel_type, due_date, months!inner(clients!inner(id, name, color)))")
      .eq("content_items.editor_id", data.userId)
      .gte("finalized_at", fromISO)
      .lt("finalized_at", toISO);
    const editedReels = (editedRows ?? [])
      .filter((r: any) => r.content_items?.type === "reel")
      .map((r: any) => ({
        finalizedAt: r.finalized_at,
        itemId: r.content_items.id,
        title: r.content_items.title,
        reelType: r.content_items.reel_type ?? null,
        clientId: r.content_items.months.clients.id,
        clientName: r.content_items.months.clients.name,
        clientColor: r.content_items.months.clients.color,
        lateDays: computeLateDays(r.content_items.due_date, r.finalized_at),
      }));

    // Stories / cleaning in range
    const fromDay = data.from.slice(0, 10);
    const toDay = data.to.slice(0, 10);
    const { data: storyRows } = await context.supabase
      .from("stories_schedule").select("day, updated_at")
      .eq("user_id", data.userId)
      .gte("day", fromDay).lt("day", toDay);
    const stories = (storyRows ?? []).map((s: any) => ({
      day: s.day,
      finalizedAt: s.updated_at ?? new Date(s.day + "T12:00:00Z").toISOString(),
    }));

    const { data: cleanRows } = await context.supabase
      .from("cleaning_schedule").select("task_idx, weekday, updated_at")
      .eq("user_id", data.userId)
      .gte("updated_at", fromISO).lt("updated_at", toISO);
    const cleaning = (cleanRows ?? []).map((c: any) => ({
      taskIdx: c.task_idx, weekday: c.weekday, finalizedAt: c.updated_at,
    }));

    return {
      monthly,
      posts: baseList.filter((x) => x.type === "post").sort((a, b) => b.finalizedAt.localeCompare(a.finalizedAt)),
      reels: baseList.filter((x) => x.type === "reel").sort((a, b) => b.finalizedAt.localeCompare(a.finalizedAt)),
      outros: baseList.filter((x) => x.type === "outros").sort((a, b) => b.finalizedAt.localeCompare(a.finalizedAt)),
      editedReels: editedReels.sort((a, b) => b.finalizedAt.localeCompare(a.finalizedAt)),
      stories: stories.sort((a, b) => b.finalizedAt.localeCompare(a.finalizedAt)),
      cleaning: cleaning.sort((a, b) => b.finalizedAt.localeCompare(a.finalizedAt)),
    };
  });

/* ============================================================
 * WORKLOAD — carga de todos os membros ativos
 * ============================================================ */

export type MemberWorkloadRow = {
  userId: string;
  name: string;
  color: string;
  icon: string | null;
  avatarUrl: string | null;
  openCount: number;
  dueSoon: number;  // itens com prazo nos próximos 3 dias
  overdue: number;  // itens com prazo já passado
  byType: { post: number; reel: number; outros: number };
};

export const getAllMembersWorkload = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<MemberWorkloadRow[]> => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");

    // All active profiles
    const { data: profiles } = await context.supabase
      .from("profiles").select("id, name, color, icon, avatar_url").eq("active", true);

    if (!profiles?.length) return [];

    // All open items with assignees and due dates
    const { data: openItems } = await context.supabase
      .from("content_items")
      .select("id, type, due_date, item_assignees(user_id)")
      .neq("status", "PRONTO_PARA_PUBLICAR")
      .neq("status", "TRAVADO");

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in3days = new Date(today); in3days.setDate(in3days.getDate() + 3);

    const avatarMap = await signAvatarPaths(context.supabase, (profiles ?? []).map((p: any) => p.avatar_url));

    return (profiles ?? []).map((p: any) => {
      const myItems = (openItems ?? []).filter((it: any) =>
        (it.item_assignees ?? []).some((a: any) => a.user_id === p.id)
      );
      const byType = { post: 0, reel: 0, outros: 0 };
      let dueSoon = 0; let overdue = 0;
      myItems.forEach((it: any) => {
        if (it.type === "post") byType.post++;
        else if (it.type === "reel") byType.reel++;
        else byType.outros++;
        if (it.due_date) {
          const due = new Date(it.due_date + "T23:59:59");
          if (due < today) overdue++;
          else if (due <= in3days) dueSoon++;
        }
      });
      return {
        userId: p.id, name: p.name, color: p.color, icon: p.icon,
        avatarUrl: p.avatar_url ? (avatarMap.get(p.avatar_url) ?? null) : null,
        openCount: myItems.length, dueSoon, overdue, byType,
      };
    }).sort((a, b) => b.openCount - a.openCount);
  });

/* ============================================================
 * VELOCIDADE INDIVIDUAL — lead time por membro e tipo
 * ============================================================ */

export type MemberVelocityRow = {
  userId: string;
  name: string;
  color: string;
  icon: string | null;
  avatarUrl: string | null;
  totalFinished: number;
  avgLeadTimeDays: number | null;
  byType: {
    post: { count: number; avgDays: number | null };
    reel: { count: number; avgDays: number | null };
    outros: { count: number; avgDays: number | null };
  };
};

export const getMemberVelocity = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { from: string; to: string }) =>
    z.object({ from: z.string(), to: z.string() }).parse(d))
  .handler(async ({ data, context }): Promise<MemberVelocityRow[]> => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: profiles } = await context.supabase
      .from("profiles").select("id, name, color, icon, avatar_url").eq("active", true);

    if (!profiles?.length) return [];

    // Finished items in range with lead time data and assignees
    const { data: items } = await context.supabase
      .from("content_items")
      .select("id, type, started_at, finished_at, item_assignees(user_id)")
      .eq("status", "PRONTO_PARA_PUBLICAR")
      .not("started_at", "is", null)
      .not("finished_at", "is", null)
      .gte("finished_at", data.from)
      .lt("finished_at", data.to);

    const avatarMap = await signAvatarPaths(context.supabase, (profiles ?? []).map((p: any) => p.avatar_url));

    return (profiles ?? []).map((p: any) => {
      const myItems = (items ?? []).filter((it: any) =>
        (it.item_assignees ?? []).some((a: any) => a.user_id === p.id)
      );

      function calcAvg(subset: any[]) {
        if (!subset.length) return null;
        const daysArr = subset.map((it: any) => {
          const ms = new Date(it.finished_at).getTime() - new Date(it.started_at).getTime();
          return ms / 86_400_000;
        });
        return Math.round((daysArr.reduce((a, b) => a + b, 0) / daysArr.length) * 10) / 10;
      }

      const posts = myItems.filter((i: any) => i.type === "post");
      const reels = myItems.filter((i: any) => i.type === "reel");
      const outros = myItems.filter((i: any) => i.type === "outros");

      return {
        userId: p.id, name: p.name, color: p.color, icon: p.icon,
        avatarUrl: p.avatar_url ? (avatarMap.get(p.avatar_url) ?? null) : null,
        totalFinished: myItems.length,
        avgLeadTimeDays: calcAvg(myItems),
        byType: {
          post: { count: posts.length, avgDays: calcAvg(posts) },
          reel: { count: reels.length, avgDays: calcAvg(reels) },
          outros: { count: outros.length, avgDays: calcAvg(outros) },
        },
      };
    }).filter((r) => r.totalFinished > 0)
      .sort((a, b) => (a.avgLeadTimeDays ?? 999) - (b.avgLeadTimeDays ?? 999));
  });