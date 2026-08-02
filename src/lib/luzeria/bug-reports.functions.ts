import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";

const PLATFORM_SUPPORT_EMAIL = "junioreisfoto2@gmail.com";

export const reportBug = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { message: string; pageUrl?: string; screenshotBase64?: string; screenshotContentType?: string }) =>
    z.object({
      message: z.string().trim().min(1).max(4000),
      pageUrl: z.string().max(500).optional(),
      screenshotBase64: z.string().max(8_000_000).optional(),
      screenshotContentType: z.string().max(80).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    let screenshotPath: string | null = null;
    let screenshotUrl: string | null = null;

    if (data.screenshotBase64 && data.screenshotContentType) {
      const ext = data.screenshotContentType.split("/")[1] ?? "png";
      screenshotPath = `${context.userId}/${Date.now()}.${ext}`;
      const bin = Buffer.from(data.screenshotBase64, "base64");
      const { error: upErr } = await context.supabase.storage
        .from("bug-reports").upload(screenshotPath, bin, { contentType: data.screenshotContentType, upsert: false });
      if (upErr) throw new Error(upErr.message);
      const { data: signed } = await context.supabase.storage
        .from("bug-reports").createSignedUrl(screenshotPath, 60 * 60 * 24 * 30);
      screenshotUrl = signed?.signedUrl ?? null;
    }

    const { error: insErr } = await context.supabase.from("bug_reports").insert({
      org_id: context.orgId,
      reported_by: context.userId,
      message: data.message,
      screenshot_path: screenshotPath,
      page_url: data.pageUrl ?? null,
    });
    if (insErr) throw new Error(insErr.message);

    const [{ data: profile }, { data: org }] = await Promise.all([
      context.supabase.from("profiles").select("name").eq("id", context.userId).maybeSingle(),
      context.supabase.from("orgs").select("name").eq("id", context.orgId).maybeSingle(),
    ]);

    try {
      const { sendEmail } = await import("./resend.server");
      await sendEmail({
        to: PLATFORM_SUPPORT_EMAIL,
        subject: `Reporte de erro — ${org?.name ?? "Agência"}`,
        html: `
          <p><strong>Agência:</strong> ${org?.name ?? "—"}</p>
          <p><strong>De:</strong> ${profile?.name ?? "—"}</p>
          <p><strong>Página:</strong> ${data.pageUrl ?? "—"}</p>
          <p><strong>Mensagem:</strong></p>
          <p>${data.message.replace(/\n/g, "<br>")}</p>
          ${screenshotUrl ? `<p><a href="${screenshotUrl}">Ver print anexado</a></p>` : ""}
        `,
      });
    } catch (e) {
      // Report is already saved in the DB even if the email fails — don't block the user on it.
      console.error("[reportBug] failed to send notification email:", e);
    }

    return { ok: true };
  });
