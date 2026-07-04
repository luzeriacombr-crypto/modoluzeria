import { createAPIFileRoute } from "@tanstack/react-start/api";
import { getAccessToken } from "@/lib/luzeria/drive.functions";

export const APIRoute = createAPIFileRoute("/api/video/$fileId")({
  GET: async ({ params }) => {
    const { fileId } = params;
    if (!fileId) return new Response("missing fileId", { status: 400 });

    try {
      const token = await getAccessToken();

      // Follow redirects — Drive may redirect to a Google CDN URL
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true&acknowledgeAbuse=true`,
        { headers: { Authorization: `Bearer ${token}` }, redirect: "follow" },
      );

      if (!res.ok) return new Response("fetch failed", { status: res.status });

      // If Drive redirected to a CDN URL, redirect the browser there directly
      // so the browser can make native range requests to Google's CDN
      const finalUrl = res.url;
      const originalUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;
      if (!finalUrl.startsWith(originalUrl)) {
        return Response.redirect(finalUrl, 302);
      }

      // No redirect — stream the response (works for small files)
      return new Response(res.body, {
        status: 200,
        headers: {
          "Content-Type": res.headers.get("content-type") ?? "video/mp4",
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch {
      return new Response("error", { status: 500 });
    }
  },
});
