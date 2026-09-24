import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles, X } from "lucide-react";

const FIRST_SEEN_KEY = "modocriador:feature-showcase-first-seen";
const DISMISS_KEY = "modocriador:feature-showcase-dismissed";
/** Só nos primeiros dias — depois disso o link continua disponível no menu
 * de ajuda (Sparkles > "Ver todas as funcionalidades"), sem precisar mais
 * de um aviso no topo. */
const WINDOW_MS = 2 * 24 * 3600 * 1000;

/** Convite pra página /funcionalidades — mesmo padrão visual/comportamento
 * do ReferralAnnouncementBanner (clicar no texto navega, X dispensa pra
 * sempre). "Primeiros dias" é medido a partir da primeira vez que esse
 * componente rodou nesse navegador (guardado em localStorage), não a data
 * de criação da conta — mais simples e evita puxar um campo novo pro
 * useMe() só pra isso. */
export function FeatureShowcaseBanner({ isMaster }: { isMaster: boolean }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });
  const [firstSeen] = useState(() => {
    try {
      const existing = localStorage.getItem(FIRST_SEEN_KEY);
      if (existing) return Number(existing);
      const now = Date.now();
      localStorage.setItem(FIRST_SEEN_KEY, String(now));
      return now;
    } catch {
      return Date.now();
    }
  });

  const shouldShow = isMaster && !dismissed && Date.now() - firstSeen < WINDOW_MS;
  if (!shouldShow) return null;

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* noop */ }
    setDismissed(true);
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-sm text-white" style={{ background: "rgba(var(--lz-brand-rgb),0.14)", borderBottom: "1px solid rgba(var(--lz-brand-rgb),0.3)" }}>
      <Sparkles size={16} className="shrink-0 text-[var(--lz-accent-ink)]" />
      <button
        onClick={() => { dismiss(); navigate({ to: "/funcionalidades" }); }}
        className="flex-1 min-w-0 text-left hover:underline"
      >
        Clique aqui pra conferir <b className="font-semibold">todas as funcionalidades</b> do Modo Criador →
      </button>
      <button onClick={dismiss} title="Dispensar" className="shrink-0 opacity-80 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}
