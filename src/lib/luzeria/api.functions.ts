import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Client, ContentItem, ContentType, MonthData, Profile, Role, Status } from "./types";

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

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    if (data.userId === context.userId) throw new Error("Não é possível remover a si mesmo.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; password: string; name: string; role: Role }) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().min(1).max(80),
      role: z.enum(["master","setor","member"]),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name },
    });
    if (error) throw new Error(error.message);
    const uid = created.user?.id;
    if (!uid) throw new Error("Falha ao criar usuário.");
    // Trigger handle_new_user already inserted profile + member role. Override:
    await supabaseAdmin.from("profiles").update({ name: data.name, active: true }).eq("id", uid);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    return { ok: true, id: uid };
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
      category: (c as any).category ?? "Social Media",
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
        .from("content_items").select("id, type, idx, title").eq("month_id", fromMonth.id).order("idx");
      if (oldItems?.length) {
        // Insert new items in the same shape (status defaults to PLANEJAMENTO).
        const { data: inserted, error: insErr } = await context.supabase.from("content_items")
          .insert(oldItems.map((it) => ({
            month_id: newMonth.id, type: it.type, idx: it.idx, title: it.title,
            status: "PLANEJAMENTO" as Status,
          })))
          .select("id, type, idx");
        if (insErr) throw new Error(insErr.message);
        // Carry over assignees by matching (type, idx).
        const oldIdByKey = new Map<string, string>();
        oldItems.forEach((it: any) => oldIdByKey.set(`${it.type}:${it.idx}`, it.id));
        const newIdByKey = new Map<string, string>();
        (inserted ?? []).forEach((it: any) => newIdByKey.set(`${it.type}:${it.idx}`, it.id));
        const oldItemIds = [...oldIdByKey.values()];
        if (oldItemIds.length) {
          const { data: oldAssign } = await context.supabase
            .from("item_assignees").select("item_id, user_id").in("item_id", oldItemIds);
          const rows: { item_id: string; user_id: string }[] = [];
          (oldAssign ?? []).forEach((a: any) => {
            const old = oldItems.find((o: any) => o.id === a.item_id);
            if (!old) return;
            const newId = newIdByKey.get(`${old.type}:${old.idx}`);
            if (newId) rows.push({ item_id: newId, user_id: a.user_id });
          });
          if (rows.length) await context.supabase.from("item_assignees").insert(rows);
        }
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
    const { data: clientRow } = await context.supabase
      .from("clients").select("category").eq("id", data.clientId).maybeSingle();
    const isAvulso = ((clientRow as any)?.category ?? "Social Media") === "Avulsos";
    if (!month) {
      const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
      if (!isAdmin) return null;
      if (isAvulso) {
        const { data: m, error } = await context.supabase
          .from("months").insert({ client_id: data.clientId, key: data.key }).select().single();
        if (error) throw new Error(error.message);
        month = { id: m.id, key: m.key };
      } else {
        const seeded = await seedMonth(context.supabase, data.clientId, data.key);
        month = { id: seeded.id, key: seeded.key };
      }
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
      id: it.id, type: it.type as ContentType, idx: it.idx, title: it.title,
      status: it.status as Status, copy: it.copy, driveLink: it.drive_link,
      assigneeIds: itemAssignees.get(it.id) ?? [],
      comments: itemComments.get(it.id) ?? [],
      updatedAt: it.updated_at,
      reelType: ((it as any).reel_type ?? null) as any,
    }));
    return {
      id: month.id, key: month.key,
      posts: mapped.filter((i) => i.type === "post"),
      reels: mapped.filter((i) => i.type === "reel"),
      outros: mapped.filter((i) => i.type === "outros"),
    };
  });

/* ============== ITEMS ============== */

export const updateItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: { title?: string; copy?: string; drive_link?: string; reel_type?: string | null } }) => d)
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

export const addContentItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string; key: string; type: ContentType; title?: string }) =>
    z.object({
      clientId: z.string().uuid(),
      key: z.string(),
      type: z.enum(["post", "reel", "outros"]),
      title: z.string().trim().max(200).optional(),
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
    const fallback = data.type === "post" ? `Post ${nextIdx}` : data.type === "reel" ? `Reels ${nextIdx}` : `Item ${nextIdx}`;
    const { data: inserted, error: iErr } = await context.supabase
      .from("content_items").insert({
        month_id: month.id, type: data.type, idx: nextIdx,
        title: (data.title?.trim() || fallback),
      }).select("id").single();
    if (iErr) throw new Error(iErr.message);
    return { id: inserted.id };
  });

export const deleteItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase.from("content_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
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
      .select("id, type, idx, title, status, month_id, months!inner(client_id, key, clients!inner(id, name, color, category))")
      .in("id", itemIds);
    return (items ?? []).map((it: any) => ({
      id: it.id, type: it.type, idx: it.idx, title: it.title, status: it.status,
      monthKey: it.months.key, clientId: it.months.clients.id,
      clientName: it.months.clients.name, clientColor: it.months.clients.color,
      clientCategory: it.months.clients.category ?? "Social Media",
    }));
  });

/* ============== PRODUCTIVITY ============== */

export const getProductivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
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
    const { data: assigns } = await context.supabase
      .from("item_assignees").select("item_id").eq("user_id", targetUser);
    const itemIds = (assigns ?? []).map((a) => a.item_id);
    if (itemIds.length === 0) {
      return { weeks: [0, 0, 0, 0], items: [[], [], [], []] as string[][], total: 0, history: [] };
    }
    const { data: done } = await context.supabase
      .from("content_items").select("id, title, updated_at")
      .in("id", itemIds).eq("status", "FINALIZADO")
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
      .in("id", itemIds).eq("status", "FINALIZADO")
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

/* ============== STORIES SCHEDULE ============== */

export const listStories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { monthKey: string }) => d)
  .handler(async ({ data, context }) => {
    const [y, m] = data.monthKey.split("-").map(Number);
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const endDate = new Date(Date.UTC(y, m, 1));
    const end = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const { data: rows, error } = await context.supabase
      .from("stories_schedule")
      .select("id, day, user_id, label")
      .gte("day", start).lt("day", end);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id as string, day: r.day as string,
      userId: (r.user_id ?? null) as string | null,
      label: (r.label ?? null) as string | null,
    }));
  });

export const upsertStoryDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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

export const getMyToday = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId?: string; today: string; weekday: number }) => d)
  .handler(async ({ data, context }) => {
    let targetUser = context.userId;
    if (data.userId && data.userId !== context.userId) {
      const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
      if (!isAdmin) throw new Error("Forbidden");
      targetUser = data.userId;
    }
    const { data: story } = await context.supabase
      .from("stories_schedule").select("day").eq("day", data.today).eq("user_id", targetUser).maybeSingle();
    let cleaning: number[] = [];
    if (data.weekday >= 0 && data.weekday <= 5) {
      const { data: rows } = await context.supabase
        .from("cleaning_schedule").select("task_idx").eq("weekday", data.weekday).eq("user_id", targetUser);
      cleaning = (rows ?? []).map((r: any) => r.task_idx as number);
    }
    return { stories: !!story, cleaningTaskIdx: cleaning };
  });

/* ============== CLEANING ============== */

export const getCleaning = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: rows }, { data: settings }] = await Promise.all([
      context.supabase.from("cleaning_schedule").select("id, task_idx, weekday, user_id, label"),
      context.supabase.from("cleaning_settings").select("note").eq("id", 1).maybeSingle(),
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
    };
  });

export const upsertCleaningCell = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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

export const updateCleaningNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { monthKey: string }) =>
    z.object({ monthKey: z.string().regex(/^\d{4}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: clientsAll } = await context.supabase
      .from("clients").select("id, name, color, archived, category").order("name");
    // "Ex-clientes" não entram nas métricas nem na listagem do dashboard.
    const clients = (clientsAll ?? []).filter(
      (c: any) => (c.category ?? "Social Media") !== "Ex-clientes"
    );
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
      posts: number; reels: number; total: number; done: number; percent: number;
    };
    const rows: Row[] = (clients ?? []).map((c: any) => {
      const mid = monthByClient.get(c.id);
      const its = mid ? (items ?? []).filter((it: any) => it.month_id === mid) : [];
      const posts = its.filter((i) => i.type === "post").length;
      const reels = its.filter((i) => i.type === "reel").length;
      const total = its.length;
      const done = its.filter((i) => i.status === "FINALIZADO").length;
      const percent = total ? Math.round((done / total) * 100) : 0;
      return {
        id: c.id, name: c.name, color: c.color, archived: !!c.archived,
        category: c.category ?? "Social Media",
        posts, reels, total, done, percent,
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
  .middleware([requireSupabaseAuth])
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
      .from("profiles").select("id, name, color, icon");
    const ranking = (profiles ?? [])
      .map((p: any) => ({
        id: p.id, name: p.name, color: p.color, icon: p.icon,
        count: counts.get(p.id) ?? 0,
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
    return { period: data.period, ranking };
  });

/* ============== MEMBER FINALIZATIONS ============== */

export const getMemberFinalizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
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