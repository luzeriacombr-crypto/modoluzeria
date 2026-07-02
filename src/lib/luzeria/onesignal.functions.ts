import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ONESIGNAL_API = "https://onesignal.com/api/v1/notifications";

async function sendOneSignalNotification(payload: {
  appId: string;
  restApiKey: string;
  userIds: string[];
  title: string;
  body: string;
  url?: string;
}) {
  const res = await fetch(ONESIGNAL_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${payload.restApiKey}`,
    },
    body: JSON.stringify({
      app_id: payload.appId,
      include_external_user_ids: payload.userIds,
      channel_for_external_user_ids: "push",
      headings: { en: payload.title, pt: payload.title },
      contents: { en: payload.body, pt: payload.body },
      url: payload.url,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[OneSignal] send failed:", err);
  }
}

export const sendPushNotification = createServerFn({ method: "POST" })
  .inputValidator((d: { userIds: string[]; title: string; body: string; url?: string }) =>
    z.object({
      userIds: z.array(z.string()).min(1),
      title: z.string(),
      body: z.string(),
      url: z.string().optional(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const appId = process.env.ONESIGNAL_APP_ID;
    const restApiKey = process.env.ONESIGNAL_REST_API_KEY;
    if (!appId || !restApiKey) {
      console.warn("[OneSignal] Missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY");
      return { ok: false };
    }
    await sendOneSignalNotification({ appId, restApiKey, ...data });
    return { ok: true };
  });
