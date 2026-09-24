import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Video, Mail, MessageCircle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { demoRequestsQO, appSettingsQO, useApi } from "@/lib/luzeria/queries";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";

const DEFAULT_DEMO_MESSAGE = `Oi {nome}! Aqui é o Junior, do Modo Criador.

Vi que você pediu uma demonstração, muito obrigado pelo interesse!

Queria entender rapidinho como é a rotina da sua agência hoje (quantos clientes, como organizam o conteúdo) pra te mostrar o Modo Criador já aplicado na sua realidade, não uma demo genérica.

Topa marcarmos uns 15-20 minutos essa semana? Me fala os melhores horários que eu encaixo.`;

function relativeLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}

function DemoMessageEditor({ template, onClose }: { template: string; onClose: () => void }) {
  const [text, setText] = useState(template);
  const { updateAppSettings } = useApi();

  function save() {
    updateAppSettings.mutate({ data: { demoWhatsappMessage: text.trim() || null } }, {
      onSuccess: () => { toast.success("Mensagem salva."); onClose(); },
      onError: (e: any) => toastFriendlyError(e, "Erro ao salvar"),
    });
  }

  function reset() {
    setText(DEFAULT_DEMO_MESSAGE);
  }

  return (
    <div className="bg-foreground/[0.03] border border-foreground/10 rounded-2xl p-4 space-y-3">
      <p className="text-foreground/50 text-xs leading-relaxed">
        Use <code className="text-foreground/70">{"{nome}"}</code> onde quiser que entre o nome de quem pediu a demonstração.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        maxLength={2000}
        className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] resize-y"
      />
      <div className="flex items-center gap-2">
        <button onClick={save} disabled={updateAppSettings.isPending || !text.trim()}
          className="lz-btn-primary text-xs px-4 py-2 rounded-md disabled:opacity-50">
          {updateAppSettings.isPending ? "Salvando…" : "Salvar"}
        </button>
        <button onClick={reset} className="text-[11px] text-foreground/50 hover:text-foreground transition">
          Restaurar padrão
        </button>
        <button onClick={onClose} className="text-[11px] text-foreground/50 hover:text-foreground transition ml-auto">
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function DemoRequestsPanel() {
  const { data: requests = [], isLoading } = useQuery(demoRequestsQO());
  const { data: settings } = useQuery(appSettingsQO());
  const [editingMessage, setEditingMessage] = useState(false);
  const template = settings?.demoWhatsappMessage || DEFAULT_DEMO_MESSAGE;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin text-foreground/40" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Video size={16} className="text-[var(--lz-accent-ink)]" />
        <h2 className="text-foreground font-semibold">Pedidos de Demonstração</h2>
        <span className="text-foreground/40 text-sm">— {requests.length}</span>
        <button onClick={() => setEditingMessage((v) => !v)}
          className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground/50 hover:text-foreground transition">
          <Pencil size={12} /> Editar mensagem do WhatsApp
        </button>
      </div>

      {editingMessage && (
        <DemoMessageEditor template={template} onClose={() => setEditingMessage(false)} />
      )}

      {requests.length === 0 ? (
        <div className="text-center py-8 px-6 bg-foreground/[0.03] border border-foreground/10 rounded-2xl">
          <p className="text-foreground/50 text-sm">Ninguém pediu demonstração ainda.</p>
        </div>
      ) : (
        <div className="bg-card border border-foreground/7 rounded-xl overflow-hidden divide-y divide-white/[0.05]">
          {requests.map((r: any) => {
            const digits = (r.phone ?? "").replace(/\D/g, "");
            const demoMessage = template.replaceAll("{nome}", r.name ?? "");
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 flex-wrap">
                <div className="flex-1 min-w-[160px]">
                  <div className="text-foreground font-medium text-sm">{r.name}</div>
                  <div className="text-foreground/40 text-xs">{relativeLabel(r.created_at)}</div>
                </div>
                <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1.5 text-xs text-foreground/60 hover:text-foreground transition">
                  <Mail size={13} /> {r.email}
                </a>
                {digits && (
                  <a
                    href={`https://wa.me/55${digits}?text=${encodeURIComponent(demoMessage)}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full text-black shrink-0"
                    style={{ backgroundColor: "#25D366" }}
                  >
                    <MessageCircle size={13} /> Chamar no WhatsApp
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
