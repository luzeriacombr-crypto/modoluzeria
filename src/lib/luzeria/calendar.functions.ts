import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { signCoverPaths } from "./api.functions";
import { exchangeGoogleAuthCode, fetchGoogleUserEmail, refreshGoogleAccessToken } from "./google-oauth";

export const getCalendarItems = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { from: string; to: string }) =>
    z.object({ from: z.string(), to: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: items, error } = await context.supabase
      .from("content_items")
      .select(
        "id, title, type, status, scheduled_at, cover_path, months!inner(key, clients!months_client_id_fkey!inner(id, name, color, category, archived))",
      )
      .gte("scheduled_at", data.from)
      .lt("scheduled_at", data.to)
      .not("scheduled_at", "is", null);
    if (error) throw error;

    const filtered = (items ?? []).filter((it: any) => {
      const client = it.months?.clients;
      if (!client || client.archived) return false;
      if ((client.category ?? "Social Media") === "Ex-clientes") return false;
      return true;
    });

    const signedCovers = await signCoverPaths(context.supabase, filtered.map((it: any) => it.cover_path));

    return filtered.map((it: any) => ({
      id: it.id,
      title: it.title,
      type: it.type,
      status: it.status,
      scheduledAt: it.scheduled_at,
      monthKey: it.months.key,
      clientId: it.months.clients.id,
      clientName: it.months.clients.name,
      clientColor: it.months.clients.color,
      coverUrl: it.cover_path ? signedCovers.get(it.cover_path) ?? null : null,
    }));
  });

/* ===== GOOGLE AGENDA (per-user, distinct from the internal content
 * calendar above — each team member connects their own Google account) ===== */

const GCAL_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GCAL_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
// calendar.events covers read+write on events (enough for "today's events"
// and creating new compromissos) without the broader calendar-management
// access full "calendar" scope would grant.
const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar.events";

function googleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Credenciais do Google ausentes no servidor (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET).");
  }
  return { clientId, clientSecret };
}

export const getGoogleCalendarAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { redirectOrigin: string }) =>
    z.object({ redirectOrigin: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    const { clientId } = googleCredentials();
    const redirectUri = `${data.redirectOrigin}/oauth/google-calendar-callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GCAL_SCOPE,
      access_type: "offline",
      prompt: "consent",
    });
    return { url: `${GCAL_AUTH_URL}?${params.toString()}` };
  });

export const completeGoogleCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { code: string; redirectOrigin: string }) =>
    z.object({ code: z.string().min(1), redirectOrigin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { clientId, clientSecret } = googleCredentials();
    const redirectUri = `${data.redirectOrigin}/oauth/google-calendar-callback`;
    const tokens = await exchangeGoogleAuthCode({ clientId, clientSecret, code: data.code, redirectUri });
    if (!tokens.refreshToken) {
      throw new Error("O Google não retornou permissão de acesso contínuo. Tente desconectar e conectar de novo.");
    }
    const email = await fetchGoogleUserEmail(tokens.accessToken);
    const { error } = await context.supabase
      .from("user_calendar_tokens")
      .upsert({
        user_id: context.userId,
        google_email: email ?? "conta do Google",
        refresh_token: tokens.refreshToken,
        access_token: tokens.accessToken,
        access_token_expires_at: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
      }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true, email };
  });

export const disconnectGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("user_calendar_tokens")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyCalendarConnection = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_calendar_tokens")
      .select("google_email, created_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      connected: !!data,
      email: data?.google_email ?? null,
      connectedAt: data?.created_at ?? null,
    };
  });

async function getValidCalendarAccessToken(supabase: any, userId: string): Promise<string | null> {
  const { data: row } = await supabase
    .from("user_calendar_tokens")
    .select("refresh_token, access_token, access_token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) return null;

  const expiresAt = row.access_token_expires_at ? new Date(row.access_token_expires_at).getTime() : 0;
  if (row.access_token && expiresAt > Date.now() + 300_000) {
    return row.access_token;
  }

  const { clientId, clientSecret } = googleCredentials();
  try {
    const { accessToken, expiresIn } = await refreshGoogleAccessToken({
      clientId, clientSecret, refreshToken: row.refresh_token,
    });
    await supabase
      .from("user_calendar_tokens")
      .update({
        access_token: accessToken,
        access_token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      })
      .eq("user_id", userId);
    return accessToken;
  } catch {
    // Refresh token revoked/expired — drop the broken connection so the UI prompts reconnect.
    await supabase.from("user_calendar_tokens").delete().eq("user_id", userId);
    return null;
  }
}

export const getTodayCalendarEvents = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId?: string }) =>
    z.object({ userId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const targetUserId = data.userId ?? context.userId;
    // Only the account owner can read their own calendar — never let an
    // admin "view as" another member pull that member's personal agenda.
    if (targetUserId !== context.userId) {
      return { connected: false, events: [] as any[] };
    }

    const accessToken = await getValidCalendarAccessToken(context.supabase, targetUserId);
    if (!accessToken) return { connected: false, events: [] as any[] };

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const params = new URLSearchParams({
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "20",
    });
    const res = await fetch(`${GCAL_EVENTS_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { connected: true, events: [] as any[] };
    const json: any = await res.json();
    const events = (json.items ?? [])
      .filter((e: any) => e.status !== "cancelled")
      .map((e: any) => ({
        id: e.id,
        title: e.summary ?? "(sem título)",
        start: e.start?.dateTime ?? e.start?.date ?? null,
        allDay: !e.start?.dateTime,
        location: e.location ?? null,
      }));
    return { connected: true, events };
  });

// Pure wall-clock arithmetic (no timezone conversion) — used to derive an
// end time from a start time without pulling in a date library. Treating
// the input as UTC for the addition is safe here since we only ever add a
// fixed duration and re-read it back as a wall-clock value.
function shiftLocalDateTime(date: string, time: string, minutesToAdd: number) {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const shifted = new Date(Date.UTC(y, mo - 1, d, h, mi) + minutesToAdd * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
    time: `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`,
  };
}

export const createCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { title: string; date: string; time: string }) =>
    z.object({
      title: z.string().trim().min(1).max(200),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().regex(/^\d{2}:\d{2}$/),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const accessToken = await getValidCalendarAccessToken(context.supabase, context.userId);
    if (!accessToken) throw new Error("Conecte sua Google Agenda antes de criar um compromisso.");

    // 1h default duration — good enough for v1 (reuniões/gravações), no UI for a custom length yet.
    const end = shiftLocalDateTime(data.date, data.time, 60);
    const res = await fetch(GCAL_EVENTS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: data.title,
        start: { dateTime: `${data.date}T${data.time}:00-03:00` },
        end: { dateTime: `${end.date}T${end.time}:00-03:00` },
      }),
    });
    if (!res.ok) {
      const errJson: any = await res.json().catch(() => null);
      const msg = errJson?.error?.message ?? "";
      if (res.status === 403 || /insufficient/i.test(msg)) {
        throw new Error("Sua conexão com a Google Agenda não tem permissão pra criar compromissos. Desconecte e conecte de novo.");
      }
      throw new Error(msg || "Falha ao criar o compromisso na Google Agenda.");
    }
    return { ok: true };
  });
