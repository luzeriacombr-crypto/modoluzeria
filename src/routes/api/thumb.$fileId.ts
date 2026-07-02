import { createAPIFileRoute } from "@tanstack/react-start/api";
import { getAccessToken } from "@/lib/luzeria/drive.functions";

export const APIRoute = createAPIFileRoute("/api/thumb/$fileId")({
  GET: async ({ params }) => {
    const { fileId } = params;
    if (!fileId) return new Response("missing fileId", { status: 400 });

    try {
      const token = await getAccessToken();
      // Fetch thumbnail link from Drive metadata
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=thumbnailLink&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!metaRes.ok) return new Response("not found", { status: 404 });
      const meta = await metaRes.json();
      const link: string | undefined = meta?.thumbnailLink;
      if (!link) return new Response("no thumbnail", { status: 404 });

      // Fetch the actual image and stream it to the browser
      const url = link.replace(/=s\d+(-[a-z]+)?$/i, "=s720");
      const imgRes = await fetch(url);
      if (!imgRes.ok) return new Response("image fetch failed", { status: 502 });

      const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
      return new Response(imgRes.body, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400", // cache 24h in browser
        },
      });
    } catch (e) {
      return new Response("error", { status: 500 });
    }
  },
});
