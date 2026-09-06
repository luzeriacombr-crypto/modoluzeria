import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";
import { BG_BLUE, BG_GRAY, LIME, Reveal, LIFT, EASE } from "@/components/luzeria/salesPageBlocks";
import { BLOG_POSTS } from "@/lib/luzeria/blog-posts";

const TITLE = "Blog do Modo Criador";
const DESCRIPTION =
  "As dores reais de agência que viraram funcionalidade — contadas por quem criou o Modo Criador pra própria agência antes de virar produto.";

export const Route = createFileRoute("/blog")({
  component: BlogIndexRoute,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: "https://www.modocriador.com.br/blog" }],
  }),
});

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function BlogIndexRoute() {
  return (
    <div className="min-h-screen text-white" style={{ background: BG_BLUE, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <header className="flex items-center justify-between px-5 sm:px-10 py-5 border-b border-white/10">
        <div className="flex items-center justify-between max-w-[900px] mx-auto w-full">
          <ModoCriadorLogo variant="brand" className="h-6 w-auto" />
          <Link to="/" className="text-sm text-white/60 hover:text-white transition">← Voltar</Link>
        </div>
      </header>

      <section style={{ background: BG_GRAY }} className="border-b border-white/10">
        <Reveal className="px-5 sm:px-10 max-w-[900px] mx-auto py-16 sm:py-20 grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide px-3 py-1.5 rounded-full mb-5"
              style={{ background: "rgba(215,255,63,0.12)", color: LIME }}>
              Blog
            </span>
            <h1 className="font-criador-serif normal-case text-4xl sm:text-5xl leading-tight mb-4">
              As dores de agência que viraram funcionalidade
            </h1>
            <p className="text-lg text-white/60 max-w-xl">
              Cada texto aqui parte de um problema real que a Luzeria Estúdio teve gerenciando conteúdo de cliente —
              antes do Modo Criador virar um produto que qualquer agência pode assinar.
            </p>
          </div>
          <div className="hidden lg:block rounded-2xl overflow-hidden border border-white/10">
            <img
              src="/blog/equipe-luzeria.jpg"
              alt="Equipe da Luzeria Estúdio trabalhando junto, olhando pra tela de um computador"
              className="w-full h-full object-cover"
            />
          </div>
        </Reveal>
      </section>

      <section className="px-5 sm:px-10 max-w-[900px] mx-auto py-12 sm:py-16">
        <div className="space-y-4">
          {BLOG_POSTS.map((post) => (
            <Reveal key={post.slug}>
              <Link
                to="/blog/$slug"
                params={{ slug: post.slug }}
                className={`flex gap-5 rounded-xl p-6 border border-white/10 bg-white/[0.03] ${LIFT}`}
                style={EASE}
              >
                {post.coverImage && (
                  <img
                    src={post.coverImage.src}
                    alt=""
                    className="hidden sm:block w-28 h-28 rounded-lg object-cover shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wide text-white/40 mb-2">
                    {formatDate(post.date)} · {post.readingMinutes} min de leitura
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">{post.title}</h2>
                  <p className="text-sm text-white/55 leading-relaxed mb-3">{post.description}</p>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: LIME }}>
                    Ler o texto <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <footer style={{ background: BG_GRAY }} className="px-5 sm:px-10 py-10 text-center text-white/30 text-xs border-t border-white/10">
        Modo <span className="font-criador-serif">Criador</span> — desenvolvido pela Luzeria Estúdio.
      </footer>
    </div>
  );
}
