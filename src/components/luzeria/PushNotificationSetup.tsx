import { useEffect, useState } from "react";
import { BellRing, BellOff, Bell, X, Share, Plus, MoreVertical, Check, AlertTriangle } from "lucide-react";
import {
  requestNotificationPermission, getNotificationPermission, getMobileOS, isStandalonePWA, showWelcomeNotification,
} from "@/lib/luzeria/push-notifications";

function StepList({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-2 text-[12.5px] text-foreground/70 leading-relaxed list-decimal list-inside">{children}</ol>;
}

export function PushNotificationButton() {
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    setPerm(getNotificationPermission());
  }, [open]);

  const granted = perm === "granted";
  const denied = perm === "denied";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={granted ? "Notificações no celular ativadas" : "Ativar notificações no celular"}
        className={`inline-flex items-center gap-1 text-[11px] font-semibold transition ${
          granted ? "text-[var(--lz-accent-ink)]" : denied ? "text-red-300 hover:text-red-200" : "text-foreground/50 hover:text-foreground"
        }`}
      >
        {granted ? <BellRing size={12} /> : denied ? <BellOff size={12} /> : <Bell size={12} />}
        {granted ? "Ativadas" : denied ? "Bloqueadas" : "Ativar no celular"}
      </button>
      {open && <PushNotificationModal onClose={() => setOpen(false)} />}
    </>
  );
}

function PushNotificationModal({ onClose }: { onClose: () => void }) {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(getNotificationPermission());
  const [requesting, setRequesting] = useState(false);
  const os = getMobileOS();
  const standalone = isStandalonePWA();

  async function handleActivate() {
    setRequesting(true);
    try {
      if (os === "ios" && !standalone) {
        // Safari in a regular tab has no push support at all — the
        // permission prompt would just silently no-op.
        setPerm("unsupported");
        return;
      }
      const ok = await requestNotificationPermission();
      setPerm(ok ? "granted" : getNotificationPermission());
      if (ok) showWelcomeNotification();
    } finally {
      setRequesting(false);
    }
  }

  const showIosBlockedNotice = os === "ios" && !standalone;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-card border border-foreground/10 rounded-2xl p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--lz-accent-ink)] mb-1">Notificações</div>
            <h3 className="text-base font-semibold text-foreground">Ativar no celular</h3>
          </div>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground"><X size={16} /></button>
        </div>
        <p className="text-[12.5px] text-foreground/50 mb-4 leading-relaxed">
          Receba um aviso no seu celular sempre que alguém te marcar, comentar ou mudar o status de uma tarefa sua.
        </p>

        {perm === "granted" ? (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 mb-4 text-[12.5px] font-medium"
            style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.1)", color: "var(--lz-accent-ink)" }}>
            <Check size={15} className="shrink-0" /> Notificações ativadas neste aparelho.
          </div>
        ) : perm === "denied" ? (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 mb-4 text-[12.5px] text-red-200 bg-red-500/10 border border-red-500/20">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <span>
              Notificações estão bloqueadas pra este site. Pra ativar, entre nas configurações de notificações do seu celular
              (ou do navegador) e permita notificações do Modo Criador manualmente.
            </span>
          </div>
        ) : showIosBlockedNotice ? (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 mb-4 text-[12.5px] text-amber-200 bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <span>No iPhone, o Safari só permite notificações depois de adicionar o Modo Criador à Tela de Início. Siga o passo a passo abaixo primeiro.</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleActivate}
            disabled={requesting}
            className="w-full mb-4 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold bg-[rgb(var(--lz-brand-rgb))] text-[#0D0D0D] hover:brightness-110 disabled:opacity-60 transition"
          >
            <BellRing size={15} /> Ativar agora
          </button>
        )}

        <div className="space-y-4">
          <div className="rounded-xl bg-card border border-foreground/6 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-2.5">
              📱 No iPhone (Safari)
            </div>
            <StepList>
              <li>Toque no botão de compartilhar <Share size={11} className="inline align-text-top" /> na barra do Safari.</li>
              <li>Role para baixo e toque em <strong className="text-foreground/85">"Adicionar à Tela de Início"</strong>.</li>
              <li>Toque em <strong className="text-foreground/85">Adicionar</strong>, no canto superior direito.</li>
              <li>Feche o Safari e abra o Modo Criador pelo novo ícone que apareceu na tela inicial.</li>
              <li>Dentro do app, volte aqui em Notificações e toque em "Ativar agora".</li>
            </StepList>
          </div>

          <div className="rounded-xl bg-card border border-foreground/6 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-2.5">
              🤖 No Android (Chrome)
            </div>
            <StepList>
              <li>Toque no menu <MoreVertical size={11} className="inline align-text-top" /> no canto superior direito do Chrome.</li>
              <li>Toque em <strong className="text-foreground/85">"Instalar aplicativo"</strong> ou <strong className="text-foreground/85">"Adicionar à tela inicial"</strong> <Plus size={11} className="inline align-text-top" />.</li>
              <li>Abra o Modo Criador pelo ícone que aparece na tela inicial.</li>
              <li>Toque em "Ativar agora" acima e confirme a permissão que o Android vai pedir.</li>
            </StepList>
          </div>
        </div>

        <p className="text-[10.5px] text-foreground/30 mt-4 leading-relaxed">
          Isso ativa as notificações só neste aparelho e navegador. Se você usa mais de um celular, repita os passos em cada um.
        </p>
      </div>
    </div>
  );
}
