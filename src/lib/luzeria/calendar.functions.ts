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
      // userinfo.email: sem ele, fetchGoogleUserEmail no callback volta
      // vazio e a conexão fica salva como "conta do Google" sem e-mail.
      scope: `${GCAL_SCOPE} https://www.googleapis.com/auth/userinfo.email`,
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

export async function getValidCalendarAccessToken(supabase: any, userId: string): Promise<string | null> {
  const { data: row } = await supabase
    .from("user_calendar_tokens")
    .select("refresh_token, access_token, access_token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) return null;

  const expiresAt = row.access_token_expires_at ? new Date(row.access_token_expires_at).getTime() : 0;
  if (row.access_token && expiresAt > Date.now() + 300_000) {
    // eslint-disable-next-line no-console
    return row.access_token;
  }

  const { clientId, clientSecret } = googleCredentials();
  try {
    // eslint-disable-next-line no-console
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
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[gcal] refresh token failed, dropping connection", err);
    // Refresh token revoked/expired — drop the broken connection so the UI prompts reconnect.
    await supabase.from("user_calendar_tokens").delete().eq("user_id", userId);
    return null;
  }
}

const UPCOMING_EVENTS_DAYS_AHEAD = 7;
const UPCOMING_EVENTS_LIMIT = 20;

export const getUpcomingCalendarEvents = createServerFn({ method: "GET" })
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

    // Do início do dia de HOJE (não "agora") — um compromisso de hoje que já
    // passou (ex: pagamento das 9h consultado às 14h) continua sendo "de
    // hoje" pra quem olha a agenda, não pode sumir da lista. "Hoje" segue no
    // fuso de Brasília, não no do servidor (UTC na Vercel).
    const todayInBrazil = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const startOfToday = new Date(`${todayInBrazil}T00:00:00-03:00`);
    const endOfWindow = new Date(startOfToday);
    endOfWindow.setDate(endOfWindow.getDate() + UPCOMING_EVENTS_DAYS_AHEAD);
    const params = new URLSearchParams({
      timeMin: startOfToday.toISOString(),
      timeMax: endOfWindow.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: String(UPCOMING_EVENTS_LIMIT),
    });
    // eslint-disable-next-line no-console
    const res = await fetch(`${GCAL_EVENTS_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // eslint-disable-next-line no-console
      console.error("[gcal] events fetch failed", res.status, body.slice(0, 500));
      return { connected: true, events: [] as any[] };
    }
    const json: any = await res.json();
    // eslint-disable-next-line no-console

    // O Google quase nunca manda displayName pros convidados (só o e-mail)
    // — "claudio.silva23" antes do @ fica feio. Troca pelo nome de
    // verdade quando o convidado é alguém da própria equipe (comparando
    // e-mail via service role, já que profiles.email é admin-only por
    // RLS). Nunca devolve e-mail nenhum pro cliente, só o nome.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: teammates } = await supabaseAdmin
      .from("profiles").select("name, email").eq("org_id", context.orgId);
    const nameByEmail = new Map<string, string>(
      (teammates ?? [])
        .filter((p: any) => p.email)
        .map((p: any) => [(p.email as string).toLowerCase(), p.name as string]));

    const events = (json.items ?? [])
      .filter((e: any) => e.status !== "cancelled")
      .map((e: any) => ({
        id: e.id,
        title: e.summary ?? "(sem título)",
        start: e.start?.dateTime ?? e.start?.date ?? null,
        end: e.end?.dateTime ?? e.end?.date ?? null,
        allDay: !e.start?.dateTime,
        location: e.location ?? null,
        description: e.description ?? null,
        link: e.htmlLink ?? null,
        meetLink: e.hangoutLink ?? null,
        // Exclui o próprio dono (é óbvio que ele "vai" ao próprio
        // compromisso) e quem recusou o convite.
        attendees: ((e.attendees ?? []) as any[])
          .filter((a) => !a.self && a.responseStatus !== "declined")
          .map((a) => {
            const email = (a.email as string | undefined)?.toLowerCase();
            return (email && nameByEmail.get(email)) || a.displayName || (email ? email.split("@")[0] : "Convidado");
          }),
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
  .inputValidator((d: { title: string; date: string; time: string; durationMinutes?: number; allDay?: boolean; location?: string; description?: string }) =>
    z.object({
      title: z.string().trim().min(1).max(200),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().regex(/^\d{2}:\d{2}$/),
      durationMinutes: z.number().int().min(15).max(24 * 60).optional(),
      allDay: z.boolean().optional(),
      location: z.string().trim().max(300).optional(),
      description: z.string().trim().max(2000).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const accessToken = await getValidCalendarAccessToken(context.supabase, context.userId);
    if (!accessToken) throw new Error("Conecte sua Google Agenda antes de criar um compromisso.");

    // Duração padrão de 1h (reuniões/gravações); o prompt de gravação deixa escolher (ou dia inteiro).
    const body: any = { summary: data.title };
    if (data.allDay) {
      const nextDay = shiftLocalDateTime(data.date, "00:00", 24 * 60);
      body.start = { date: data.date };
      body.end = { date: nextDay.date };
    } else {
      const end = shiftLocalDateTime(data.date, data.time, data.durationMinutes ?? 60);
      body.start = { dateTime: `${data.date}T${data.time}:00-03:00` };
      body.end = { dateTime: `${end.date}T${end.time}:00-03:00` };
    }
    if (data.location) body.location = data.location;
    if (data.description) body.description = data.description;
    const res = await fetch(GCAL_EVENTS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

/* ===== EVENTOS DE CAMPANHA (criados pelo admin em nome de um responsável)
 * — diferente de createCalendarEvent acima (a pessoa cria pra si mesma),
 * aqui quem chama recebe explicitamente um supabase de SERVICE ROLE (nunca
 * o context.supabase de quem está logado), porque precisa ler o refresh
 * token de OUTRA pessoa — user_calendar_tokens só deixa cada um ler a
 * própria linha. Falha (sem conexão, token revogado, API fora do ar) nunca
 * derruba a campanha: só retorna null/não faz nada, por decisão do Junior
 * de ignorar silenciosamente quem não conectou a agenda. ===== */

/** Cria (POST) ou atualiza (PATCH, se já existir um evento anterior) um
 * evento de DIA INTEIRO — a data de captação é só uma data, sem horário.
 * Retorna o id do evento (novo ou existente) pra guardar em
 * campaign_calendar_events, ou null se a pessoa não tem Google Agenda
 * conectado. */
export async function upsertCampaignCalendarEvent(
  supabaseAdmin: any,
  userId: string,
  existingEventId: string | null,
  event: { title: string; date: string },
): Promise<string | null> {
  const accessToken = await getValidCalendarAccessToken(supabaseAdmin, userId);
  if (!accessToken) return null;

  const [y, mo, d] = event.date.split("-").map(Number);
  const next = new Date(Date.UTC(y, mo - 1, d + 1));
  const nextDay = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  const body = { summary: event.title, start: { date: event.date }, end: { date: nextDay } };
  const url = existingEventId ? `${GCAL_EVENTS_URL}/${existingEventId}` : GCAL_EVENTS_URL;

  const res = await fetch(url, {
    method: existingEventId ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // O evento antigo pode ter sido apagado manualmente na agenda da
    // pessoa (PATCH em algo que não existe mais dá 404) — tenta criar um
    // novo em vez de deixar essa pessoa sem evento nenhum.
    if (existingEventId && res.status === 404) {
      return upsertCampaignCalendarEvent(supabaseAdmin, userId, null, event);
    }
    console.error("[gcal] falha ao criar/atualizar evento de campanha", res.status, await res.text().catch(() => ""));
    return null;
  }
  const json: any = await res.json();
  return (json?.id as string) ?? null;
}

/** Apaga o evento de campanha da agenda de alguém — usado quando a pessoa
 * sai da lista de responsáveis, ou a data de captação é removida. */
export async function deleteCampaignCalendarEvent(supabaseAdmin: any, userId: string, eventId: string): Promise<void> {
  const accessToken = await getValidCalendarAccessToken(supabaseAdmin, userId);
  if (!accessToken) return;
  await fetch(`${GCAL_EVENTS_URL}/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {});
}
