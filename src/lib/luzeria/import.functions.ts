// One-time client import from Trello/ClickUp. Read-only, no ongoing sync —
// the user pastes a personal token, we fetch their boards/lists once, they
// pick which ones become clients, and we bulk-create them.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* ============== TRELLO ============== */

export const getTrelloAuthUrl = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async () => {
    const key = process.env.TRELLO_API_KEY;
    if (!key) throw new Error("Integração com Trello não configurada.");
    const url = `https://trello.com/1/authorize?expiration=never&scope=read&response_type=token&name=${encodeURIComponent("Modo Criador")}&key=${key}`;
    return { url };
  });

export const fetchTrelloBoards = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { token: string }) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env.TRELLO_API_KEY;
    if (!key) throw new Error("Integração com Trello não configurada.");
    const res = await fetch(
      `https://api.trello.com/1/members/me/boards?key=${key}&token=${data.token}&fields=name,id&filter=open`,
    );
    if (!res.ok) throw new Error("Não foi possível acessar sua conta do Trello. Confira o token.");
    const boards = (await res.json()) as { id: string; name: string }[];
    return boards.map((b) => ({ id: b.id, name: b.name }));
  });

export const fetchTrelloLists = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { token: string; boardId: string }) =>
    z.object({ token: z.string().min(10), boardId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env.TRELLO_API_KEY;
    if (!key) throw new Error("Integração com Trello não configurada.");
    const res = await fetch(
      `https://api.trello.com/1/boards/${data.boardId}/lists?key=${key}&token=${data.token}&fields=name,id&filter=open`,
    );
    if (!res.ok) throw new Error("Não foi possível buscar as listas desse quadro.");
    const lists = (await res.json()) as { id: string; name: string }[];
    return lists.map((l) => ({ id: l.id, name: l.name }));
  });

/* ============== CLICKUP ============== */

async function clickUpFetch(path: string, token: string) {
  const res = await fetch(`https://api.clickup.com/api/v2${path}`, {
    headers: { Authorization: token },
  });
  if (!res.ok) throw new Error("Não foi possível acessar sua conta do ClickUp. Confira o token.");
  return res.json() as Promise<any>;
}

export const fetchClickUpTeams = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { token: string }) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    const json = await clickUpFetch("/team", data.token);
    return ((json.teams ?? []) as any[]).map((t) => ({ id: t.id as string, name: t.name as string }));
  });

export const fetchClickUpSpaces = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { token: string; teamId: string }) =>
    z.object({ token: z.string().min(10), teamId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const json = await clickUpFetch(`/team/${data.teamId}/space?archived=false`, data.token);
    return ((json.spaces ?? []) as any[]).map((s) => ({ id: s.id as string, name: s.name as string }));
  });

export const fetchClickUpLists = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { token: string; spaceId: string }) =>
    z.object({ token: z.string().min(10), spaceId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const [folderless, folders] = await Promise.all([
      clickUpFetch(`/space/${data.spaceId}/list?archived=false`, data.token),
      clickUpFetch(`/space/${data.spaceId}/folder?archived=false`, data.token),
    ]);
    const lists: { id: string; name: string }[] = ((folderless.lists ?? []) as any[])
      .map((l) => ({ id: l.id as string, name: l.name as string }));
    for (const folder of (folders.folders ?? []) as any[]) {
      for (const l of (folder.lists ?? []) as any[]) {
        lists.push({ id: l.id as string, name: `${folder.name} / ${l.name}` });
      }
    }
    return lists;
  });

/* ============== IMPORT ============== */

async function seedMonth(supabase: any, clientId: string, key: string) {
  const { data: month, error: mErr } = await supabase
    .from("months").insert({ client_id: clientId, key }).select().single();
  if (mErr) throw new Error(mErr.message);
  const items = [];
  for (let i = 1; i <= 6; i++) items.push({ month_id: month.id, type: "post", idx: i, title: `Post ${i}` });
  for (let i = 1; i <= 6; i++) items.push({ month_id: month.id, type: "reel", idx: i, title: `Reels ${i}` });
  const { error: iErr } = await supabase.from("content_items").insert(items);
  if (iErr) throw new Error(iErr.message);
}

export const importClients = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { names: string[]; source: "trello" | "clickup" }) =>
    z.object({
      names: z.array(z.string().trim().min(1).max(80)).min(1).max(200),
      source: z.enum(["trello", "clickup"]),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: org } = await context.supabase.from("orgs").select("plan_id").eq("id", context.orgId).maybeSingle();
    const { data: plan } = await context.supabase.from("plans").select("max_clients").eq("id", org?.plan_id ?? "solo").maybeSingle();
    const { count: currentCount } = await context.supabase
      .from("clients").select("id", { count: "exact", head: true }).eq("archived", false).neq("category", "Ex-clientes");

    const isLuzeria = context.orgId === "00000000-0000-0000-0000-000000000001";
    const maxClients = isLuzeria ? Infinity : (plan?.max_clients ?? Infinity);
    const slotsLeft = Math.max(0, maxClients - (currentCount ?? 0));
    const toImport = data.names.slice(0, slotsLeft);
    const skipped = data.names.length - toImport.length;

    const sourceLabel = data.source === "trello" ? "Trello" : "ClickUp";
    const key = monthKey(new Date());
    let imported = 0;
    for (const name of toImport) {
      const { data: client, error } = await context.supabase
        .from("clients")
        .insert({ name, org_id: context.orgId, notes: `Importado do ${sourceLabel}` })
        .select("id").single();
      if (error) throw new Error(error.message);
      await seedMonth(context.supabase, client.id, key);
      imported++;
    }
    return { imported, skipped };
  });
