import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";
import { BG_BLUE, BG_GRAY, LIME, Reveal, LIFT, POP, EASE } from "@/components/luzeria/salesPageBlocks";
import { publishedBlogPostsQO } from "@/lib/luzeria/queries";

const TITLE = "Blog do Modo Criador";
const DESCRIPTION =
  "As dores reais de agência que viraram funcionalidade — contadas por quem criou o Modo Criador pra própria agência antes de virar produto.";
const OG_IMAGE = "https://grmayzeeemilvhjeninh.supabase.co/storage/v1/object/public/marketing-assets/blog-index-og-image-1788722746896794000.png";

const CATEGORIES = [
  { id: "todos", label: "Todos" },
  { id: "tecnologia", label: "Ferramentas" },
  { id: "meta-instagram", label: "Meta/Instagram" },
  { id: "clientes", label: "Clientes" },
  { id: "dono-de-agencia", label: "Dono de Agência" },
] as const;
type CategoryFilter = (typeof CATEGORIES)[number]["id"];

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
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
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
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("todos");

  const filtered = useMemo(
    () => (activeCategory === "todos" ? (posts ?? []) : (posts ?? []).filter((p) => p.category === activeCategory)),
    [posts, activeCategory],
  );
  const featured = useMemo(() => {
    if (activeCategory !== "todos") return filtered[0] ?? null;
    return (posts ?? []).find((p) => p.slug === loaderData.featuredSlug) ?? posts?.[0] ?? null;
  }, [posts, filtered, activeCategory, loaderData.featuredSlug]);
  const rest = filtered.filter((p) => p.slug !== featured?.slug);

  return (
    <div className="min-h-screen text-white" style={{ background: BG_BLUE, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <header className="flex items-center justify-between px-5 sm:px-10 py-5 border-b border-white/10">
        <div className="flex items-center justify-between max-w-[900px] mx-auto w-full">
          <ModoCriadorLogo variant="brand" className="h-6 w-auto" />
          <Link to="/" className="text-sm text-white/60 hover:text-white transition">← Voltar</Link>
        </div>
      </header>

      <section className="relative overflow-hidden" style={{ background: BG_BLUE }}>
        <style>{`
          @keyframes blog-grid-drift {
            from { background-position: 0 0; }
            to { background-position: 64px 64px; }
          }
          .blog-tech-grid {
            background-image:
              linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
            background-size: 32px 32px;
            animation: blog-grid-drift 18s linear infinite;
          }
        `}</style>
        <div
          className="blog-tech-grid pointer-events-none absolute inset-0"
          style={{ maskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, black 40%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, black 40%, transparent 100%)" }}
        />
        <div className="pointer-events-none absolute -top-40 -right-24 w-[560px] h-[560px] rounded-full blur-[130px] opacity-[0.10]" style={{ background: "#4A6BFF" }} />
        <div className="pointer-events-none absolute -bottom-32 -left-24 w-[420px] h-[420px] rounded-full blur-[130px] opacity-[0.08]" style={{ background: "#4A6BFF" }} />

        <div className="relative px-5 sm:px-10 max-w-[900px] mx-auto pt-14 sm:pt-20 pb-2">
          <h1
            className="text-center uppercase tracking-tight text-4xl sm:text-6xl text-white mb-7"
            style={{ textWrap: "balance" as any }}
          >
            <span className="font-normal">Blog do </span>
            <span className="font-black" style={{ color: LIME }}>Modo Criador</span>
          </h1>
          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mb-6 sm:mb-8">
            {CATEGORIES.map((cat) => {
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className="text-[9px] sm:text-xs font-bold uppercase tracking-wide px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-full transition-colors"
                  style={active ? { background: LIME, color: BG_BLUE } : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {!featured && (
          <div className="relative px-5 sm:px-10 max-w-[900px] mx-auto pb-16 sm:pb-20 text-center text-white/40 text-sm">
            Ainda não tem artigo nessa categoria.
          </div>
        )}

        {featured && (
          <Reveal className="relative">
            <Link
              to="/blog/$slug"
              params={{ slug: featured.slug }}
              className="group relative block w-full overflow-hidden aspect-video"
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
                style={{ background: "linear-gradient(180deg, rgba(10,14,35,0.05) 0%, rgba(10,14,35,0.35) 55%, rgba(10,14,35,0.97) 100%)" }}
              />
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: LIME }} />
              <div className="absolute inset-0 flex items-end">
                <div className="w-full px-5 sm:px-10 pb-6 sm:pb-14 md:pb-16">
                  <div className="max-w-[900px] mx-auto">
                    <span
                      className="inline-flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-xs font-black uppercase tracking-widest px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full mb-2 sm:mb-6"
                      style={{ background: LIME, color: BG_BLUE }}
                    >
                      <Sparkles size={11} /> Em destaque
                    </span>
                    <h2
                      className="font-criador-serif normal-case text-xl sm:text-4xl md:text-6xl leading-[1.05] mb-1.5 sm:mb-5 text-white max-w-3xl line-clamp-2"
                      style={{ textWrap: "balance" as any }}
                    >
                      {featured.title}
                    </h2>
                    <p className="hidden sm:block text-white/70 text-base md:text-xl mb-4 md:mb-8 max-w-2xl leading-relaxed line-clamp-2">
                      {featured.description}
                    </p>
                    <span
                      className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-7 sm:py-3.5 rounded-full font-black uppercase text-[10px] sm:text-sm ${POP}`}
                      style={{ background: LIME, color: BG_BLUE }}
                    >
                      Continuar lendo <ArrowRight size={14} className="sm:hidden" /><ArrowRight size={17} className="hidden sm:inline" />
                    </span>
                  </div>
                </div>
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
