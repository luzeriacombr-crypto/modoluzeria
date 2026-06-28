import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Client, ContentItem, MonthData, Profile, Role, Status } from "./types";

/* ============== PROFILES & ROLES ============== */

export const listProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profiles, error } = await context.supabase
      .from("profiles")
      .select("id, email, name, color, icon, active")
      .order("name");
    if (error) throw new Error(error.message);
    const { data: roles } = await context.supabase.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, Role>();
    (roles ?? []).forEach((r) => roleMap.set(r.user_id, r.role as Role));
    return (profiles ?? []).map<Profile>((p) => ({
      id: p.id,
      email: p.email,
      name: p.name,
      color: p.color,
      icon: p.icon,
      active: p.active,
      role: roleMap.get(p.id) ?? "member",
    }));
  });

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles").select("*").eq("id", context.userId).maybeSingle();
    const { data: roleRow } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).maybeSingle();
    if (!profile) return null;
    return {
      id: profile.id, email: profile.email, name: profile.name,
      color: profile.color, icon: profile.icon, active: profile.active,
      role: (roleRow?.role ?? "member") as Role,
    } satisfies Profile;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name?: string; color?: string; icon?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles").update(data).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; active: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    const { error } = await context.supabase.from("profiles").update({ active: data.active }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============== CLIENTS ============== */

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("clients").select("*").order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map<Client>((c) => ({
      id: c.id, name: c.name, color: c.color, icon: c.icon,
      favorite: c.favorite, archived: c.archived,
      customFields: {
        niche: c.niche ?? "",
        postsPerWeek: c.posts_per_week ?? 0,
        reelsPerWeek: c.reels_per_week ?? 0,
        fixedResponsibleId: c.fixed_responsible_id,
        reviewDay: c.review_day ?? "",
        notes: c.notes ?? "",
      },
      createdAt: c.created_at,
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
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) => z.object({ name: z.string().trim().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: client, error } = await context.supabase
      .from("clients").insert({ name: data.name }).select().single();
    if (error) throw new Error(error.message);
    const key = monthKey(new Date());
    await seedMonth(context.supabase, client.id, key);
    return { id: client.id };
  });

export const updateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: Record<string, any> }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("clients").update(data.patch as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("clients").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
        .from("content_items").select("type, idx, title").eq("month_id", fromMonth.id).order("idx");
      if (oldItems?.length) {
        await context.supabase.from("content_items").insert(
          oldItems.map((it) => ({ month_id: newMonth.id, type: it.type, idx: it.idx, title: it.title }))
        );
      }
    } else {
      const items: any[] = [];
      for (let i = 1; i <= 6; i++) items.push({ month_id: newMonth.id, type: "post", idx: i, title: `Post ${i}` });
      for (let i = 1; i <= 6; i++) items.push({ month_id: newMonth.id, type: "reel", idx: i, title: `Reels ${i}` });
      await context.supabase.from("content_items").insert(items);
    }
    return { key: newKey };
  });

export const listMonthKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: months } = await context.supabase
      .from("months").select("key").eq("client_id", data.clientId).order("key");
    return (months ?? []).map((m) => m.key);
  });

export const getMonth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string; key: string }) => d)
  .handler(async ({ data, context }): Promise<MonthData | null> => {
    let { data: month } = await context.supabase
      .from("months").select("id, key").eq("client_id", data.clientId).eq("key", data.key).maybeSingle();
    if (!month) {
      const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
      if (!isAdmin) return null;
      const seeded = await seedMonth(context.supabase, data.clientId, data.key);
      month = { id: seeded.id, key: seeded.key };
    }
    const [{ data: items }, { data: assignees }, { data: comments }] = await Promise.all([
      context.supabase.from("content_items").select("*").eq("month_id", month.id).order("type").order("idx"),
      context.supabase.from("item_assignees").select("item_id, user_id").in("item_id",
        (await context.supabase.from("content_items").select("id").eq("month_id", month.id)).data?.map((x) => x.id) ?? []),
      context.supabase.from("comments").select("id, item_id, author_id, text, is_system, created_at").in("item_id",
        (await context.supabase.from("content_items").select("id").eq("month_id", month.id)).data?.map((x) => x.id) ?? []).order("created_at"),
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
      id: it.id, type: it.type as "post" | "reel", idx: it.idx, title: it.title,
      status: it.status as Status, copy: it.copy, driveLink: it.drive_link,
      assigneeIds: itemAssignees.get(it.id) ?? [],
      comments: itemComments.get(it.id) ?? [],
      updatedAt: it.updated_at,
    }));
    return {
      id: month.id, key: month.key,
      posts: mapped.filter((i) => i.type === "post"),
      reels: mapped.filter((i) => i.type === "reel"),
    };
  });

/* ============== ITEMS ============== */

export const updateItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: { title?: string; copy?: string; drive_link?: string } }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("content_items").update(data.patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setItemStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: Status }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("content_items").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addAssignee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { itemId: string; userId: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("item_assignees")
      .insert({ item_id: data.itemId, user_id: data.userId });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const removeAssignee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { itemId: string; userId: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("item_assignees")
      .delete().eq("item_id", data.itemId).eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notifications").select("*").eq("user_id", context.userId)
      .order("created_at", { ascending: false }).limit(50);
    return (data ?? []).map((n) => ({
      id: n.id, type: n.type, itemId: n.item_id,
      message: n.message, read: n.read, createdAt: n.created_at,
    }));
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; all?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const q = context.supabase.from("notifications").update({ read: true }).eq("user_id", context.userId);
    if (data.id) await q.eq("id", data.id);
    else await q.eq("read", false);
    return { ok: true };
  });

/* ============== MY TASKS ============== */

export const listMyTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
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
      .select("id, type, idx, title, status, month_id, months!inner(client_id, key, clients!inner(id, name, color))")
      .in("id", itemIds);
    return (items ?? []).map((it: any) => ({
      id: it.id, type: it.type, idx: it.idx, title: it.title, status: it.status,
      monthKey: it.months.key, clientId: it.months.clients.id,
      clientName: it.months.clients.name, clientColor: it.months.clients.color,
    }));
  });