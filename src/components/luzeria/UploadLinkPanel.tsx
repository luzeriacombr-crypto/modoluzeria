import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Link as LinkIcon, Copy, Check, MessageCircle, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { itemFilesQO } from "@/lib/luzeria/queries";
import {
  createItemUploadRequest, listItemUploadRequests, cancelItemUploadRequest,
} from "@/lib/luzeria/drive.functions";

function fmtBytes(n: number | null): string {
  if (!n) return "";
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1).replace(".", ",")} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Link (3 dias) pro freelancer subir imagens e vídeos direto no Drive,
 * sem login, preso a este post/reel. Os arquivos entram na lista de
 * "Materiais brutos" do item e ficam listados aqui com quem enviou. */
export function UploadLinkPanel({ itemId }: { itemId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listItemUploadRequests);
  const create = useServerFn(createItemUploadRequest);
  const cancelFn = useServerFn(cancelItemUploadRequest);
  const key = ["item-upload-requests", itemId];
  const { data: requests = [], isLoading } = useQuery({
    queryKey: key, queryFn: () => list({ data: { itemId } }), refetchInterval: 15000,
  });
  const [copied, setCopied] = useState(false);

  const createMut = useMutation({
    mutationFn: () => create({ data: { itemId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Link gerado. Copie e mande pro freelancer."); },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      if (msg.includes("DELIVERIES_FOLDER_MISSING")) toast.error("Configure a pasta de entregas no Perfil do cliente antes de gerar o link.");
      else toastFriendlyError(e, "Falha ao gerar o link");
    },
  });
  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: any) => toastFriendlyError(e, "Falha ao cancelar o link"),
  });

  const active = requests.find((r) => r.status === "ativo") ?? null;
  const link = active ? `https://www.modocriador.com.br/enviar/${active.token}` : null;
  const received = requests.flatMap((r) => r.files).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Quando chegam arquivos novos pelo link, atualiza a lista de materiais brutos do post.
  const lastCount = useRef<number | null>(null);
  useEffect(() => {
    if (lastCount.current !== null && received.length > lastCount.current) {
      qc.invalidateQueries({ queryKey: itemFilesQO(itemId, "raw").queryKey });
    }
    lastCount.current = received.length;
  }, [received.length, itemId, qc]);

  const btn = "inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-semibold border border-foreground/15 text-foreground/80 hover:text-foreground hover:border-foreground/30 transition";

  function copyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function cancel(id: string) {
    if (!(await requestConfirm("Cancelar esse link? Ele deixa de funcionar (o que já foi enviado continua no Drive).", { danger: true }))) return;
    cancelMut.mutate(id);
  }

  if (isLoading) return <Loader2 size={14} className="animate-spin text-foreground/40 my-2" />;

  return (
    <div className="mb-3 rounded-lg border border-foreground/8 bg-foreground/[0.02] p-3 space-y-2.5">
      <div className="text-[11px] text-foreground/45 leading-relaxed">
        Mande este link pra quem vai enviar os arquivos: a pessoa abre, escreve o nome e sobe as imagens e os vídeos direto pro Drive, sem login. Vale 3 dias e aceita até 3 GB por arquivo.
      </div>
      {!active ? (
        <button type="button" onClick={() => createMut.mutate()} disabled={createMut.isPending} className={`${btn} disabled:opacity-50`}>
          <LinkIcon size={12} /> {createMut.isPending ? "Gerando…" : "Gerar link de envio"}
        </button>
      ) : (
        <>
          <div className="bg-card border border-foreground/6 rounded-md px-3 py-2">
            <div className="text-xs font-semibold text-foreground mb-0.5">Link ativo até {new Date(active.expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</div>
            <div className="text-[11px] text-foreground/50 truncate">{link}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={copyLink} className={btn}>
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copiado!" : "Copiar link"}
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent(`Olá! Envie os arquivos por aqui: ${link}`)}`} target="_blank" rel="noopener noreferrer" className={btn}>
              <MessageCircle size={12} /> Mandar no WhatsApp
            </a>
            <button type="button" onClick={() => cancel(active.id)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-semibold text-foreground/40 hover:text-red-400 transition">
              <Trash2 size={12} /> Cancelar
            </button>
          </div>
        </>
      )}
      {received.length > 0 && (
        <div className="pt-2 border-t border-foreground/6">
          <div className="text-[10.5px] uppercase font-bold tracking-wider text-foreground/40 mb-1.5">Recebidos pelo link ({received.length})</div>
          <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {received.map((f) => (
              <li key={f.id} className="flex items-center gap-2 text-[12px] text-foreground/75">
                <CheckCircle2 size={12} className="shrink-0 text-[var(--lz-accent-ink)]" />
                <span className="truncate flex-1">{f.name}</span>
                <span className="text-[10.5px] text-foreground/35 shrink-0">{f.uploaderName}{f.sizeBytes ? ` · ${fmtBytes(f.sizeBytes)}` : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
