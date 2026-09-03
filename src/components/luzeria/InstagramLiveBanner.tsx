import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Instagram, X } from "lucide-react";

const DISMISS_KEY = "modocriador:instagram-live-banner-dismissed";
/** Se ninguém dispensar, some sozinho depois dessa data — pra não virar
 * lixo permanente de UI pra quem nunca clicou no X. */
const SHOW_UNTIL = new Date("2026-10-15");

const IG_GRADIENT = "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)";

/** Avisa admins (setor + master) que a publicação no Instagram saiu do modo
 * restrito a testadores — App Review da Meta aprovado em 2026-09-02. Só
 * quem administra clientes decide usar a função, então só eles veem. */
export function InstagramLiveBanner({ isAdmin }: { isAdmin: boolean }) {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");
  const navigate = useNavigate();

  if (!isAdmin || dismissed || Date.now() > SHOW_UNTIL.getTime()) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-sm text-white" style={{ background: IG_GRADIENT }}>
      <Instagram size={16} className="shrink-0" />
      <button
        onClick={() => navigate({ to: "/configuracoes", search: { tab: "updates" } })}
        className="flex-1 min-w-0 text-left font-semibold hover:underline"
      >
        Novidade! Publique no Instagram direto do Modo Criador!
      </button>
      <button onClick={dismiss} title="Dispensar" className="shrink-0 opacity-80 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}
