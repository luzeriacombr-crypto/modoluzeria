import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Clock, Linkedin } from "lucide-react";
import { toast } from "sonner";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import {
  getLinkedInConnectionStatus, getLinkedInConnectUrl, disconnectLinkedIn,
  getLinkedInItemState, publishToLinkedIn, setLinkedInAutoPublish,
} from "@/lib/luzeria/linkedin.functions";

/** Bloco de conexão da Ficha do Cliente (dentro de um FichaCard). */
export function LinkedInConnectSection({ clientId }: { clientId: string }) {
  const getConnStatus = useServerFn(getLinkedInConnectionStatus);
  const getConnectUrl = useServerFn(getLinkedInConnectUrl);
  const disconnect = useServerFn(disconnectLinkedIn);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const status = useQuery({
    queryKey: ["linkedin-connection-status", clientId],
    queryFn: () => getConnStatus({ data: { clientId } }),
  });

  async function connect() {
    setConnecting(true);
    try {
      const r: any = await getConnectUrl({ data: { clientId } });
      window.location.href = r.url;
    } catch (e: any) {
      toastFriendlyError(e, "Falha ao iniciar conexão com o LinkedIn");
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!(await requestConfirm("Desconectar o LinkedIn desse cliente? A publicação automática para de funcionar até reconectar.", { danger: true }))) return;
    setDisconnecting(true);
    try {
      await disconnect({ data: { clientId } });
      toast.success("LinkedIn desconectado.");
      status.refetch();
    } catch (e: any) {
      toastFriendlyError(e, "Falha ao desconectar");
    } finally {
      setDisconnecting(false);
    }
  }

  const data = status.data;

  return (
    <div>
      <p className="text-[11px] text-foreground/40 mb-3">
        Conecte a Página da Empresa desse cliente no LinkedIn pra publicar direto pelo Modo Criador. Só lemos o nome da Página; nada é publicado sem uma ação sua.
      </p>
      {status.isLoading ? (
        <div className="text-foreground/40 text-sm">Verificando…</div>
      ) : data?.connected ? (
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-[var(--lz-accent-ink)] font-medium flex items-center gap-2 min-w-0">
            <Linkedin size={14} className="shrink-0" />
            <span className="truncate">Conectado{data.name ? ` — ${data.name}` : ""}</span>
          </div>
          <button onClick={handleDisconnect} disabled={disconnecting}
            className="text-[11px] text-foreground/50 hover:text-red-400 transition disabled:opacity-50 shrink-0">
            Desconectar
          </button>
        </div>
      ) : (
        <button onClick={connect} disabled={connecting}
          className="lz-btn-primary text-xs px-4 py-2 rounded-md inline-flex items-center gap-2 disabled:opacity-50">
          {connecting ? <Loader2 size={14} className="animate-spin" /> : <Linkedin size={14} />}
          Conectar LinkedIn
        </button>
      )}
    </div>
  );
}

/** Conteúdo do bloco "Publicar no LinkedIn" do detalhe do item (dentro de um ModalSection). */
export function LinkedInPublishPanel({ itemId, clientId, scheduledAt, caption }: { itemId: string; clientId: string; scheduledAt?: string | null; caption?: string | null }) {
  const qc = useQueryClient();
  const getConnStatus = useServerFn(getLinkedInConnectionStatus);
  const getState = useServerFn(getLinkedInItemState);
  const publish = useServerFn(publishToLinkedIn);
  const setAuto = useServerFn(setLinkedInAutoPublish);

  const conn = useQuery({
    queryKey: ["linkedin-connection-status", clientId],
    queryFn: () => getConnStatus({ data: { clientId } }),
    retry: false,
  });
  const connected = !!conn.data?.connected;

  const state = useQuery({
    queryKey: ["linkedin-item-state", itemId],
    queryFn: () => getState({ data: { itemId } }),
    enabled: connected,
    retry: false,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["linkedin-item-state", itemId] });
  const publishMut = useMutation({
    mutationFn: () => publish({ data: { itemId } }),
    onSuccess: () => {
      toast.success("Publicado no LinkedIn!");
      refresh();
      qc.invalidateQueries({ queryKey: ["month"] });
    },
    onError: (e: any) => { toastFriendlyError(e, "Falha ao publicar no LinkedIn"); refresh(); },
  });
  const autoMut = useMutation({
    mutationFn: (enabled: boolean) => setAuto({ data: { itemId, enabled } }),
    onSuccess: (_r, enabled) => { toast.success(enabled ? "Publicação programada!" : "Publicação programada cancelada."); refresh(); },
    onError: (e: any) => toastFriendlyError(e, "Falha ao programar"),
  });

  // Tabela/credenciais indisponíveis: some sem quebrar o resto do detalhe do item.
  if (conn.isError) return null;
  if (conn.isLoading) return <div className="text-foreground/40 text-sm">Verificando…</div>;
  if (!connected) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button disabled title="Esse cliente ainda não conectou o LinkedIn — conecte na Ficha do Cliente"
          className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold opacity-40 cursor-not-allowed border border-foreground/8 text-foreground/60">
          <Linkedin size={14} /> Publicar no LinkedIn agora
        </button>
      </div>
    );
  }

  const auto = !!state.data?.autoPublish;
  const published = !!state.data?.publishedAt;
  const busy = publishMut.isPending || autoMut.isPending;

  return (
    <div className="space-y-3">
      <div className="text-[12px] text-foreground/60">
        {conn.data?.name ? <>Publicando em <b className="text-foreground">{conn.data.name}</b></> : "Página do LinkedIn conectada"}
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-wider text-foreground/50 mb-1">Legenda no LinkedIn</label>
        <div className="rounded-md border border-foreground/10 px-3 py-2 text-sm text-foreground/80 whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
          {caption?.trim() || <span className="text-foreground/40">Sem legenda — o post vai só com a imagem/vídeo.</span>}
        </div>
        <p className="text-[11px] text-foreground/40 mt-1">É a Legenda do item: edite no campo "Legenda" desta tela antes de publicar.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={async () => {
            if (!(await requestConfirm("Publicar esse item na Página do LinkedIn do cliente agora? Isso é uma ação real e pública."))) return;
            publishMut.mutate();
          }}
          disabled={busy || published}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold disabled:opacity-50"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          {publishMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Linkedin size={14} />}
          Publicar no LinkedIn agora
        </button>
        {auto ? (
          <button onClick={() => autoMut.mutate(false)} disabled={busy}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold border border-foreground/8 text-foreground/70 hover:text-foreground disabled:opacity-50">
            <Clock size={14} /> Cancelar programação
          </button>
        ) : (
          <button onClick={() => autoMut.mutate(true)} disabled={busy || !scheduledAt || published}
            title={!scheduledAt ? "Defina uma data e horário em Data de publicação primeiro" : undefined}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold border border-foreground/8 text-foreground/70 hover:text-foreground disabled:opacity-50">
            <Clock size={14} /> Programar publicação
          </button>
        )}
      </div>

      {auto && scheduledAt && (
        <p className="text-[11px]" style={{ color: "var(--lz-accent-ink)" }}>
          Programado pra publicar sozinho em {new Date(scheduledAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.
        </p>
      )}
      {published && <p className="text-[11px]" style={{ color: "var(--lz-accent-ink)" }}>Publicado no LinkedIn.</p>}
      {state.data?.lastError && !published && <p className="text-[11px] text-red-400">Último erro: {state.data.lastError}</p>}
      <p className="text-[11px] text-foreground/40">
        Envia a imagem (ou até 20 imagens, como carrossel) ou o vídeo anexado ao item e marca como Finalizado. "Programar" usa a data e horário de "Data de publicação".
      </p>
    </div>
  );
}
