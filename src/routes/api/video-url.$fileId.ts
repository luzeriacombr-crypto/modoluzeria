import { createAPIFileRoute } from "@tanstack/react-start/api";
import { getAccessToken } from "@/lib/luzeria/drive.functions";

export const APIRoute = createAPIFileRoute("/api/video-url/$fileId")({
  GET: async ({ params }) => {
    const { fileId } = params;
    if (!fileId) return new Response("missing fileId", { status: 400 });

    try {
      const token = await getAccessToken();
      // Get the direct video download URL — Drive redirects to Google CDN
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` }, redirect: "manual" },
      );

      // Drive returns 302 redirect to the actual CDN URL
      const location = res.headers.get("location");
      if (location) {
        return Response.json({ url: location });
      }

      // Some files stream directly (no redirect) — not suitable for client-side <video>
      // Fall back to webContentLink
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=webContentLink&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const meta = await metaRes.json();
      return Response.json({ url: meta?.webContentLink ?? null });
    } catch {
      return new Response("error", { status: 500 });
    }
  },
});
