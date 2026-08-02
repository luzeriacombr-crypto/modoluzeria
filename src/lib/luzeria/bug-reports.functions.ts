import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { LUZERIA_ORG_ID } from "./api.functions";

const PLATFORM_SUPPORT_EMAIL = "junioreisfoto2@gmail.com";

async function signBugReportPaths(supabase: any, paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  const result = new Map<string, string>();
  if (unique.length === 0) return result;
  const { data } = await supabase.storage.from("bug-reports").createSignedUrls(unique, 60 * 60 * 24 * 30);
  (data ?? []).forEach((r: any) => {
    if (r?.path && r?.signedUrl) result.set(r.path, r.signedUrl);
  });
  return result;
}

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

export type MyBugReport = {
  id: string;
  message: string;
  pageUrl: string | null;
  screenshotUrl: string | null;
  createdAt: string;
};

export const listMyBugReports = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<MyBugReport[]> => {
    const { data, error } = await context.supabase
      .from("bug_reports")
      .select("id, message, page_url, screenshot_path, created_at")
      .eq("reported_by", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const signed = await signBugReportPaths(context.supabase, (data ?? []).map((r: any) => r.screenshot_path));
    return (data ?? []).map((r: any) => ({
      id: r.id,
      message: r.message,
      pageUrl: r.page_url,
      screenshotUrl: r.screenshot_path ? signed.get(r.screenshot_path) ?? null : null,
      createdAt: r.created_at,
    }));
  });

export type AllBugReport = MyBugReport & { orgName: string; reporterName: string };

export const listAllBugReports = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<AllBugReport[]> => {
    if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
    const { data, error } = await context.supabase.rpc("platform_list_bug_reports");
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const signed = await signBugReportPaths(context.supabase, rows.map((r: any) => r.screenshot_path));
    return rows.map((r: any) => ({
      id: r.id,
      message: r.message,
      pageUrl: r.page_url,
      screenshotUrl: r.screenshot_path ? signed.get(r.screenshot_path) ?? null : null,
      createdAt: r.created_at,
      orgName: r.org_name ?? "—",
      reporterName: r.reporter_name ?? "—",
    }));
  });
