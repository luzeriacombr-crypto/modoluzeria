import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/luzeria/queries";
import { deleteMyOrg, deleteMyAccount, getDeleteAccountInfo } from "@/lib/luzeria/api.functions";
import { PasswordInput } from "./PasswordInput";

type Scope = "org" | "me";

const DELETE_REASONS = [
  "Está caro / não cabe no meu orçamento",
  "Não estou mais usando",
  "Faltam funcionalidades que eu preciso",
  "Achei difícil de usar",
  "Encontrei outra ferramenta",
  "Tive erros ou problemas no sistema",
  "Estava só testando",
  "Fechei a agência / mudei de ramo",
  "Outro motivo",
];

/** Confirmação de exclusão: escolhe o que apagar (a agência inteira + a minha conta, ou só a minha),
 * digita o nome da agência e a senha. Quem entra só com Google não tem senha: digita o e-mail. */
export function DeleteAccountModal({ open, onClose, defaultScope }: { open: boolean; onClose: () => void; defaultScope?: Scope }) {
  const me = useMe().data;
  const { data: info } = useQuery({
    queryKey: ["delete-account-info"],
    queryFn: () => getDeleteAccountInfo(),
    enabled: open,
    staleTime: 0,
  });
  const delOrg = useServerFn(deleteMyOrg);
  const delMe = useServerFn(deleteMyAccount);
  const [scope, setScope] = useState<Scope | null>(defaultScope ?? null);
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [reasons, setReasons] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const orgName = ((me as any)?.orgName as string | undefined) ?? "";
  const isMaster = !!info?.isMaster;
  const effectiveScope: Scope | null = isMaster ? scope : "me";

  if (!open || !me) return null;

  const nameOk = typed.trim().toLowerCase() === orgName.trim().toLowerCase() && orgName.length > 0;
  const credOk = info?.hasPassword ? password.length > 0 : email.trim().length > 0;
  const blockedLastMaster = effectiveScope === "me" && !!info?.onlyMaster;
  const canSubmit = !!effectiveScope && !!info && nameOk && credOk && !blockedLastMaster && !busy;

  function close() {
    if (busy) return;
    setTyped(""); setPassword(""); setEmail(""); setReasons([]); setComment(""); setScope(defaultScope ?? null);
    onClose();
  }

  async function confirm() {
    if (!canSubmit || !effectiveScope) return;
    setBusy(true);
    try {
      const payload = { confirmName: typed, reasons, comment: comment.trim() || undefined, password: info?.hasPassword ? password : undefined, confirmEmail: info?.hasPassword ? undefined : email };
      if (effectiveScope === "org") await delOrg({ data: payload });
      else await delMe({ data: payload });
      toast.success(effectiveScope === "org" ? "Agência e conta excluídas. Sentiremos sua falta!" : "Sua conta foi excluída.");
      await supabase.auth.signOut().catch(() => {});
      window.location.href = "/";
    } catch (e: any) {
      toastFriendlyError(e, "Não foi possível excluir.");
      setBusy(false);
    }
  }

  const optionCls = (active: boolean) =>
    `w-full text-left rounded-lg border p-3 transition ${active ? "border-red-400 bg-red-500/10" : "border-foreground/12 hover:border-foreground/30"}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={close}>
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-card border border-foreground/10 rounded-2xl p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="del-title">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 id="del-title" className="text-base font-semibold text-foreground">Tem certeza que deseja apagar a sua conta?</h3>
          <button onClick={close} disabled={busy} aria-label="Fechar" className="text-foreground/40 hover:text-foreground"><X size={16} /></button>
        </div>

        {!info ? (
          <div className="py-8 grid place-items-center text-foreground/50"><Loader2 className="animate-spin" size={18} /></div>
        ) : info.isLuzeria ? (
          <p className="text-[13px] text-foreground/65 leading-relaxed py-2">Contas da equipe Luzeria não podem ser apagadas por aqui.</p>
        ) : (
          <>
            {isMaster ? (
              <div className="space-y-2 my-4">
                <button type="button" className={optionCls(scope === "org")} onClick={() => setScope("org")}>
                  <div className="text-sm font-semibold text-foreground">Apagar a agência {orgName} e a minha conta</div>
                  <div className="text-[12px] text-foreground/60 mt-0.5">Apaga clientes, conteúdos, arquivos, equipe e integrações, cancela a assinatura e encerra o acesso de todas as pessoas da equipe. Não tem como recuperar.</div>
                </button>
                <button type="button" className={optionCls(scope === "me")} onClick={() => setScope("me")}>
                  <div className="text-sm font-semibold text-foreground">Apagar apenas a minha conta</div>
                  <div className="text-[12px] text-foreground/60 mt-0.5">A agência e o resto da equipe continuam. Só o seu acesso é removido.</div>
                </button>
              </div>
            ) : (
              <p className="text-[13px] text-foreground/65 leading-relaxed my-4">
                Isso apaga <b className="text-foreground">apenas a sua conta</b>. A agência {orgName} e o resto da equipe continuam. Não tem como recuperar.
              </p>
            )}

            {blockedLastMaster && (
              <div className="rounded-lg px-3 py-2.5 mb-4 text-[12.5px] leading-relaxed" style={{ background: "rgba(255,170,0,0.1)", color: "#E5A93B" }}>
                Você é o único administrador master. Passe o cargo de master para outra pessoa antes (em Equipe), ou escolha apagar a agência inteira.
              </div>
            )}

            {effectiveScope && !blockedLastMaster && (
              <div className="space-y-3">
                <fieldset className="pb-1">
                  <legend className="block text-[12px] font-semibold text-foreground/60 mb-1.5">Por que você está saindo? (opcional, pode marcar mais de um)</legend>
                  <div className="grid gap-1">
                    {DELETE_REASONS.map((r) => (
                      <label key={r} className="flex items-center gap-2 text-[13px] text-foreground/80 cursor-pointer">
                        <input type="checkbox" checked={reasons.includes(r)}
                          onChange={(e) => setReasons((cur) => (e.target.checked ? [...cur, r] : cur.filter((x) => x !== r)))} />
                        {r}
                      </label>
                    ))}
                  </div>
                  <label className="block text-[12px] font-semibold text-foreground/60 mt-3 mb-1.5" htmlFor="del-comment">Quer deixar um comentário ou sugestão? (opcional)</label>
                  <textarea id="del-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} rows={3}
                    placeholder="O que poderíamos ter feito diferente?"
                    className="w-full bg-background border border-foreground/12 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-red-400 resize-none" />
                </fieldset>
                <div>
                  <label className="block text-[12px] font-semibold text-foreground/60 mb-1.5" htmlFor="del-confirm">
                    Para confirmar, digite o nome da agência: <span className="text-foreground">{orgName}</span>
                  </label>
                  <input id="del-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off"
                    className="w-full bg-background border border-foreground/12 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-red-400" />
                </div>
                {info.hasPassword ? (
                  <div>
                    <label className="block text-[12px] font-semibold text-foreground/60 mb-1.5" htmlFor="del-password">Sua senha</label>
                    <PasswordInput id="del-password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
                      className="w-full bg-background border border-foreground/12 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-red-400" />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[12px] font-semibold text-foreground/60 mb-1.5" htmlFor="del-email">
                      Sua conta entra com Google e não tem senha. Digite o seu e-mail: <span className="text-foreground">{info.email}</span>
                    </label>
                    <input id="del-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off"
                      className="w-full bg-background border border-foreground/12 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-red-400" />
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <button onClick={close} disabled={busy}
                className="flex-1 text-sm font-bold px-4 py-2.5 rounded-md border border-foreground/15 text-foreground/80 hover:text-foreground">Cancelar</button>
              <button onClick={confirm} disabled={!canSubmit}
                className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-md bg-red-500/90 hover:bg-red-500 text-white disabled:opacity-40 disabled:cursor-not-allowed">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {effectiveScope === "org" ? "Apagar tudo para sempre" : "Apagar minha conta"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Linha "Apagar minha conta" do fim da página Meu perfil, logo abaixo de "Sair da conta". */
export function DeleteAccountProfileRow() {
  const me = useMe().data;
  const [open, setOpen] = useState(false);
  if (!me || (me as any).orgId == null) return null;
  return (
    <>
      <div className="mt-6 pt-6 border-t border-foreground/6 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-foreground">Apagar minha conta</div>
          <div className="text-[11px] text-foreground/50 mt-1">Apaga só a sua conta ou, se você for master, a agência inteira. Não dá para desfazer.</div>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-md text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
        >
          <Trash2 size={13} /> Apagar
        </button>
      </div>
      <DeleteAccountModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** "Zona de perigo" em Plano e Cobrança — a própria agência (só o master) exclui a conta. */
export function DeleteAccountSection() {
  const me = useMe().data;
  const [open, setOpen] = useState(false);
  const orgName = (me as any)?.orgName as string | undefined;
  if (!me || me.role !== "master" || !orgName) return null;

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
        <button type="button" onClick={() => setOpen(true)}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-md border transition hover:bg-red-500/10"
          style={{ borderColor: "rgba(255,90,71,0.55)", color: "#FF6B5A" }}>
          <Trash2 size={14} /> Excluir minha conta
        </button>
      </div>
      <DeleteAccountModal open={open} onClose={() => setOpen(false)} defaultScope="org" />
    </div>
  );
}
