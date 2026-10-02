import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useApi, useMe } from "@/lib/luzeria/queries";
import { DEFAULT_ANNIVERSARY_MESSAGE, renderAnniversaryMessage } from "@/lib/luzeria/anniversary";

/** Editor do texto do cartão de aniversário de casa (só Adm Master). */
export function AnniversaryMessageEditor() {
  const me = useMe().data;
  const { setAnniversaryMessage } = useApi();
  const [text, setText] = useState(me?.orgAnniversaryMessage ?? DEFAULT_ANNIVERSARY_MESSAGE);
  useEffect(() => { setText(me?.orgAnniversaryMessage ?? DEFAULT_ANNIVERSARY_MESSAGE); }, [me?.orgAnniversaryMessage]);
  if (me?.role !== "master") return null;

  const preview = renderAnniversaryMessage(text, { nome: "Amaro", anos: 1, agencia: me.orgName ?? "agência" });
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
      <div className="text-sm font-bold text-foreground">Mensagem de aniversário de casa</div>
      <p className="text-[12px] text-foreground/45 mt-1 mb-3">
        No dia em que alguém completa 1, 2, 3... anos de agência (data preenchida no perfil de cada membro), ele vê este texto em Minhas Demandas. Use <code className="text-foreground/70">{"{nome}"}</code>, <code className="text-foreground/70">{"{tempo}"}</code> (ex: "um ano") e <code className="text-foreground/70">{"{agencia}"}</code>.
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
  );
}
