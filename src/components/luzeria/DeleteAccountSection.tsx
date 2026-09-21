import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/luzeria/queries";
import { deleteMyOrg } from "@/lib/luzeria/api.functions";

/** "Zona de perigo" — a própria agência (só o master) exclui a conta. */
export function DeleteAccountSection() {
  const me = useMe().data;
  const del = useServerFn(deleteMyOrg);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const orgName = (me as any)?.orgName as string | undefined;

  if (!me || me.role !== "master" || !orgName) return null;
  const match = typed.trim().toLowerCase() === orgName.trim().toLowerCase();

  async function confirm() {
    if (!match) return;
    setBusy(true);
    try {
      await del({ data: { confirmName: typed } });
      toast.success("Conta excluída. Sentiremos sua falta!");
      await supabase.auth.signOut().catch(() => {});
      window.location.href = "/";
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível excluir a conta.");
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-3 flex items-center gap-1.5">
        <AlertTriangle size={12} /> Excluir conta
      </h2>
      <div className="rounded-lg border p-5 flex flex-col sm:flex-row sm:items-center gap-4" style={{ borderColor: "rgba(255,90,71,0.35)", background: "rgba(255,90,71,0.05)" }}>
        <div className="flex-1 text-sm text-foreground/70 leading-relaxed">
          <div className="font-semibold text-foreground mb-1">Excluir minha agência e todos os dados</div>
          Apaga a agência, clientes, conteúdos, equipe e integrações, e <b className="text-foreground">cancela a assinatura</b>. Não dá para desfazer. Se você está só testando, não precisa excluir: o teste grátis termina sozinho, sem cobrança.
        </div>
        <button type="button" onClick={() => { setTyped(""); setOpen(true); }}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-md border transition hover:bg-red-500/10"
          style={{ borderColor: "rgba(255,90,71,0.55)", color: "#FF6B5A" }}>
          <Trash2 size={14} /> Excluir minha conta
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-md bg-card border border-foreground/10 rounded-2xl p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="del-title">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 id="del-title" className="text-base font-semibold text-foreground">Excluir a agência {orgName}?</h3>
              <button onClick={() => setOpen(false)} disabled={busy} aria-label="Fechar" className="text-foreground/40 hover:text-foreground"><X size={16} /></button>
            </div>
            <p className="text-[13px] text-foreground/65 leading-relaxed mb-4">
              Isso apaga <b className="text-foreground">tudo</b> (clientes, conteúdos, arquivos, equipe e integrações), cancela a assinatura e encerra o acesso de todas as pessoas da equipe. <b className="text-foreground">Não tem como recuperar.</b>
            </p>
            <label className="block text-[12px] font-semibold text-foreground/60 mb-1.5" htmlFor="del-confirm">
              Para confirmar, digite o nome da agência: <span className="text-foreground">{orgName}</span>
            </label>
            <input id="del-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus
              className="w-full bg-background border border-foreground/12 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-red-400" />
            <div className="flex gap-2 mt-5">
              <button onClick={() => setOpen(false)} disabled={busy}
                className="flex-1 text-sm font-bold px-4 py-2.5 rounded-md border border-foreground/15 text-foreground/80 hover:text-foreground">Cancelar</button>
              <button onClick={confirm} disabled={!match || busy}
                className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-md bg-red-500/90 hover:bg-red-500 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Excluir para sempre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
