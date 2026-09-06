import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronDown, Check, X, MessageCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";
import { LIME, BG_BLUE, BG_BLUE_2, BG_WHITE, BG_GRAY, EASE, POP, LIFT, Reveal, BUILTIN_ILLUSTRATIONS } from "@/components/luzeria/salesPageBlocks";

/** Mesmo esqueleto visual de ResellerLandingPage (revenda) — hero, benefícios,
 * como funciona, pra quem faz sentido (opcional), o que está incluso
 * (opcional), FAQ, CTA final — parametrizado por conteúdo, pra servir de
 * base pras páginas de SEO por funcionalidade (seleção de fotos, aprovação
 * por link, backup no Drive, etc.) sem duplicar a mesma estrutura 5 vezes. */

function useScrolled(threshold = 30) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

export type FeatureLandingContent = {
  badgeIcon: LucideIcon;
  badgeLabel: string;
  heroLines: (string | { text: string; highlight: true })[];
  heroSubtitle: string;
  ctaLabel: string;
  whatsappMessage: string;
  illustrationKey: keyof typeof BUILTIN_ILLUSTRATIONS;
  heroBadges?: { icon: LucideIcon; label: string }[];
  benefitsTitle?: string;
  benefits: { icon: LucideIcon; title: string; text: string }[];
  stepsTitle?: string;
  steps: { title: string; text: string }[];
  fit?: { yesTitle?: string; yes: string[]; noTitle?: string; no: string[] };
  included?: { title?: string; items: string[] };
  faqGroups: { category: string; items: [string, string][] }[];
  finalTitle: string;
  finalSubtitle: string;
  finalCtaLabel: string;
};

export function FeatureLandingPage({ content }: { content: FeatureLandingContent }) {
  const scrolled = useScrolled();
  const [openFaq, setOpenFaq] = useState<string | null>("0-0");
  const c = content;
  const Illustration = BUILTIN_ILLUSTRATIONS[c.illustrationKey];
  const whatsappHref = `https://wa.me/5599991135486?text=${encodeURIComponent(c.whatsappMessage)}`;

  return (
    <div className="min-h-screen text-white" style={{ background: BG_BLUE, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-5 sm:px-10 py-5"
        style={{
          transition: "background-color 300ms var(--ease-premium), backdrop-filter 300ms var(--ease-premium), border-color 300ms var(--ease-premium)",
          backgroundColor: scrolled ? "rgba(10,14,35,0.8)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
        }}
      >
        <div className="flex items-center justify-between max-w-[1100px] mx-auto w-full">
          <ModoCriadorLogo variant="brand" className="h-6 w-auto" />
          <Link to="/" className="text-sm text-white/60 hover:text-white transition">← Voltar</Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full opacity-25 blur-[110px]" style={{ background: LIME }} />
        <div className="pointer-events-none absolute top-40 -right-32 h-[420px] w-[420px] rounded-full opacity-20 blur-[110px]" style={{ background: "#7EB3FF" }} />
        <div className="relative px-5 sm:px-10 max-w-[1100px] mx-auto py-20 sm:py-28 grid lg:grid-cols-[1.1fr_0.9fr] gap-14 items-center">
          <Reveal>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide px-3 py-1.5 rounded-full mb-5"
              style={{ background: "rgba(215,255,63,0.12)", color: LIME }}>
              <c.badgeIcon size={12} /> {c.badgeLabel}
            </span>
            <h1 className="font-black uppercase text-4xl sm:text-6xl leading-[1.02] tracking-tight mb-6">
              {c.heroLines.map((line, i) => {
                const isLast = i === c.heroLines.length - 1;
                const text = typeof line === "string" ? line : line.text;
                const isHighlight = typeof line !== "string" && line.highlight;
                return (
                  <span key={i}>
                    {isHighlight ? <span style={{ color: LIME }}>{text}</span> : text}
                    {!isLast && <br />}
                  </span>
                );
              })}
            </h1>
            <p className="text-lg sm:text-xl text-white/60 max-w-lg mb-9">{c.heroSubtitle}</p>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href={whatsappHref} target="_blank" rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 px-7 py-4 rounded-full font-black uppercase text-sm ${POP}`}
                style={{ background: LIME, color: "#0A0E23", ...EASE }}
              >
                {c.ctaLabel} <ArrowRight size={18} />
              </a>
              <span className="text-white/40 text-sm">Resposta rápida no WhatsApp</span>
            </div>
          </Reveal>
          <Reveal className="hidden lg:block" style={{ transitionDelay: "150ms" }}>
            <div className="relative">
              <div className="absolute -inset-6 rounded-[28px] opacity-40 blur-2xl" style={{ background: `linear-gradient(135deg, ${LIME}, #7EB3FF)` }} />
              <div className="relative"><Illustration /></div>
            </div>
          </Reveal>
        </div>
        {c.heroBadges && c.heroBadges.length > 0 && (
          <Reveal className="relative px-5 sm:px-10 max-w-[1100px] mx-auto pb-16 sm:pb-20" style={{ transitionDelay: "80ms" }}>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {c.heroBadges.map((it) => (
                <span key={it.label} className="inline-flex items-center gap-2 text-sm font-semibold text-white/70">
                  <it.icon size={15} style={{ color: LIME }} /> {it.label}
                </span>
              ))}
            </div>
          </Reveal>
        )}
      </section>

      {/* BENEFITS */}
      <section style={{ background: BG_BLUE_2 }} className="border-t border-white/10">
        <Reveal className="px-5 sm:px-10 max-w-[1100px] mx-auto py-16">
          <h2 className="font-black uppercase text-2xl sm:text-3xl mb-10 text-center">{c.benefitsTitle ?? "O que você ganha"}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {c.benefits.map((b) => (
              <div key={b.title} className={`rounded-xl p-6 border border-white/10 bg-white/5 ${LIFT}`} style={EASE}>
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-lg mb-4" style={{ background: "rgba(215,255,63,0.12)" }}>
                  <b.icon size={20} style={{ color: LIME }} />
                </div>
                <h3 className="font-bold text-white mb-1.5">{b.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{b.text}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ background: BG_BLUE }} className="border-t border-white/10">
        <Reveal className="px-5 sm:px-10 max-w-[820px] mx-auto py-16">
          <h2 className="font-black uppercase text-2xl sm:text-3xl mb-10 text-center">{c.stepsTitle ?? "Como funciona"}</h2>
          <div className="space-y-4">
            {c.steps.map((s, i) => (
              <div key={s.title} className={`flex gap-5 rounded-xl p-5 border border-white/10 bg-white/[0.03] ${LIFT}`} style={EASE}>
                <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-black text-base"
                  style={{ background: LIME, color: "#0A0E23" }}>
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">{s.title}</h3>
                  <p className="text-sm text-white/55 leading-relaxed">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* PRA QUEM FAZ SENTIDO (opcional) */}
      {c.fit && (
        <section style={{ background: BG_BLUE_2 }} className="border-t border-white/10">
          <Reveal className="px-5 sm:px-10 max-w-[1000px] mx-auto py-16">
            <h2 className="font-black uppercase text-2xl sm:text-3xl mb-2 text-center">Pra quem faz sentido</h2>
            <div className="grid sm:grid-cols-2 gap-5 mt-10">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
                <h3 className="font-bold text-white mb-4 inline-flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(215,255,63,0.18)" }}>
                    <Check size={13} style={{ color: LIME }} />
                  </span>
                  {c.fit.yesTitle ?? "É pra você se"}
                </h3>
                <ul className="space-y-3">
                  {c.fit.yes.map((t) => (
                    <li key={t} className="flex items-start gap-2 text-sm text-white/65 leading-relaxed">
                      <Check size={14} className="shrink-0 mt-0.5" style={{ color: LIME }} /> {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
                <h3 className="font-bold text-white mb-4 inline-flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 bg-white/10">
                    <X size={13} className="text-white/50" />
                  </span>
                  {c.fit.noTitle ?? "Não é pra você se"}
                </h3>
                <ul className="space-y-3">
                  {c.fit.no.map((t) => (
                    <li key={t} className="flex items-start gap-2 text-sm text-white/50 leading-relaxed">
                      <X size={14} className="shrink-0 mt-0.5 text-white/30" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </section>
      )}

      {/* O QUE ESTÁ INCLUSO (opcional) */}
      {c.included && (
        <section style={{ background: BG_BLUE }} className="border-t border-white/10">
          <Reveal className="px-5 sm:px-10 max-w-[720px] mx-auto py-16">
            <h2 className="font-black uppercase text-2xl sm:text-3xl mb-10 text-center">{c.included.title ?? "O que está incluso"}</h2>
            <div className="space-y-3">
              {c.included.items.map((t) => (
                <div key={t} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3.5">
                  <Check size={16} className="shrink-0 mt-0.5" style={{ color: LIME }} />
                  <span className="text-sm text-white/70 leading-relaxed">{t}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </section>
      )}

      {/* FAQ */}
      <section style={{ background: BG_GRAY }} className="border-t border-white/10">
        <div className="px-5 sm:px-10 max-w-[720px] mx-auto py-16">
          <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-8">Dúvidas frequentes</h2>
          {c.faqGroups.map((group, gi) => (
            <div key={group.category} className="mb-8 last:mb-0">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-white/40 mb-3">{group.category}</h3>
              <div className="space-y-3">
                {group.items.map(([q, a], i) => {
                  const key = `${gi}-${i}`;
                  return (
                    <div key={q} className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
                      <button
                        onClick={() => setOpenFaq((v) => (v === key ? null : key))}
                        className="w-full flex items-center justify-between gap-3 text-left px-4 py-4"
                      >
                        <span className="font-semibold text-sm">{q}</span>
                        <ChevronDown size={16} className="shrink-0 text-white/50 transition-transform" style={{ transform: openFaq === key ? "rotate(180deg)" : "rotate(0deg)" }} />
                      </button>
                      {openFaq === key && <p className="text-white/50 text-sm leading-relaxed px-4 pb-4">{a}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ background: BG_WHITE, color: "#0A0E23" }} className="border-t border-black/10">
        <Reveal className="px-5 sm:px-10 max-w-[640px] mx-auto py-20 text-center">
          <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-3">{c.finalTitle}</h2>
          <p className="text-[#0A0E23]/60 text-base mb-9">{c.finalSubtitle}</p>
          <a
            href={whatsappHref} target="_blank" rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 px-8 py-4 rounded-full font-black uppercase text-sm ${POP}`}
            style={{ background: "#25D366", color: "#0A0E23", ...EASE }}
          >
            <MessageCircle size={18} /> {c.finalCtaLabel}
          </a>
        </Reveal>
      </section>

      <footer style={{ background: BG_BLUE }} className="px-5 sm:px-10 py-10 text-center text-white/30 text-xs">
        Modo <span className="font-criador-serif">Criador</span> — desenvolvido pela Luzeria Estúdio.
      </footer>

      <a
        href={whatsappHref} target="_blank" rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 pl-3 pr-4 py-3 rounded-full shadow-2xl transition hover:opacity-90"
        style={{ background: "#25D366", color: "#0A0E23" }}
      >
        <svg viewBox="0 0 32 32" width="22" height="22" fill="currentColor" aria-hidden="true">
          <path d="M16.004 2.667C8.64 2.667 2.667 8.64 2.667 16.004c0 2.45.66 4.847 1.914 6.947L2.667 29.333l6.55-1.883a13.29 13.29 0 0 0 6.787 1.85h.006c7.363 0 13.336-5.973 13.336-13.337 0-3.563-1.388-6.913-3.907-9.43a13.253 13.253 0 0 0-9.435-3.866Zm0 24.4h-.005a11.06 11.06 0 0 1-5.638-1.543l-.404-.24-4.19 1.204 1.12-4.087-.264-.42a11.05 11.05 0 0 1-1.696-5.977c0-6.116 4.978-11.093 11.096-11.093a11.04 11.04 0 0 1 7.851 3.25 11.03 11.03 0 0 1 3.245 7.85c0 6.117-4.978 11.056-11.115 11.056Zm6.086-8.284c-.334-.167-1.97-.972-2.275-1.083-.305-.111-.527-.167-.75.167-.222.334-.86 1.083-1.054 1.306-.194.223-.389.25-.723.083-.334-.167-1.409-.52-2.684-1.657-.992-.885-1.663-1.978-1.858-2.312-.194-.334-.02-.514.147-.68.15-.15.334-.39.5-.585.167-.195.223-.334.334-.556.111-.223.056-.417-.028-.584-.083-.167-.75-1.806-1.027-2.474-.27-.65-.545-.562-.75-.573l-.638-.012c-.222 0-.583.083-.888.417-.305.334-1.166 1.14-1.166 2.778 0 1.639 1.194 3.222 1.361 3.444.167.223 2.352 3.59 5.696 5.035.796.344 1.417.55 1.901.703.799.254 1.526.218 2.101.132.641-.096 1.97-.805 2.248-1.583.278-.778.278-1.445.194-1.584-.083-.139-.305-.222-.639-.389Z"/>
        </svg>
        <span className="text-sm font-bold">Falar no WhatsApp</span>
      </a>
    </div>
  );
}
