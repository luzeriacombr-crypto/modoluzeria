import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, PartyPopper } from "lucide-react";
import { useApi, useMe } from "@/lib/luzeria/queries";
import { DEFAULT_ANNIVERSARY_MESSAGE, renderAnniversaryMessage } from "@/lib/luzeria/anniversary";

/** Editor do texto do cartão de aniversário de casa (só Adm Master). */
export function AnniversaryMessageEditor() {
  const me = useMe().data;
  const { setAnniversaryMessage } = useApi();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(me?.orgAnniversaryMessage ?? DEFAULT_ANNIVERSARY_MESSAGE);
  useEffect(() => { setText(me?.orgAnniversaryMessage ?? DEFAULT_ANNIVERSARY_MESSAGE); }, [me?.orgAnniversaryMessage]);
  if (me?.role !== "master") return null;

  const preview = renderAnniversaryMessage(text, { nome: "Amaro", anos: 1, agencia: me.orgName ?? (me.accountType === "house" ? "house" : "agência") });
  const unchanged = text.trim() === (me.orgAnniversaryMessage ?? DEFAULT_ANNIVERSARY_MESSAGE).trim();

  function save() {
    const isDefault = text.trim() === DEFAULT_ANNIVERSARY_MESSAGE;
    setAnniversaryMessage.mutate({ data: { message: isDefault ? null : text.trim() } }, {
      onSuccess: () => toast.success("Mensagem salva."),
      onError: () => toast.error("Não consegui salvar a mensagem."),
    });
  }

  return (
    <div className="mt-8 rounded-2xl border border-foreground/8 bg-card p-5">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2.5 text-left">
        <PartyPopper size={16} className="shrink-0" style={{ color: "var(--lz-accent-ink)" }} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground">Mensagem de aniversário de casa</div>
          <div className="text-[11px] text-foreground/45">O texto que cada membro vê em Minhas Demandas no dia em que completa mais um ano de {me.accountType === "house" ? "house" : "agência"}.</div>
        </div>
        {open ? <ChevronDown size={14} className="text-foreground/40 shrink-0" /> : <ChevronRight size={14} className="text-foreground/40 shrink-0" />}
      </button>
      {open && (
        <div className="mt-4">
          <p className="text-[12px] text-foreground/45 mb-3">
            Use <code className="text-foreground/70">{"{nome}"}</code>, <code className="text-foreground/70">{"{tempo}"}</code> (ex: "um ano") e <code className="text-foreground/70">{"{agencia}"}</code>. A data de entrada é preenchida no perfil de cada membro.
          </p>
          <textarea
            value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={600}
            className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] resize-none"
          />
          <div className="text-[11.5px] text-foreground/40 mt-2">Prévia: <span className="text-foreground/65">{preview}</span></div>
          <div className="flex items-center gap-3 mt-3">
            <button onClick={save} disabled={unchanged || setAnniversaryMessage.isPending}
              className="rounded-md px-4 py-2 text-xs font-bold disabled:opacity-40" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
              {setAnniversaryMessage.isPending ? "Salvando…" : "Salvar mensagem"}
            </button>
            <button onClick={() => setText(DEFAULT_ANNIVERSARY_MESSAGE)} className="text-[11.5px] text-foreground/45 hover:text-foreground">Restaurar texto padrão</button>
          </div>
        </div>
      )}
    </div>
  );
}
