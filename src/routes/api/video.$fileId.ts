import { createAPIFileRoute } from "@tanstack/react-start/api";
import { getAccessToken } from "@/lib/luzeria/drive.functions";

export const APIRoute = createAPIFileRoute("/api/video/$fileId")({
  GET: async ({ request, params }) => {
    const { fileId } = params;
    if (!fileId) return new Response("missing fileId", { status: 400 });

    try {
      const token = await getAccessToken();

      const upstream: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      const range = request.headers.get("range");
      if (range) upstream["Range"] = range;

      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
        { headers: upstream },
      );

      if (!res.ok && res.status !== 206) {
        return new Response("video fetch failed", { status: res.status });
      }

      const headers: Record<string, string> = {
        "Content-Type": res.headers.get("content-type") ?? "video/mp4",
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      };
      const cl = res.headers.get("content-length");
      if (cl) headers["Content-Length"] = cl;
      const cr = res.headers.get("content-range");
      if (cr) headers["Content-Range"] = cr;

      return new Response(res.body, { status: res.status, headers });
    } catch {
      return new Response("error", { status: 500 });
    }
  },
});
