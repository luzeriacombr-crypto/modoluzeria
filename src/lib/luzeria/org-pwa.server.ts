// App instalável com a marca da empresa: manifesto e ícone por organização.
// Públicos de propósito (o navegador busca o manifesto sem login): só saem
// nome, cor e ícone — a mesma identidade que já aparece nos links públicos.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml", gif: "image/gif" };
const mimeOf = (path: string) => MIME[path.split(".").pop()?.toLowerCase() ?? ""] ?? "image/png";
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h.toString(36); };

async function loadOrg(orgId: string) {
  if (!UUID_RE.test(orgId)) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any).from("orgs").select("name, color_primary, favicon_path, account_type").eq("id", orgId).maybeSingle();
  return data as { name: string | null; color_primary: string | null; favicon_path: string | null; account_type: string | null } | null;
}

export async function serveManifest(orgId: string): Promise<Response> {
  const org = await loadOrg(orgId);
  if (!org?.name) return Response.redirect(new URL("/manifest.json", "https://www.modocriador.com.br").toString(), 302);
  const name = org.name.trim().slice(0, 45);
  const color = /^#[0-9a-f]{6}$/i.test(org.color_primary ?? "") ? org.color_primary! : "#CDFF00";
  const icons = org.favicon_path
    ? ["192x192", "512x512"].map((sizes) => ({ src: `/api/org-icon/${orgId}?v=${hash(org.favicon_path!)}`, sizes, type: mimeOf(org.favicon_path!), purpose: "any" }))
    : [
        { src: "/icon-192.png?v=5", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icon-512.png?v=5", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icon-maskable-512.png?v=5", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ];
  const body = {
    id: `/?app=${orgId}`,
    name,
    short_name: name.length > 12 ? name.slice(0, 12).trim() : name,
    description: `${name} no Modo Criador`,
    start_url: org.account_type === "house" ? "/meu-dia" : "/minhas-tarefas",
    scope: "/",
    display: "standalone",
    background_color: "#0D0D0D",
    theme_color: color,
    icons,
  };
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}

export async function serveOrgIcon(orgId: string): Promise<Response> {
  const org = await loadOrg(orgId);
  if (!org?.favicon_path) return new Response("Not found", { status: 404 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).storage.from("avatars").download(org.favicon_path);
  if (error || !data) return new Response("Not found", { status: 404 });
  return new Response(await data.arrayBuffer(), {
    headers: { "Content-Type": mimeOf(org.favicon_path), "Cache-Control": "public, max-age=86400" },
  });
}
