import { useApi } from "@/lib/luzeria/queries";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";

const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/HmCaoZG14Gr2bFMowa18Ls?s=cl&p=i&mlu=4&ilr=4";

const WHATSAPP_ICON_PATH = "M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.35 5.07L2 22l5.07-1.33A9.94 9.94 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm5.2 14.2c-.22.62-1.28 1.18-1.77 1.24-.45.06-1.02.09-1.65-.1-.38-.12-.87-.28-1.5-.55-2.64-1.14-4.36-3.8-4.5-3.98-.13-.18-1.08-1.43-1.08-2.73s.68-1.93.93-2.2c.24-.26.53-.33.7-.33h.5c.16 0 .38-.03.58.44.22.53.75 1.83.82 1.96.07.13.11.29.02.47-.09.18-.13.29-.26.45-.13.16-.28.35-.4.47-.13.13-.27.28-.11.55.16.27.7 1.15 1.5 1.86 1.03.92 1.9 1.2 2.17 1.34.27.13.43.11.59-.07.16-.18.68-.79.86-1.06.18-.27.36-.22.6-.13.25.09 1.57.74 1.84.87.27.13.45.2.51.31.07.13.07.71-.15 1.33z";

/** Mockup aprovado: claude.ai/artifact/8ZGqFmeQwvQJjQpdDXCfu5.
 * Só master vê, e só uma vez — marca whatsapp_community_seen_at ao fechar
 * (X, "Agora não") ou ao entrar no grupo, nunca mais aparece depois disso. */
export function WhatsAppCommunityModal({ isMaster, whatsappCommunitySeenAt }: { isMaster: boolean; whatsappCommunitySeenAt?: string | null }) {
  const { updateMyProfile } = useApi();

  if (!isMaster || whatsappCommunitySeenAt) return null;

  function markSeen() {
    updateMyProfile.mutate({ data: { whatsappCommunitySeen: true } }, {
      onError: (e: any) => toastFriendlyError(e, "Não consegui salvar."),
    });
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: "rgba(4,4,5,0.82)", backdropFilter: "blur(4px)" }}>
      <style>{`
        @keyframes wa-grid-move { from { background-position: 0 0; } to { background-position: 56px 56px; } }
        @keyframes wa-pulse-glow { 0%, 100% { opacity: .5; transform: scale(1); } 50% { opacity: .9; transform: scale(1.1); } }
        @keyframes wa-float-up { 0% { transform: translateY(6px); opacity: 0; } 18% { opacity: 1; } 100% { transform: translateY(-96px); opacity: 0; } }
        @keyframes wa-shimmer { 0% { transform: translateX(-130%) skewX(-12deg); } 100% { transform: translateX(230%) skewX(-12deg); } }
        @keyframes wa-ring-pulse { 0% { box-shadow: 0 0 0 0 rgba(205,255,0,0.45); } 100% { box-shadow: 0 0 0 14px rgba(205,255,0,0); } }
        .wa-grid-pattern { position: absolute; inset: -30px; background-image: repeating-linear-gradient(45deg, rgba(205,255,0,0.12) 0px, rgba(205,255,0,0.12) 1px, transparent 1px, transparent 26px); animation: wa-grid-move 7s linear infinite; }
        .wa-glow-blob { position: absolute; border-radius: 999px; filter: blur(28px); background: #CDFF00; animation: wa-pulse-glow 4.5s ease-in-out infinite; }
        .wa-particle { position: absolute; width: 4px; height: 4px; border-radius: 999px; background: #CDFF00; animation: wa-float-up linear infinite; }
        .wa-shimmer-sweep { position: absolute; top: 0; bottom: 0; width: 55px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent); animation: wa-shimmer 3.2s ease-in-out infinite; }
        .wa-icon-ring { animation: wa-ring-pulse 2.2s ease-out infinite; }
      `}</style>

      <div className="w-full max-w-[480px] relative overflow-hidden rounded-[24px]" style={{ background: "linear-gradient(165deg, #1A1B1F 0%, #0C0D0E 100%)", border: "1px solid rgba(205,255,0,0.28)", boxShadow: "0 0 0 1px rgba(205,255,0,0.06), 0 0 70px rgba(205,255,0,0.10), 0 30px 90px rgba(0,0,0,0.6)" }}>

        <button
          onClick={markSeen}
          aria-label="Fechar"
          className="absolute top-4 right-4 z-10 w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>

        {/* Header animado */}
        <div className="relative overflow-hidden" style={{ height: 148, background: "radial-gradient(120% 130% at 22% 0%, rgba(205,255,0,0.22), transparent 62%), #101114" }}>
          <div className="wa-grid-pattern" />
          <div className="wa-glow-blob" style={{ width: 160, height: 160, top: -70, left: -30 }} />
          <div className="wa-glow-blob" style={{ width: 120, height: 120, bottom: -60, right: 10, animationDelay: "1.2s" }} />
          <div className="wa-particle" style={{ left: 30, bottom: 20, animationDuration: "3.4s" }} />
          <div className="wa-particle" style={{ left: 70, bottom: 10, animationDuration: "4.1s", animationDelay: ".6s" }} />
          <div className="wa-particle" style={{ left: 120, bottom: 26, animationDuration: "3.8s", animationDelay: "1.4s" }} />
          <div className="wa-particle" style={{ left: 400, bottom: 16, animationDuration: "4.4s", animationDelay: ".3s" }} />
          <div className="wa-particle" style={{ left: 430, bottom: 34, animationDuration: "3.6s", animationDelay: "1.8s" }} />

          {/* Ícone Modo Criador (mesmo desenho do favicon.svg) */}
          <div className="wa-icon-ring absolute" style={{ left: 32, top: 40, width: 72, height: 72, borderRadius: 20, background: "#CDFF00", boxShadow: "0 8px 26px rgba(205,255,0,0.35)" }}>
            <div className="absolute" style={{ left: "9%", top: "24%", width: "82%", height: "52%", borderRadius: 10, background: "#090E24" }} />
            <div className="absolute flex items-center justify-center" style={{ bottom: -6, right: -6, width: 28, height: 28, borderRadius: 999, background: "#101114", border: "2.5px solid #101114" }}>
              <div className="flex items-center justify-center" style={{ width: 22, height: 22, borderRadius: 999, background: "#25D366" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><path d={WHATSAPP_ICON_PATH} /></svg>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-[2]" style={{ padding: "26px 32px 32px" }}>
          <div className="text-[10px] font-extrabold uppercase mb-2" style={{ letterSpacing: "0.12em", background: "linear-gradient(90deg, #CDFF00, #8FEA00)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            ✦ Novidade
          </div>
          <div className="text-white font-extrabold mb-3" style={{ fontSize: 25, lineHeight: 1.25 }}>
            Comunidade <span style={{ color: "#CDFF00" }}>Modo Criador</span>
          </div>
          <div className="text-[14px] leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.55)" }}>
            Um grupo só pra quem usa o Modo Criador de verdade. Lá a gente tira dúvida, troca ideia sobre fluxo de trabalho e ainda rola um network bom com outras agências que estão no mesmo momento que a sua.
          </div>

          <a
            href={WHATSAPP_GROUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={markSeen}
            className="relative overflow-hidden w-full box-border flex items-center justify-center gap-2 mb-3.5 no-underline"
            style={{ padding: 16, borderRadius: 12, background: "linear-gradient(90deg, #CDFF00, #A6E000)", color: "#0A0A0A", fontSize: "14.5px", fontWeight: 800, boxShadow: "0 10px 30px rgba(205,255,0,0.25)" }}
          >
            <div className="wa-shimmer-sweep" />
            <svg width="17" height="17" viewBox="0 0 24 24" fill="#0A0A0A"><path d={WHATSAPP_ICON_PATH} /></svg>
            <span className="relative z-[1]">Entrar na Comunidade Modo Criador</span>
          </a>

          <button onClick={markSeen} className="w-full text-center py-1.5 text-[12.5px] font-semibold" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)" }}>
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
