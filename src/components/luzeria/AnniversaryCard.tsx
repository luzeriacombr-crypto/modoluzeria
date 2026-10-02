import { useState } from "react";
import { Star } from "lucide-react";
import { useMe } from "@/lib/luzeria/queries";
import { anniversaryYearsToday, renderAnniversaryMessage, yearsLabel } from "@/lib/luzeria/anniversary";

const CONFETTI = [
  { top: 22, left: "38%", w: 9, h: 9, bg: "#CDFF00", rot: 18 },
  { top: 54, left: "61%", w: 6, h: 14, bg: "#4A9EFF", rot: -24 },
  { top: 30, right: "14%", w: 10, h: 10, bg: "#F5A623", rot: 0, round: true },
  { top: 96, right: "6%", w: 7, h: 16, bg: "#CDFF00", rot: 35 },
  { bottom: 34, left: "44%", w: 8, h: 8, bg: "#FF6B9D", rot: 40 },
  { bottom: 22, right: "22%", w: 11, h: 5, bg: "#4A9EFF", rot: -12 },
  { bottom: 60, right: "5%", w: 8, h: 8, bg: "#B084F5", rot: 0, round: true },
] as const;

/** Cartão de agradecimento no dia em que a pessoa completa 1, 2, 3... anos de
 * agência (profiles.joined_at). Só aparece no próprio dia; "Obrigado!" fecha
 * e lembra (por ano) neste navegador. Texto editável pelo Adm Master em
 * Configurações → Equipe. Mockup aprovado pelo Junior (02/10). */
export function AnniversaryCard() {
  const me = useMe().data;
  const years = anniversaryYearsToday(me?.joinedAt);
  const storageKey = me ? `lz_anniv_${me.id}_${years}` : "";
  const [dismissed, setDismissed] = useState(() => {
    try { return !!localStorage.getItem(storageKey); } catch { return false; }
  });
  if (!me || !years || dismissed) return null;

  const first = me.name.trim().split(" ")[0];
  const nome = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  const agencia = me.orgName ?? (me.accountType === "house" ? "house" : "agência");
  const message = renderAnniversaryMessage(me.orgAnniversaryMessage, { nome, anos: years, agencia });
  const headline = yearsLabel(years);

  function close() {
    try { localStorage.setItem(storageKey, "1"); } catch { /* noop */ }
    setDismissed(true);
  }

  return (
    <div
      className="relative overflow-hidden rounded-3xl mb-8 px-6 py-8 md:px-11 md:py-10 flex flex-col md:flex-row md:items-center gap-8"
      style={{ border: "1px solid rgba(var(--lz-brand-rgb),0.28)", background: "linear-gradient(135deg, rgba(var(--lz-brand-rgb),0.10) 0%, rgba(var(--lz-brand-rgb),0.03) 45%, var(--card) 100%)" }}
    >
      {CONFETTI.map((c, i) => (
        <span key={i} aria-hidden className="absolute opacity-80 pointer-events-none" style={{
          top: (c as any).top, bottom: (c as any).bottom, left: (c as any).left, right: (c as any).right,
          width: c.w, height: c.h, background: c.bg, borderRadius: (c as any).round ? 999 : 2, transform: `rotate(${c.rot}deg)`,
        }} />
      ))}
      <div className="shrink-0 w-[132px] h-[132px] rounded-full flex flex-col items-center justify-center self-center md:self-auto"
        style={{ background: "radial-gradient(circle at 50% 35%, rgba(var(--lz-brand-rgb),0.22), rgba(var(--lz-brand-rgb),0.06) 70%)", boxShadow: "inset 0 0 0 2px rgba(var(--lz-brand-rgb),0.55), 0 0 50px rgba(var(--lz-brand-rgb),0.16)" }}>
        <div className="text-[60px] font-extrabold leading-none tracking-tight" style={{ color: "var(--lz-accent-ink)" }}>{years}</div>
        <div className="text-[10px] font-extrabold tracking-[0.14em] uppercase mt-1" style={{ color: "var(--lz-accent-ink)", opacity: 0.8 }}>{years === 1 ? "ano" : "anos"}</div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-3 relative">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-[0.1em] uppercase" style={{ color: "var(--lz-accent-ink)" }}>
          <Star size={13} /> Aniversário de casa
        </div>
        <h2 className="text-[26px] md:text-[30px] leading-[1.15] font-extrabold tracking-tight text-foreground">
          Parabéns, {nome}! {headline.charAt(0).toUpperCase() + headline.slice(1)} com a gente.
        </h2>
        <p className="text-[15px] leading-relaxed text-foreground/75 max-w-[52ch]">{message}</p>
        <div className="text-[13px] text-foreground/50">Com carinho, <strong className="text-foreground/85">equipe {agencia}</strong></div>
        <div className="mt-1">
          <button onClick={close} className="rounded-xl px-5 py-3 text-sm font-bold" style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>Obrigado!</button>
        </div>
      </div>
    </div>
  );
}
