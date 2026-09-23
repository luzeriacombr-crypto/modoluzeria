import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { Check, Copy, KeyRound, Loader2, Lock, Trash2 } from "lucide-react";
import { mcpStatusQO } from "@/lib/luzeria/queries";
import { createMcpKey, revokeMcpKey } from "@/lib/luzeria/mcp-keys.functions";
import { requestConfirm } from "@/lib/luzeria/confirm-store";

function CopyBox({ text, label }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div>
      {label && <div className="text-[11px] font-semibold text-foreground/55 mb-1">{label}</div>}
      <div className="flex items-start gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.04] px-3 py-2">
        <pre className="flex-1 min-w-0 text-[11.5px] leading-relaxed whitespace-pre-wrap break-all font-mono text-foreground/85">{text}</pre>
        <button type="button" aria-label="Copiar" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1600); } catch { toast.error("Não consegui copiar."); } }}
          className="shrink-0 p-1.5 rounded-md text-foreground/55 hover:text-foreground hover:bg-foreground/[0.08]">
          {ok ? <Check size={14} style={{ color: "var(--lz-accent-ink)" }} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "nunca");

export function McpSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(mcpStatusQO());
  const create = useServerFn(createMcpKey);
  const revoke = useServerFn(revokeMcpKey);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  if (isLoading || !data) return <div className="text-sm text-foreground/40">Carregando…</div>;

  if (!data.eligible) {
    return (
      <div className="bg-card rounded-lg p-6 flex gap-4 items-start">
        <div className="h-9 w-9 rounded-md flex items-center justify-center shrink-0 bg-foreground/[0.06] text-foreground/50"><Lock size={16} /></div>
        <div className="text-sm text-foreground/70 leading-relaxed">
          <div className="font-semibold text-foreground mb-1">Conecte o Claude ou o ChatGPT ao Modo Criador</div>
          {data.reason === "plan"
            ? <>Disponível a partir do plano <b className="text-foreground">Pro</b>. Faça upgrade em Plano e Cobrança para liberar.</>
            : <>Liberado a partir do nível <b className="text-foreground">Prata II</b> do Programa de Níveis — sua agência está em <b className="text-foreground">{data.levelLabel}</b>. <Link to="/programa-de-niveis" className="underline">Ver o programa →</Link></>}
        </div>
      </div>
    );
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return;
    setBusy(true);
    try {
      const r = await create({ data: { name: name.trim() } });
      setNewKey(r.key); setName("");
      qc.invalidateQueries({ queryKey: ["mcp-status"] });
    } catch (err: any) { toastFriendlyError(err, "Não consegui criar a chave."); }
    finally { setBusy(false); }
  }
  async function onRevoke(id: string, label: string) {
    if (!(await requestConfirm(`Revogar a chave "${label}"? Quem usa essa chave perde o acesso na hora.`, { danger: true, confirmLabel: "Revogar" }))) return;
    try { await revoke({ data: { id } }); toast.success("Chave revogada."); qc.invalidateQueries({ queryKey: ["mcp-status"] }); }
    catch (err: any) { toastFriendlyError(err, "Erro ao revogar."); }
  }

  const keyForSnippet = newKey ?? "SUA_CHAVE";
  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg p-6 space-y-5">
        <div className="flex gap-4 items-start">
          <div className="h-9 w-9 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}><KeyRound size={16} /></div>
          <div className="text-sm text-foreground/70 leading-relaxed">
            <div className="font-semibold text-foreground mb-1">Converse com o Modo Criador pela sua IA</div>
            Conecte o Claude (ou outra IA compatível com MCP) e pergunte coisas como <i>"o que tem de demanda nessa semana e quantas horas leva?"</i>. Nesta versão a IA <b className="text-foreground">só lê</b> — não cria, não altera e não publica nada.
          </div>
        </div>

        {newKey && (
          <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(var(--lz-brand-light-rgb),0.10)", border: "1px solid rgba(var(--lz-brand-rgb),0.45)" }}>
            <div className="text-[13px] font-bold text-foreground">Sua chave foi criada — copie agora</div>
            <div className="text-[12px] text-foreground/65">Por segurança ela aparece só desta vez. Se perder, revogue e crie outra.</div>
            <CopyBox text={newKey} />
            <button type="button" onClick={() => setNewKey(null)} className="text-[11px] font-bold uppercase tracking-wider text-foreground/55 hover:text-foreground">Já copiei</button>
          </div>
        )}

        <form onSubmit={onCreate} className="flex flex-col sm:flex-row gap-2">
          <input id="mcp-key-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder='Nome da chave (ex.: "Claude do Eduardo")'
            className="flex-1 min-w-0 bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
          <button type="submit" disabled={busy || name.trim().length < 2}
            className="lz-btn-primary text-xs font-bold px-4 py-2 rounded-md inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} Criar chave
          </button>
        </form>

        {data.keys.length > 0 && (
          <div className="divide-y divide-foreground/8 rounded-lg border border-foreground/8">
            {data.keys.map((k) => (
              <div key={k.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-foreground truncate">{k.name}{k.mine ? "" : " · de outro administrador"}</div>
                  <div className="text-[11px] text-foreground/45">{k.prefix}… · criada em {fmt(k.createdAt)} · último uso: {fmt(k.lastUsedAt)}</div>
                </div>
                <button type="button" onClick={() => onRevoke(k.id, k.name)} aria-label={`Revogar ${k.name}`} className="p-1.5 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card rounded-lg p-6 space-y-4">
        <div className="text-[13px] font-bold text-foreground">Como conectar</div>
        <CopyBox label="Claude Code (terminal)" text={`claude mcp add --transport http modo-criador ${data.url} --header "Authorization: Bearer ${keyForSnippet}"`} />
        <CopyBox label="Claude no navegador ou no app (Configurações → Conectores → adicionar conector personalizado)" text={`URL: ${data.url}\nCabeçalho: Authorization\nValor: Bearer ${keyForSnippet}`} />
        <CopyBox label="Cursor (arquivo mcp.json)" text={JSON.stringify({ mcpServers: { "modo-criador": { url: data.url, headers: { Authorization: `Bearer ${keyForSnippet}` } } } }, null, 2)} />
        <p className="text-[11.5px] text-foreground/45">O ChatGPT ainda não é suportado: ele exige login por OAuth, que estamos preparando.</p>
      </div>

      {data.activity.length > 0 && (
        <div className="bg-card rounded-lg p-6">
          <div className="text-[13px] font-bold text-foreground mb-3">Atividade recente da IA</div>
          <div className="space-y-1.5">
            {data.activity.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-[12px] text-foreground/65">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: a.ok ? "#5BC48A" : "#FF6B6B" }} />
                <span className="font-mono text-foreground/85">{a.tool}</span>
                <span className="text-foreground/35 truncate">{a.summary && a.summary !== "{}" ? a.summary : ""}</span>
                <span className="ml-auto shrink-0 tabular-nums text-foreground/40">{fmt(a.at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
