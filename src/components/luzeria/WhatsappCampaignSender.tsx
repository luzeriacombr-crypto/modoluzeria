import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { getWhatsappSetup, sendWhatsappCampaign, getWhatsappCampaignStatus } from "@/lib/luzeria/whatsapp.functions";

// Preço aproximado da Meta por mensagem no Brasil (só pra dar uma noção
// antes de disparar — o valor real vem na fatura da Meta).
const COST_BY_CATEGORY: Record<string, number> = { MARKETING: 0.35, UTILITY: 0.04, AUTHENTICATION: 0.04 };

/** Envio de verdade pelo WhatsApp oficial (modelo aprovado na Meta), pras
 * agências selecionadas no painel de Mensagens. {{1}} é sempre o primeiro
 * nome do responsável; as outras variáveis do modelo são preenchidas aqui. */
export function WhatsappCampaignSender({ selectedIds, defaultText }: { selectedIds: string[]; defaultText: string }) {
  const { data: setup, isLoading } = useQuery({
    queryKey: ["whatsapp-setup"],
    queryFn: () => getWhatsappSetup(),
    staleTime: 60_000,
  });
  const [templateName, setTemplateName] = useState("");
  const [extra, setExtra] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ campaignId: string; sent: number; failed: { orgName: string; reason: string }[]; skipped: { orgName: string; reason: string }[] } | null>(null);

  const template = setup?.templates.find((t) => t.name === templateName) ?? null;
  const extraCount = Math.max(0, (template?.variableCount ?? 0) - 1);

  useEffect(() => {
    if (!template) return;
    // {{2}} já vem com o texto da mensagem do painel, pra não digitar duas vezes.
    setExtra(Array.from({ length: extraCount }, (_, i) => (i === 0 ? defaultText : "")));
    setConfirming(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateName]);

  const send = useMutation({
    mutationFn: useServerFn(sendWhatsappCampaign),
    onSuccess: (r: any) => {
      setResult(r);
      setConfirming(false);
      toast.success(`WhatsApp enviado pra ${r.sent} agência${r.sent === 1 ? "" : "s"}.`);
    },
    onError: (e: any) => { setConfirming(false); toastFriendlyError(e, "Não consegui disparar no WhatsApp."); },
  });

  const { data: status } = useQuery({
    queryKey: ["whatsapp-campaign-status", result?.campaignId],
    queryFn: () => getWhatsappCampaignStatus({ data: { campaignId: result!.campaignId } }),
    enabled: !!result?.campaignId,
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return <p className="text-foreground/40 text-[12px] flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Carregando WhatsApp…</p>;
  }
  if (!setup?.configured) {
    return <p className="text-[12px] text-foreground/40">WhatsApp oficial ainda não configurado (faltam as chaves da Meta na Vercel).</p>;
  }

  const preview = template
    ? template.body
        .replaceAll("{{1}}", "[primeiro nome]")
        .replace(/\{\{(\d+)\}\}/g, (_, n) => extra[Number(n) - 2]?.replace(/\s*\n+\s*/g, " · ") || `[campo ${n}]`)
    : "";
  const estimatedCost = template ? selectedIds.length * (COST_BY_CATEGORY[template.category] ?? 0.35) : 0;

  return (
    <div className="rounded-lg border p-3 space-y-3" style={{ borderColor: "#25D36655" }}>
      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#25D366" }}>WhatsApp oficial — envio automático</p>
      {setup.error && <p className="text-[12px] text-red-500">Erro ao buscar os modelos: {setup.error}</p>}
      {setup.templates.length === 0 ? (
        <p className="text-[12px] text-foreground/50">Nenhum modelo aprovado ainda. Crie e aprove no WhatsApp Manager da Meta.</p>
      ) : (
        <>
          <select
            value={templateName} onChange={(e) => setTemplateName(e.target.value)}
            className="w-full px-3 py-2 bg-foreground/[0.08] border border-foreground/15 rounded-lg text-foreground text-sm"
          >
            <option value="">Escolha um modelo aprovado…</option>
            {setup.templates.map((t) => (
              <option key={t.name} value={t.name}>{t.name} ({t.category === "MARKETING" ? "marketing" : "utilidade"})</option>
            ))}
          </select>

          {template && (
            <>
              {extra.map((v, i) => (
                <div key={i}>
                  <p className="text-[11px] text-foreground/50 mb-1">Campo {`{{${i + 2}}}`}</p>
                  <textarea
                    value={v} rows={i === 0 ? 4 : 2}
                    onChange={(e) => setExtra((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))}
                    className="w-full px-3 py-2 bg-foreground/[0.08] border border-foreground/15 rounded-lg text-foreground text-sm resize-y"
                  />
                </div>
              ))}
              {extraCount > 0 && (
                <p className="text-[10.5px] text-foreground/35">O WhatsApp não aceita quebra de linha dentro dos campos — os parágrafos viram " · ".</p>
              )}
              <div className="rounded-lg bg-foreground/[0.04] px-3 py-2 text-[12.5px] text-foreground/80 whitespace-pre-wrap">{preview}</div>
              <p className="text-[11px] text-foreground/45">
                Custo estimado: ~R$ {estimatedCost.toFixed(2).replace(".", ",")} ({selectedIds.length} × {template.category === "MARKETING" ? "marketing" : "utilidade"}). Quem respondeu SAIR fica de fora sozinho.
              </p>
              {!confirming ? (
                <button
                  onClick={() => setConfirming(true)}
                  disabled={selectedIds.length === 0 || send.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm text-white disabled:opacity-40"
                  style={{ backgroundColor: "#25D366" }}
                >
                  <Send size={14} /> Enviar pelo WhatsApp ({selectedIds.length})
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12.5px] text-foreground/80">Mandar agora pra {selectedIds.length} agência{selectedIds.length === 1 ? "" : "s"}? Não dá pra desfazer.</span>
                  <button
                    onClick={() => send.mutate({ data: { orgIds: selectedIds, templateName: template.name, extraParams: extra } })}
                    disabled={send.isPending}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-sm text-white disabled:opacity-40"
                    style={{ backgroundColor: "#25D366" }}
                  >
                    {send.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Confirmar envio
                  </button>
                  <button onClick={() => setConfirming(false)} disabled={send.isPending} className="text-[12px] text-foreground/50 underline underline-offset-2">Cancelar</button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {result && (
        <div className="text-[12px] text-foreground/70 space-y-1">
          <p>
            <strong>{result.sent}</strong> enviada{result.sent === 1 ? "" : "s"}
            {status && <> · {status.delivered + status.read} entregue{status.delivered + status.read === 1 ? "" : "s"} · {status.read} lida{status.read === 1 ? "" : "s"}</>}
            {status && status.failed > 0 && <> · <span className="text-red-500">{status.failed} falharam depois</span></>}
          </p>
          {result.skipped.length > 0 && (
            <p className="text-foreground/45">Puladas: {result.skipped.map((s) => `${s.orgName} (${s.reason})`).join(", ")}</p>
          )}
          {result.failed.length > 0 && (
            <p className="text-red-500">Falharam: {result.failed.map((f) => `${f.orgName} (${f.reason})`).join(", ")}</p>
          )}
        </div>
      )}
    </div>
  );
}
