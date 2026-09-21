import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Clock, Music2 } from "lucide-react";
import { toast } from "sonner";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import {
  getTikTokConnectionStatus, getTikTokConnectUrl, disconnectTikTok,
  getTikTokCreatorInfo, getTikTokItemState, publishToTikTok, setTikTokAutoPublish,
  type TikTokPostSettings,
} from "@/lib/luzeria/tiktok.functions";

const PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Todos",
  MUTUAL_FOLLOW_FRIENDS: "Amigos (seguem um ao outro)",
  FOLLOWER_OF_CREATOR: "Seguidores",
  SELF_ONLY: "Só eu (privado)",
};

/** Bloco de conexão da Ficha do Cliente (dentro de um FichaCard). */
export function TikTokConnectSection({ clientId }: { clientId: string }) {
  const getConnStatus = useServerFn(getTikTokConnectionStatus);
  const getConnectUrl = useServerFn(getTikTokConnectUrl);
  const disconnect = useServerFn(disconnectTikTok);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const status = useQuery({
    queryKey: ["tiktok-connection-status", clientId],
    queryFn: () => getConnStatus({ data: { clientId } }),
  });

  async function connect() {
    setConnecting(true);
    try {
      const r: any = await getConnectUrl({ data: { clientId } });
      window.location.href = r.url;
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao iniciar conexão com o TikTok");
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!(await requestConfirm("Desconectar o TikTok desse cliente? A publicação automática para de funcionar até reconectar.", { danger: true }))) return;
    setDisconnecting(true);
    try {
      await disconnect({ data: { clientId } });
      toast.success("TikTok desconectado.");
      status.refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao desconectar");
    } finally {
      setDisconnecting(false);
    }
  }

  const data = status.data;

  return (
    <div>
      <p className="text-[11px] text-foreground/40 mb-3">
        Conecte a conta do TikTok desse cliente pra publicar vídeos direto pelo Modo Criador. Só lemos o nome e a foto da conta; nada é publicado sem uma ação sua.
      </p>
      {status.isLoading ? (
        <div className="text-foreground/40 text-sm">Verificando…</div>
      ) : data?.connected ? (
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-[var(--lz-accent-ink)] font-medium flex items-center gap-2 min-w-0">
            {data.avatarUrl ? (
              <img src={data.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
            ) : (
              <Music2 size={14} />
            )}
            <span className="truncate">Conectado{data.displayName ? ` — ${data.displayName}` : ""}</span>
          </div>
          <button onClick={handleDisconnect} disabled={disconnecting}
            className="text-[11px] text-foreground/50 hover:text-red-400 transition disabled:opacity-50 shrink-0">
            Desconectar
          </button>
        </div>
      ) : (
        <button onClick={connect} disabled={connecting}
          className="lz-btn-primary text-xs px-4 py-2 rounded-md inline-flex items-center gap-2 disabled:opacity-50">
          {connecting ? <Loader2 size={14} className="animate-spin" /> : <Music2 size={14} />}
          Conectar TikTok
        </button>
      )}
    </div>
  );
}

const EMPTY: TikTokPostSettings = {
  privacyLevel: undefined as unknown as TikTokPostSettings["privacyLevel"],
  allowComment: false, allowDuet: false, allowStitch: false, brandOrganic: false, brandContent: false,
};

/** Conteúdo do bloco "Publicar no TikTok" do detalhe do item (dentro de um ModalSection). */
export function TikTokPublishPanel({ itemId, clientId, scheduledAt, caption }: { itemId: string; clientId: string; scheduledAt?: string | null; caption?: string | null }) {
  const qc = useQueryClient();
  const getConnStatus = useServerFn(getTikTokConnectionStatus);
  const getCreator = useServerFn(getTikTokCreatorInfo);
  const getState = useServerFn(getTikTokItemState);
  const publish = useServerFn(publishToTikTok);
  const setAuto = useServerFn(setTikTokAutoPublish);

  const conn = useQuery({
    queryKey: ["tiktok-connection-status", clientId],
    queryFn: () => getConnStatus({ data: { clientId } }),
    retry: false,
  });
  const connected = !!conn.data?.connected;

  const creator = useQuery({
    queryKey: ["tiktok-creator-info", clientId],
    queryFn: () => getCreator({ data: { clientId } }),
    enabled: connected,
    retry: false,
    staleTime: 60_000,
  });
  const state = useQuery({
    queryKey: ["tiktok-item-state", itemId],
    queryFn: () => getState({ data: { itemId } }),
    enabled: connected,
    retry: false,
  });

  const [form, setForm] = useState<TikTokPostSettings>(EMPTY);
  const [commercial, setCommercial] = useState(false);
  useEffect(() => {
    const s = state.data;
    if (!s) { setForm(EMPTY); setCommercial(false); return; }
    setForm({
      privacyLevel: (s.privacyLevel ?? undefined) as TikTokPostSettings["privacyLevel"],
      allowComment: s.allowComment, allowDuet: s.allowDuet, allowStitch: s.allowStitch,
      brandOrganic: s.brandOrganic, brandContent: s.brandContent,
    });
    setCommercial(s.brandOrganic || s.brandContent);
  }, [state.data, itemId]);

  // Privacidade salva que a conta não aceita mais (ex.: "Todos" antes da
  // aprovação do app): volta pra "Selecione…" em vez de reenviar um valor recusado.
  useEffect(() => {
    const opts = creator.data?.privacyOptions;
    if (opts && form.privacyLevel && !opts.includes(form.privacyLevel)) {
      setForm((f) => ({ ...f, privacyLevel: undefined as unknown as TikTokPostSettings["privacyLevel"] }));
    }
  }, [creator.data, form.privacyLevel]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["tiktok-item-state", itemId] });
  const publishMut = useMutation({
    mutationFn: () => publish({ data: { itemId, settings: form } }),
    onSuccess: (r: any) => {
      toast.success(
        (r?.processing ? "Vídeo enviado! O TikTok está processando." : "Publicado no TikTok!") +
        " Pode levar alguns minutos pra aparecer no perfil.",
      );
      refresh();
      qc.invalidateQueries({ queryKey: ["month"] });
    },
    onError: (e: any) => { toast.error(e?.message ?? "Falha ao publicar no TikTok"); refresh(); },
  });
  const autoMut = useMutation({
    mutationFn: (enabled: boolean) => setAuto({ data: { itemId, enabled, settings: enabled ? form : undefined } }),
    onSuccess: (_r, enabled) => { toast.success(enabled ? "Publicação programada!" : "Publicação programada cancelada."); refresh(); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao programar"),
  });

  // Tabela/credenciais indisponíveis (ex.: migration ainda não aplicada):
  // some sem quebrar o resto do detalhe do item.
  if (conn.isError) return null;
  if (conn.isLoading) return <div className="text-foreground/40 text-sm">Verificando…</div>;
  if (!connected) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button disabled title="Esse cliente ainda não conectou o TikTok — conecte na Ficha do Cliente"
          className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold opacity-40 cursor-not-allowed border border-foreground/8 text-foreground/60">
          <Music2 size={14} /> Publicar no TikTok agora
        </button>
      </div>
    );
  }

  const info = creator.data;
  const options = (info?.privacyOptions ?? []).filter((o) => o in PRIVACY_LABELS);
  const onlyPrivate = options.length > 0 && options.every((o) => o === "SELF_ONLY");
  const auto = !!state.data?.autoPublish;
  const published = !!state.data?.publishedAt;
  const processing = !!state.data?.publishId && !published;
  const brandOn = form.brandOrganic || form.brandContent;
  const privateBlocked = form.brandContent && form.privacyLevel === "SELF_ONLY";
  const canSend = !!form.privacyLevel && (!commercial || brandOn) && !privateBlocked;
  const busy = publishMut.isPending || autoMut.isPending;

  const patch = (p: Partial<TikTokPostSettings>) => setForm((f) => ({ ...f, ...p }));
  const check = "inline-flex items-center gap-2 text-sm text-foreground/80";

  return (
    <div className="space-y-3">
      <div className="text-[12px] text-foreground/60">
        {creator.isLoading ? "Consultando a conta do TikTok…" : info?.nickname ? <>Publicando como <b className="text-foreground">{info.nickname}</b></> : "Conta do TikTok conectada"}
        {info?.maxDurationSec ? <> · vídeo de até {Math.floor(info.maxDurationSec / 60)} min</> : null}
      </div>
      {creator.isError && (
        <p className="text-[11px] text-red-400">{(creator.error as any)?.message ?? "Não foi possível consultar o TikTok."}</p>
      )}

      <div>
        <label className="block text-[11px] uppercase tracking-wider text-foreground/50 mb-1">Título no TikTok</label>
        <div className="rounded-md border border-foreground/10 px-3 py-2 text-sm text-foreground/80 whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
          {caption?.trim() || <span className="text-foreground/40">Sem legenda — o vídeo vai sem título.</span>}
        </div>
        <p className="text-[11px] text-foreground/40 mt-1">É a Legenda do item: edite no campo "Legenda" desta tela antes de publicar (hashtags incluídas).</p>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-wider text-foreground/50 mb-1">Quem pode ver esse vídeo</label>
        <select
          value={form.privacyLevel ?? ""}
          onChange={(e) => patch({ privacyLevel: (e.target.value || undefined) as TikTokPostSettings["privacyLevel"] })}
          className="w-full rounded-md border border-foreground/10 bg-transparent px-3 py-2 text-sm"
        >
          <option value="">Selecione…</option>
          {options.map((o) => (
            <option key={o} value={o} disabled={o === "SELF_ONLY" && form.brandContent}
              title={o === "SELF_ONLY" && form.brandContent ? "A visibilidade de conteúdo de marca não pode ser privada (Branded content visibility cannot be set to private)" : undefined}>
              {PRIVACY_LABELS[o]}
            </option>
          ))}
        </select>
        {onlyPrivate && (
          <p className="text-[11px] text-foreground/40 mt-1">
            Enquanto o app não for aprovado pelo TikTok, os vídeos só podem ser publicados como privados.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <label className={check}>
          <input type="checkbox" checked={form.allowComment} disabled={info?.commentDisabled}
            onChange={(e) => patch({ allowComment: e.target.checked })} /> Permitir comentários
        </label>
        <label className={check}>
          <input type="checkbox" checked={form.allowDuet} disabled={info?.duetDisabled}
            onChange={(e) => patch({ allowDuet: e.target.checked })} /> Permitir Duetos
        </label>
        <label className={check}>
          <input type="checkbox" checked={form.allowStitch} disabled={info?.stitchDisabled}
            onChange={(e) => patch({ allowStitch: e.target.checked })} /> Permitir Stitch
        </label>
      </div>

      <div>
        <label className={check}>
          <input type="checkbox" checked={commercial}
            onChange={(e) => { setCommercial(e.target.checked); if (!e.target.checked) patch({ brandOrganic: false, brandContent: false }); }} />
          Esse vídeo promove uma marca, produto ou serviço
        </label>
        {commercial && (
          <div className="mt-2 ml-6 space-y-1.5">
            <label className={check}>
              <input type="checkbox" checked={form.brandOrganic} onChange={(e) => patch({ brandOrganic: e.target.checked })} />
              Minha própria marca (conteúdo orgânico)
            </label>
            <label className={check}>
              <input type="checkbox" checked={form.brandContent} onChange={(e) => patch({ brandContent: e.target.checked })} />
              Marca de terceiros (conteúdo de marca)
            </label>
            {!brandOn && (
              <p className="text-[11px] text-amber-400"
                title="You need to indicate if your content promotes yourself, a third party, or both">
                Indique se o vídeo promove você, um terceiro ou os dois pra continuar (You need to indicate if your content promotes yourself, a third party, or both).
              </p>
            )}
            {brandOn && (
              <p className="text-[11px] text-foreground/60">
                {form.brandContent
                  ? <>Seu vídeo será marcado como "Parceria paga" (Your video will be labeled as "Paid partnership").</>
                  : <>Seu vídeo será marcado como "Conteúdo promocional" (Your video will be labeled as "Promotional content").</>}
              </p>
            )}
            {privateBlocked && <p className="text-[11px] text-amber-400">Conteúdo de marca de terceiros não pode ser privado (Branded content visibility cannot be set to private).</p>}
          </div>
        )}
      </div>

      <p className="text-[11px] text-foreground/40">
        {form.brandContent ? (
          <>
            Ao publicar, você concorda com a{" "}
            <a className="underline" href="https://www.tiktok.com/legal/page/global/bc-policy/pt-BR" target="_blank" rel="noreferrer">Política de Conteúdo de Marca</a>{" "}
            e a{" "}
            <a className="underline" href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/pt-BR" target="_blank" rel="noreferrer">Confirmação de Uso de Música</a>{" "}
            do TikTok. (By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation.)
          </>
        ) : (
          <>
            Ao publicar, você concorda com a{" "}
            <a className="underline" href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/pt-BR" target="_blank" rel="noreferrer">Confirmação de Uso de Música</a>{" "}
            do TikTok. (By posting, you agree to TikTok's Music Usage Confirmation.)
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={async () => {
            if (!(await requestConfirm("Publicar esse vídeo na conta do TikTok do cliente agora? Isso é uma ação real."))) return;
            publishMut.mutate();
          }}
          disabled={busy || !canSend || published}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold disabled:opacity-50"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          {publishMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Music2 size={14} />}
          Publicar no TikTok agora
        </button>
        {auto ? (
          <button onClick={() => autoMut.mutate(false)} disabled={busy}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold border border-foreground/8 text-foreground/70 hover:text-foreground disabled:opacity-50">
            <Clock size={14} /> Cancelar programação
          </button>
        ) : (
          <button onClick={() => autoMut.mutate(true)} disabled={busy || !canSend || !scheduledAt || published}
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
      {published && <p className="text-[11px]" style={{ color: "var(--lz-accent-ink)" }}>Publicado no TikTok.</p>}
      {(processing || published) && (
        <p className="text-[11px] text-foreground/50">
          Pode levar alguns minutos pro vídeo ser processado e aparecer no perfil (It may take a few minutes for the content to process and be visible on the profile).
        </p>
      )}
      {state.data?.lastError && !published && <p className="text-[11px] text-red-400">Último erro: {state.data.lastError}</p>}
      <p className="text-[11px] text-foreground/40">
        Envia o primeiro vídeo anexado ao item e marca como Finalizado. "Programar" usa a data e horário de "Data de publicação".
      </p>
    </div>
  );
}
