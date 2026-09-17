import { Share, Plus, MoreVertical, X } from "lucide-react";
import { StepList } from "./PushNotificationSetup";

/** Passo a passo de "adicionar à tela de início" com o próprio ícone da
 * agência (uma vez configurado) — reaproveita o mesmo StepList visual do
 * tutorial de notificações (PushNotificationSetup.tsx), mas focado no
 * resultado "vira um app de verdade no celular", não em notificações. */
export function InstallAppTutorialModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-card border border-foreground/10 rounded-2xl p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--lz-accent-ink)] mb-1">Tutorial</div>
            <h3 className="text-base font-semibold text-foreground">Transformar sua agência num app</h3>
          </div>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground"><X size={16} /></button>
        </div>
        <p className="text-[12.5px] text-foreground/50 mb-4 leading-relaxed">
          Com o ícone da sua marca configurado acima, dá pra colocar o Modo Criador na tela inicial do celular — abre
          igual um app de verdade, com o ícone e o nome da sua agência.
        </p>

        <div className="space-y-4">
          <div className="rounded-xl bg-card border border-foreground/6 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-2.5">
              📱 No iPhone (Safari)
            </div>
            <StepList>
              <li>Toque no botão de compartilhar <Share size={11} className="inline align-text-top" /> na barra do Safari.</li>
              <li>Role para baixo e toque em <strong className="text-foreground/85">"Adicionar à Tela de Início"</strong>.</li>
              <li>Confira o nome e toque em <strong className="text-foreground/85">Adicionar</strong>, no canto superior direito.</li>
              <li>Pronto — o ícone da sua agência aparece na tela inicial, igual um app.</li>
            </StepList>
          </div>

          <div className="rounded-xl bg-card border border-foreground/6 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-2.5">
              🤖 No Android (Chrome)
            </div>
            <StepList>
              <li>Toque no menu <MoreVertical size={11} className="inline align-text-top" /> no canto superior direito do Chrome.</li>
              <li>Toque em <strong className="text-foreground/85">"Instalar aplicativo"</strong> ou <strong className="text-foreground/85">"Adicionar à tela inicial"</strong> <Plus size={11} className="inline align-text-top" />.</li>
              <li>Confirme — o ícone da sua agência aparece na tela inicial, igual um app.</li>
            </StepList>
          </div>
        </div>

        <p className="text-[10.5px] text-foreground/30 mt-4 leading-relaxed">
          Isso só funciona neste aparelho e navegador — repita em cada celular que a equipe da agência usar.
        </p>
      </div>
    </div>
  );
}
