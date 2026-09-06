import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";
import { BG_BLUE, BG_GRAY, LIME, Reveal, LIFT, POP, EASE } from "@/components/luzeria/salesPageBlocks";
import { publishedBlogPostsQO } from "@/lib/luzeria/queries";

const TITLE = "Blog do Modo Criador";
const DESCRIPTION =
  "As dores reais de agência que viraram funcionalidade — contadas por quem criou o Modo Criador pra própria agência antes de virar produto.";

export const Route = createFileRoute("/blog")({
  component: BlogIndexRoute,
  loader: async ({ context }) => {
    try {
      const posts = await (context as any).queryClient.fetchQuery(publishedBlogPostsQO());
      const featuredSlug = posts.length > 0 ? posts[Math.floor(Math.random() * posts.length)].slug : null;
      return { posts, featuredSlug };
    } catch {
      return { posts: [], featuredSlug: null };
    }
  },
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
  const loaderData = Route.useLoaderData();
  const { data: posts } = useQuery({ ...publishedBlogPostsQO(), initialData: loaderData.posts });
  const featured = useMemo(
    () => (posts ?? []).find((p) => p.slug === loaderData.featuredSlug) ?? posts?.[0] ?? null,
    [posts, loaderData.featuredSlug],
  );
  const rest = (posts ?? []).filter((p) => p.slug !== featured?.slug);

  return (
    <div className="min-h-screen text-white" style={{ background: BG_BLUE, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <header className="flex items-center justify-between px-5 sm:px-10 py-5 border-b border-white/10">
        <div className="flex items-center justify-between max-w-[900px] mx-auto w-full">
          <ModoCriadorLogo variant="brand" className="h-6 w-auto" />
          <Link to="/" className="text-sm text-white/60 hover:text-white transition">← Voltar</Link>
        </div>
      </header>

      <section className="relative overflow-hidden" style={{ background: BG_BLUE }}>
        <div className="pointer-events-none absolute -top-40 -right-24 w-[560px] h-[560px] rounded-full blur-[110px] opacity-[0.18]" style={{ background: LIME }} />
        <div className="pointer-events-none absolute -bottom-32 -left-24 w-[420px] h-[420px] rounded-full blur-[110px] opacity-[0.10]" style={{ background: LIME }} />

        <div className="relative px-5 sm:px-10 max-w-[900px] mx-auto pt-10 sm:pt-14">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide px-3 py-1.5 rounded-full mb-6"
            style={{ background: "rgba(215,255,63,0.12)", color: LIME }}>
            Blog do Modo Criador
          </span>
        </div>

        {featured && (
          <Reveal className="relative px-5 sm:px-10 max-w-[900px] mx-auto pb-16 sm:pb-20">
            <Link
              to="/blog/$slug"
              params={{ slug: featured.slug }}
              className={`group relative block rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 aspect-video flex items-end ${LIFT}`}
              style={EASE}
            >
              {featured.coverImage && (
                <img
                  src={featured.coverImage.src}
                  alt={featured.coverImage.alt}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              )}
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(180deg, rgba(10,14,35,0.05) 0%, rgba(10,14,35,0.4) 55%, rgba(10,14,35,0.95) 100%)" }}
              />
              <div className="relative p-3.5 sm:p-8 md:p-12 max-w-2xl w-full">
                <span
                  className="inline-flex items-center gap-1 sm:gap-1.5 text-[8px] sm:text-[11px] font-black uppercase tracking-wide px-2 sm:px-3 py-0.5 sm:py-1.5 rounded-full mb-1.5 sm:mb-5"
                  style={{ background: "rgba(215,255,63,0.18)", color: LIME, backdropFilter: "blur(6px)" }}
                >
                  <Sparkles size={10} className="hidden sm:inline" /> Em destaque
                </span>
                <h1
                  className="font-criador-serif normal-case text-base sm:text-3xl md:text-5xl leading-tight mb-1 sm:mb-4 text-white line-clamp-2"
                  style={{ textWrap: "balance" as any }}
                >
                  {featured.title}
                </h1>
                <p className="hidden sm:block text-white/70 text-sm md:text-lg mb-3 md:mb-7 max-w-xl leading-relaxed line-clamp-2">
                  {featured.description}
                </p>
                <span
                  className={`inline-flex items-center gap-1 sm:gap-2 px-2.5 py-1 sm:px-6 sm:py-3 rounded-full font-black uppercase text-[9px] sm:text-sm ${POP}`}
                  style={{ background: LIME, color: BG_BLUE }}
                >
                  Continuar lendo <ArrowRight size={12} className="sm:hidden" /><ArrowRight size={16} className="hidden sm:inline" />
                </span>
              </div>
            </Link>
          </Reveal>
        )}
      </section>

      <section className="px-5 sm:px-10 max-w-[900px] mx-auto py-12 sm:py-16" style={{ background: BG_BLUE }}>
        <h2 className="text-[11px] font-black uppercase tracking-wider text-white/40 mb-5">Mais textos</h2>
        <div className="space-y-4">
          {rest.map((post) => (
            <Reveal key={post.slug}>
              <Link
                to="/blog/$slug"
                params={{ slug: post.slug }}
                className={`flex flex-col sm:flex-row overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] ${LIFT}`}
                style={EASE}
              >
                {post.coverImage && (
                  <img
                    src={post.coverImage.src}
                    alt={post.coverImage.alt}
                    className="w-full h-44 sm:w-28 sm:h-28 sm:my-6 sm:ml-6 sm:rounded-lg sm:shrink-0 object-cover"
                  />
                )}
                <div className="min-w-0 p-6">
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
