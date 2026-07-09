import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { exchangeGoogleAuthCode, fetchGoogleUserEmail, refreshGoogleAccessToken } from "./google-oauth";
import { z } from "zod";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

const APP_URL = process.env.VITE_APP_URL ?? "https://modo.luzeriaestudio.com.br";
const REDIRECT_URI = `${APP_URL}/oauth/google-calendar-callback`;

function googleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Credenciais do Google ausentes no servidor (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET).");
  }
  return { clientId, clientSecret };
}

/* ============== CONNECT / DISCONNECT ============== */

export const getGoogleCalendarAuthUrl = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async () => {
    const { clientId } = googleCredentials();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: CALENDAR_SCOPE,
      access_type: "offline",
      prompt: "consent",
    });
    return { url: `${AUTH_URL}?${params.toString()}` };
  });

export const exchangeGoogleCalendarCode = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { code: string }) =>
    z.object({ code: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { clientId, clientSecret } = googleCredentials();
    const tokens = await exchangeGoogleAuthCode({
      clientId, clientSecret, code: data.code, redirectUri: REDIRECT_URI,
    });
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

/* ============== TODAY'S EVENTS ============== */

async function getValidAccessToken(
  supabase: any,
  userId: string,
): Promise<string | null> {
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

    const accessToken = await getValidAccessToken(context.supabase, targetUserId);
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
    const res = await fetch(`${CALENDAR_EVENTS_URL}?${params.toString()}`, {
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
