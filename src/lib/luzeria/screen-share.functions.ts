import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";

/** Fallback notification for a video call invite — the real, instant
 * invite goes over a Realtime broadcast (see use-screen-share-call.ts); this
 * just makes sure the callee has a record/awareness even if they weren't
 * looking at the app when it was sent. Not the answer path — by the time a
 * push arrives (dispatch cron runs on a minutes-scale schedule) the caller's
 * own 45s ring timeout will very likely already have fired. */
export const sendCallInviteNotification = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { toUserId: string; callId: string }) =>
    z.object({
      toUserId: z.string().uuid(),
      callId: z.string().uuid(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: target } = await context.supabase
      .from("profiles").select("id").eq("id", data.toUserId).eq("org_id", context.orgId).maybeSingle();
    if (!target) throw new Error("Usuário não encontrado nesta agência.");
    const { data: caller } = await context.supabase
      .from("profiles").select("name").eq("id", context.userId).maybeSingle();
    const callerName = caller?.name ?? "Alguém";

    // notifications' RLS only allows inserting for auth.uid() = user_id —
    // every cross-user notification in the app goes through a SECURITY
    // DEFINER trigger or the admin client instead (see bug-reports.functions.ts).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("notifications").insert({
      user_id: data.toUserId,
      type: "call_invite",
      message: `${callerName} está te chamando para uma vídeo chamada`,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
