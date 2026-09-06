import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment } from "react";
import { ArrowRight, MessageCircle } from "lucide-react";
import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";
import { BG_BLUE, BG_GRAY, BG_WHITE, LIME, Reveal, POP, EASE } from "@/components/luzeria/salesPageBlocks";
import { publishedBlogPostQO, publishedBlogPostsQO } from "@/lib/luzeria/queries";
import type { BlogBlock } from "@/lib/luzeria/blog-posts";

const SITE_URL = "https://www.modocriador.com.br";
const WHATSAPP_HREF =
  "https://wa.me/5599991135486?text=" + encodeURIComponent("Oi! Li um texto do blog do Modo Criador e quero saber mais.");

export const Route = createFileRoute("/blog_/$slug")({
  component: BlogPostRoute,
  loader: async ({ params, context }) => {
    const post = await (context as any).queryClient.fetchQuery(publishedBlogPostQO(params.slug)).catch(() => null);
    if (!post) throw notFound();
    return post;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const post = loaderData;
    const url = `${SITE_URL}/blog/${post.slug}`;
    const articleLd = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      author: { "@type": "Organization", name: "Modo Criador" },
      publisher: { "@type": "Organization", name: "Modo Criador" },
      mainEntityOfPage: url,
      ...(post.coverImage ? { image: `${SITE_URL}${post.coverImage.src}` } : {}),
    };
    return {
      meta: [
        { title: `${post.title} — Blog Modo Criador` },
        { name: "description", content: post.description },
        { property: "og:title", content: post.title },
        { property: "og:description", content: post.description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: post.title },
        { name: "twitter:description", content: post.description },
        ...(post.coverImage ? [{ property: "og:image", content: `${SITE_URL}${post.coverImage.src}` }, { name: "twitter:image", content: `${SITE_URL}${post.coverImage.src}` }] : []),
        { "script:ld+json": articleLd },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

/** "**negrito**" -> <strong>. Não é markdown de verdade, só o suficiente
 * pra dar ênfase pontual dentro de um texto sem precisar de uma lib de
 * markdown pra um site que não tem mais nenhum outro uso pra ela. */
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-white font-bold">{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function Block({ block }: { block: BlogBlock }) {
  if (block.type === "lead") {
    return <p className="text-xl sm:text-2xl text-white/85 leading-relaxed mb-7 font-medium">{renderInline(block.text)}</p>;
  }
  if (block.type === "h2") {
    return <h2 className="font-criador-serif normal-case text-2xl sm:text-3xl mt-10 mb-4 text-white">{block.text}</h2>;
  }
  if (block.type === "h3") {
    return <h3 className="text-lg sm:text-xl font-bold mt-8 mb-3 text-white">{block.text}</h3>;
  }
  if (block.type === "quote") {
    return (
      <blockquote className="my-8 pl-5 border-l-2 text-lg sm:text-xl text-white/80 leading-relaxed italic" style={{ borderColor: LIME }}>
        "{renderInline(block.text)}"
      </blockquote>
    );
  }
  if (block.type === "callout") {
    return (
      <div className="my-8 rounded-xl border p-5 sm:p-6" style={{ borderColor: "rgba(215,255,63,0.3)", background: "rgba(215,255,63,0.06)" }}>
        {block.title && (
          <div className="text-[11px] font-black uppercase tracking-wider mb-2" style={{ color: LIME }}>{block.title}</div>
        )}
        <p className="text-white/80 leading-relaxed text-[15px] sm:text-base">{renderInline(block.text)}</p>
      </div>
    );
  }
  if (block.type === "list") {
    return (
      <ul className="my-5 space-y-2.5">
        {block.items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-white/70 leading-relaxed">
            <span className="mt-2 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: LIME }} />
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === "rankedList") {
    return (
      <div className="my-6 space-y-3">
        {block.items.map((item, i) => (
          <div key={item.title} className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-black text-sm" style={{ background: LIME, color: "#0A0E23" }}>
              {i + 1}
            </div>
            <div>
              <div className="font-bold text-white mb-1">{item.title}</div>
              <p className="text-sm text-white/60 leading-relaxed">{renderInline(item.text)}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return <p className="text-white/70 leading-relaxed mb-5">{renderInline(block.text)}</p>;
}

function BlogPostRoute() {
  const params = Route.useParams();
  const { data: post } = useQuery({ ...publishedBlogPostQO(params.slug), initialData: Route.useLoaderData() });
  const { data: allPosts } = useQuery(publishedBlogPostsQO());
  if (!post) return null;
  const others = (allPosts ?? []).filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <div className="min-h-screen text-white" style={{ background: BG_BLUE, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <header className="flex items-center justify-between px-5 sm:px-10 py-5 border-b border-white/10">
        <div className="flex items-center justify-between max-w-[680px] mx-auto w-full">
          <ModoCriadorLogo variant="brand" className="h-6 w-auto" />
          <Link to="/blog" className="text-sm text-white/60 hover:text-white transition">← Blog</Link>
        </div>
      </header>

      {post.coverImage && (
        <div className="w-full max-h-[420px] overflow-hidden">
          <img src={post.coverImage.src} alt={post.coverImage.alt} className="w-full h-full object-cover" style={{ maxHeight: 420 }} />
        </div>
      )}

      <article className="px-5 sm:px-10 max-w-[680px] mx-auto py-14 sm:py-20">
        <Reveal>
          <div className="text-[11px] uppercase tracking-wide text-white/40 mb-4">
            {formatDate(post.date)} · {post.readingMinutes} min de leitura
          </div>
          <h1 className="font-criador-serif normal-case text-3xl sm:text-4xl leading-tight mb-8">{post.title}</h1>
          <div className="text-[17px]">
            {post.body.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>
        </Reveal>

        {post.relatedFeatureHref && post.relatedFeatureLabel && (
          <Reveal className="mt-10 rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-sm text-white/50 mb-3">Essa funcionalidade existe hoje no Modo Criador:</p>
            <Link
              to={post.relatedFeatureHref}
              className="inline-flex items-center gap-1.5 text-base font-bold"
              style={{ color: LIME }}
            >
              {post.relatedFeatureLabel} <ArrowRight size={16} />
            </Link>
          </Reveal>
        )}
      </article>

      {others.length > 0 && (
        <section style={{ background: BG_GRAY }} className="border-t border-white/10">
          <div className="px-5 sm:px-10 max-w-[680px] mx-auto py-12">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-white/40 mb-4">Leia também</h3>
            <div className="space-y-3">
              {others.map((p) => (
                <Link
                  key={p.slug}
                  to="/blog/$slug"
                  params={{ slug: p.slug }}
                  className="block rounded-lg border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition"
                >
                  <span className="font-semibold text-sm text-white">{p.title}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section style={{ background: BG_WHITE, color: "#0A0E23" }} className="border-t border-black/10">
        <Reveal className="px-5 sm:px-10 max-w-[560px] mx-auto py-16 text-center">
          <h2 className="font-criador-serif normal-case text-2xl sm:text-3xl mb-3">Quer ver isso funcionando na sua agência?</h2>
          <p className="text-[#0A0E23]/60 text-sm mb-8">Sem compromisso — 30 dias de teste grátis.</p>
          <a
            href={WHATSAPP_HREF} target="_blank" rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-black uppercase text-sm ${POP}`}
            style={{ background: "#25D366", color: "#0A0E23", ...EASE }}
          >
            <MessageCircle size={17} /> Falar no WhatsApp
          </a>
        </Reveal>
      </section>

      <footer style={{ background: BG_BLUE }} className="px-5 sm:px-10 py-10 text-center text-white/30 text-xs">
        Modo <span className="font-criador-serif">Criador</span> — desenvolvido pela Luzeria Estúdio.
      </footer>
    </div>
  );
}
