import { createFileRoute } from "@tanstack/react-router";
import { getPublishedBlogPosts } from "@/lib/luzeria/blog-admin.functions";

const SITE_URL = "https://www.modocriador.com.br";

const STATIC_PAGES: { path: string; changefreq: string; priority: string }[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/assinar", changefreq: "weekly", priority: "0.8" },
  { path: "/afiliar", changefreq: "monthly", priority: "0.5" },
  { path: "/revenda", changefreq: "monthly", priority: "0.5" },
  { path: "/selecao-de-fotos-para-fotografos", changefreq: "monthly", priority: "0.7" },
  { path: "/aprovacao-de-conteudo-por-link", changefreq: "monthly", priority: "0.7" },
  { path: "/backup-automatico-drive", changefreq: "monthly", priority: "0.7" },
  { path: "/publicacao-automatica-instagram", changefreq: "monthly", priority: "0.7" },
  { path: "/biblioteca-de-referencias", changefreq: "monthly", priority: "0.7" },
  { path: "/blog", changefreq: "weekly", priority: "0.6" },
  { path: "/privacidade", changefreq: "yearly", priority: "0.2" },
  { path: "/termos", changefreq: "yearly", priority: "0.2" },
];

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Sitemap gerado a partir do banco toda vez que o Google (ou qualquer um)
 * pede — antes era um public/sitemap.xml estático, escrito à mão, que nunca
 * incluía artigo novo do blog depois que ele virou tabela no banco. */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const posts = await getPublishedBlogPosts();
        const urls = [
          ...STATIC_PAGES.map(
            (p) =>
              `  <url>\n    <loc>${SITE_URL}${p.path}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`,
          ),
          ...posts.map(
            (post) =>
              `  <url>\n    <loc>${SITE_URL}/blog/${escapeXml(post.slug)}</loc>\n    <lastmod>${post.date}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
          ),
        ].join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
        return new Response(xml, {
          headers: {
            "content-type": "application/xml",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
