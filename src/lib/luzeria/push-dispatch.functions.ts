// Uniform push-notification dispatcher. Every notification type is created
// purely in Postgres (triggers or pg_cron — see supabase/migrations) and
// only ever wrote to the `notifications` table (the in-app bell); actual
// OneSignal push was, until now, only wired up ad-hoc for 2 of ~10 types.
// This function is the single place that turns unsent `notifications` rows
// into pushes, called on a schedule via /api/cron/send-push-notifications
// (external cron, same pattern as the Instagram publish cron — see
// runScheduledInstagramPublishes in instagram.functions.ts).
import { sendOneSignalNotification } from "./onesignal.functions";

const TYPE_TITLE: Record<string, string> = {
  assigned: "Nova tarefa atribuída",
  status: "Status atualizado",
  comment: "Novo comentário",
  mention: "Você foi mencionado",
  deadline_today: "Prazo hoje",
  deadline_tomorrow: "Prazo amanhã",
  deadline_overdue: "Prazo atrasado",
  daily_digest: "Resumo do dia",
  client_feedback: "Feedback do cliente",
  bug_report_new: "Novo chamado técnico",
  bug_report_status: "Chamado técnico atualizado",
  client_stale_update: "Cliente sem atualização",
  platform_update: "Novidade no Modo Criador",
  roteiro_client_status: "Cliente respondeu um roteiro",
  call_invite: "Chamada de vídeo",
  demo_request: "Novo pedido de demonstração",
};

// Maps a notification type to the notification_preferences column that
// gates it. Types absent here always push when there's a row to send —
// deadline_today/tomorrow/overdue and daily_digest are already gated at
// creation time by deadline_alerts/daily_digest (see send_deadline_reminders/
// send_daily_digest), and client_stale_update has no dedicated toggle yet.
const PREF_COLUMN_BY_TYPE: Record<string, string | undefined> = {
  assigned: "push_assigned",
  status: "push_status",
  comment: "push_comment",
  mention: "push_mention",
  client_feedback: "push_client_feedback",
  bug_report_new: "push_bug_report",
  bug_report_status: "push_bug_report",
};

export async function runPendingPushNotifications() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Safety net: never resurrect a backlog older than a day (e.g. if the
  // cron was down) — those rows still get marked as handled below so they
  // don't linger as "pending" forever.
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: pending, error } = await supabaseAdmin
    .from("notifications")
    .select("id, user_id, type, message")
    .is("push_sent_at", null)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  if (!pending || pending.length === 0) return { processed: 0, sent: 0, skipped: 0 };

  const userIds = [...new Set(pending.map((n: any) => n.user_id))];
  const { data: prefRows } = await supabaseAdmin
    .from("notification_preferences")
    .select("user_id, push_assigned, push_status, push_comment, push_mention, push_client_feedback, push_bug_report")
    .in("user_id", userIds);
  const prefsByUser = new Map((prefRows ?? []).map((r: any) => [r.user_id, r]));

  const appId = process.env.ONESIGNAL_APP_ID;
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;
  const appUrl = process.env.VITE_APP_URL ?? "https://www.modocriador.com.br";

  let sent = 0;
  let skipped = 0;
  const handledIds: string[] = [];

  for (const n of pending as any[]) {
    handledIds.push(n.id);
    const prefCol = PREF_COLUMN_BY_TYPE[n.type];
    const prefs = prefsByUser.get(n.user_id);
    const allowed = !prefCol || !prefs || prefs[prefCol] !== false;
    if (!allowed || !appId || !restApiKey) {
      skipped++;
      continue;
    }
    const ok = await sendOneSignalNotification({
      appId, restApiKey,
      userIds: [n.user_id],
      title: TYPE_TITLE[n.type] ?? "Modo Criador",
      body: n.message,
      url: appUrl,
    });
    if (ok) sent++; else skipped++;
  }

  await supabaseAdmin.from("notifications").update({ push_sent_at: new Date().toISOString() }).in("id", handledIds);

  return { processed: pending.length, sent, skipped };
}
