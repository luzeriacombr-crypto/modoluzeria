// "Traga sua IA": o app dá 2 clientes/marcas grátis pra testar a IA; depois
// disso a pessoa conecta a chave de API dela. Sem chave, tudo continua
// funcionando do jeito manual. Aqui ficam o status, o campo da chave e o
// passo a passo (com um prompt pronto pra ela pedir ajuda à própria IA).
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { useMe } from "@/lib/luzeria/queries";
import { getAiConnection, saveAiKey, removeAiKey } from "@/lib/luzeria/ai-credentials.functions";

export const aiConnectionKey = ["ai-connection"];

const HELP_PROMPT = `Estou usando o app Modo Criador e ele precisa de uma chave de API da Anthropic (a empresa do Claude) pra ligar a inteligência artificial por conta própria. Sou leigo no assunto, então me guie passo a passo, em português, com linguagem simples e UM passo de cada vez. Só vá pro próximo quando eu disser que terminei o anterior.

Os passos que preciso:
1. Criar (ou entrar em) a conta em console.anthropic.com. Explique que a assinatura do Claude de conversa (claude.ai) NÃO é a mesma coisa que a API: a API é cobrada por uso, numa conta separada.
2. Adicionar um valor pequeno de crédito pra começar (sugira algo modesto) e ativar um limite mensal de gasto, pra eu nunca ter surpresa.
3. Criar uma chave em "API Keys" → "Create Key", dando o nome "Modo Criador".
4. Copiar a chave inteira (ela começa com sk-ant-) e COLAR somente no Modo Criador, em Configurações → Integrações → Inteligência artificial. Me lembre de nunca mandar essa chave pra mais ninguém nem colar em conversas.

Comece pelo passo 1.`;

export function AiConnectionSection() {
  const me = useMe().data;
  const qc = useQueryClient();
  const isMaster = me?.role === "master";
  const getFn = useServerFn(getAiConnection);
  const saveFn = useServerFn(saveAiKey);
  const removeFn = useServerFn(removeAiKey);
  const { data } = useQuery({ queryKey: aiConnectionKey, queryFn: () => getFn() });
  const [key, setKey] = useState("");
  const [copied, setCopied] = useState(false);

  const refresh = () => { qc.invalidateQueries({ queryKey: aiConnectionKey }); qc.invalidateQueries({ queryKey: ["clients"] }); };
  const save = useMutation({
    mutationFn: () => saveFn({ data: { apiKey: key.trim() } }),
    onSuccess: () => { setKey(""); refresh(); toast.success("IA conectada. Agora ela funciona em todos os clientes."); },
    onError: (e: any) => toastFriendlyError(e, "Não consegui conectar essa chave"),
  });
  const remove = useMutation({
    mutationFn: () => removeFn({}),
    onSuccess: () => { refresh(); toast.success("Chave removida."); },
    onError: (e: any) => toastFriendlyError(e, "Não consegui remover"),
  });

  async function copyPrompt() {
    try { await navigator.clipboard.writeText(HELP_PROMPT); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { toast.error("Não consegui copiar. Selecione o texto e copie à mão."); }
  }

  return (
    <div className="bg-card rounded-lg p-6 space-y-5">
      <div>
        {data?.connected ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: "var(--lz-accent-ink)" }}><Check size={15} /> IA conectada</span>
            <span className="text-foreground/50">chave terminada em <strong className="text-foreground/80">{data.keyLast4}</strong>. Sem limite de clientes; o uso é cobrado na sua conta de IA.</span>
          </div>
        ) : (
          <p className="text-sm text-foreground/70">
            {data?.unlimited ? "Esta conta usa a IA da plataforma, sem limite." : (
              <>Você pode testar a IA em <strong className="text-foreground">{data?.freeLimit ?? 2} clientes ou marcas</strong> de graça
                {data ? <> (usou {Math.min(data.freeUsed, data.freeLimit)} de {data.freeLimit})</> : null}. Para usar em mais, conecte a sua. Se preferir não conectar, é só seguir no manual: o Modo Criador funciona normalmente sem IA.</>
            )}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-foreground/10 p-4">
        <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/45 mb-2">Onde a sua IA é usada</div>
        <ul className="space-y-2 text-sm text-foreground/75">
          <li className="flex gap-2"><Sparkles size={14} className="mt-0.5 shrink-0 text-foreground/50" />
            <span><strong className="text-foreground">Planejamentos gerados por IA</strong> — ideias e roteiros de conteúdo de cada cliente.</span>
          </li>
          <li className="flex gap-2"><Sparkles size={14} className="mt-0.5 shrink-0 text-foreground/50" />
            <span><strong className="text-foreground">Nativo App</strong>, nosso aplicativo de criações de arte — lê publicações de um cliente e monta o acervo de modelos no estilo dele.</span>
          </li>
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-foreground/45">
          Com a sua chave conectada, os dois usos valem pra qualquer cliente e o custo é da sua conta de IA. Sem chave, os 2 primeiros clientes (ou marcas) são grátis nos dois usos; no Nativo, o teste grátis faz até 3 acervos por cliente.
        </p>
      </div>

      {isMaster && !data?.unlimited && (
        <div className="space-y-2">
          <label className="block text-[10px] uppercase font-bold tracking-wider text-foreground/45">Chave de API (Claude / Anthropic)</label>
          <div className="flex flex-wrap gap-2">
            <input value={key} onChange={(e) => setKey(e.target.value)} type="password" autoComplete="off" spellCheck={false}
              placeholder={data?.connected ? "Colar uma chave nova pra trocar" : "sk-ant-..."} className="lz-input flex-1 min-w-[220px]" />
            <button onClick={() => save.mutate()} disabled={save.isPending || key.trim().length < 20}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-bold disabled:opacity-40"
              style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
              {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} {data?.connected ? "Trocar" : "Conectar"}
            </button>
            {data?.connected && (
              <button onClick={async () => { if (await requestConfirm("Remover a chave? A IA volta a valer só pros 2 clientes grátis.", { danger: true })) remove.mutate(); }}
                disabled={remove.isPending} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold border border-foreground/15 text-foreground/70 hover:text-red-400">
                <Trash2 size={13} /> Remover
              </button>
            )}
          </div>
          <p className="text-[11px] text-foreground/40">A chave é guardada criptografada e só o servidor usa. Por enquanto funciona com Claude (Anthropic).</p>
        </div>
      )}
      {!isMaster && <p className="text-xs text-foreground/45">Só o gestor conecta a IA.</p>}

      {!data?.unlimited && (
        <details className="group rounded-xl border border-foreground/10 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-foreground flex items-center gap-2"><Sparkles size={14} /> Como conectar, passo a passo</summary>
          <ol className="mt-3 space-y-2 text-sm text-foreground/75 list-decimal pl-5">
            <li>Crie uma conta em <strong>console.anthropic.com</strong>. A assinatura do Claude de conversa (claude.ai) é outra coisa: a API é cobrada por uso, em conta separada.</li>
            <li>Adicione um valor pequeno de crédito e ative um <strong>limite mensal de gasto</strong>, pra não ter surpresa.</li>
            <li>Em <strong>API Keys</strong>, clique em <strong>Create Key</strong> e dê o nome &quot;Modo Criador&quot;.</li>
            <li>Copie a chave inteira (começa com <code>sk-ant-</code>) e cole no campo acima. Não envie essa chave a mais ninguém.</li>
          </ol>
          <div className="mt-4 rounded-lg bg-foreground/[0.04] p-3">
            <div className="text-xs text-foreground/60 mb-2">Prefere ser guiado? Cole este pedido na sua IA de conversa (Claude, ChatGPT, Manus…) e ela te leva passo a passo:</div>
            <pre className="whitespace-pre-wrap text-[11.5px] leading-relaxed text-foreground/75 max-h-40 overflow-y-auto">{HELP_PROMPT}</pre>
            <button onClick={copyPrompt} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-foreground/15 text-foreground/80 hover:bg-foreground/5">
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copiado" : "Copiar pedido"}
            </button>
          </div>
        </details>
      )}
    </div>
  );
}
