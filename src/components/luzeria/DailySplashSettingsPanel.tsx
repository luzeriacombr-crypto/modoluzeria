import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Music, Play } from "lucide-react";
import { appSettingsQO, useApi } from "@/lib/luzeria/queries";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { supabase } from "@/integrations/supabase/client";
import { DailySplash } from "./DailySplash";

const MAX_SOUND_BYTES = 2 * 1024 * 1024; // 2MB — é um efeito de ~2s, não precisa de mais
const DEFAULT_DURATION_MS = 1700;

/** Controle da splash diária (DailySplash.tsx) — só a Luzeria mexe aqui,
 * porque a splash usa a logo do Modo Criador (não a de cada agência), então
 * é a mesma pra todo mundo. Pedido do Junior: trocar o som, ajustar a
 * velocidade e conseguir ver o resultado sem esperar o dia seguinte. */
export function DailySplashSettingsPanel() {
  const { data: settings } = useQuery(appSettingsQO());
  const { updateAppSettings } = useApi();
  const [uploading, setUploading] = useState(false);
  const [durationMs, setDurationMs] = useState(settings?.dailySplashDurationMs ?? DEFAULT_DURATION_MS);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (settings?.dailySplashDurationMs != null) setDurationMs(settings.dailySplashDurationMs);
  }, [settings?.dailySplashDurationMs]);

  async function pickSound(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("audio/") && !file.name.toLowerCase().endsWith(".mp3")) {
      toast.error("Escolha um arquivo de áudio (mp3).");
      return;
    }
    if (file.size > MAX_SOUND_BYTES) { toast.error("Áudio muito grande (máximo 2 MB) — é só um efeito de ~2s."); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
      const path = `platform/daily-splash-sound-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        contentType: file.type || "audio/mpeg", upsert: true,
      });
      if (upErr) throw upErr;
      await updateAppSettings.mutateAsync({ data: { dailySplashSoundPath: path } });
      toast.success("Som da splash atualizado.");
    } catch (err: any) {
      toastFriendlyError(err, "Erro ao enviar o áudio.");
    } finally {
      setUploading(false);
    }
  }

  function restoreDefaultSound() {
    updateAppSettings.mutate({ data: { dailySplashSoundPath: null } }, {
      onSuccess: () => toast.success("Voltou pro som padrão."),
      onError: (e: any) => toastFriendlyError(e, "Erro ao restaurar"),
    });
  }

  function saveDuration() {
    updateAppSettings.mutate({ data: { dailySplashDurationMs: durationMs } }, {
      onSuccess: () => toast.success("Duração da splash salva."),
      onError: (e: any) => toastFriendlyError(e, "Erro ao salvar"),
    });
  }

  const durationChanged = durationMs !== (settings?.dailySplashDurationMs ?? DEFAULT_DURATION_MS);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Music size={16} className="text-[var(--lz-accent-ink)]" />
        <h2 className="text-foreground font-semibold">Splash diária (som + animação)</h2>
        <button onClick={() => setPreviewing(true)}
          className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground/50 hover:text-foreground transition">
          <Play size={12} /> Visualizar
        </button>
      </div>
      <p className="text-foreground/40 text-xs leading-relaxed -mt-2">
        Toca 1x por dia por aparelho, na primeira vez que alguém abre o Modo Criador — a animação usa a logo do
        Modo Criador (não a de cada agência), então essas configurações valem pra todo mundo.
      </p>

      <div className="bg-card border border-foreground/7 rounded-xl p-4 space-y-3">
        <div className="text-[11px] uppercase tracking-wide text-foreground/40 font-semibold">Som</div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="lz-btn-ghost text-xs px-4 py-2 rounded-md cursor-pointer disabled:opacity-50">
            {uploading ? "Enviando…" : "Enviar novo som"}
            <input type="file" accept="audio/*,.mp3" className="hidden" onChange={pickSound} disabled={uploading} />
          </label>
          {settings?.dailySplashSoundUrl && (
            <button onClick={restoreDefaultSound} disabled={updateAppSettings.isPending}
              className="text-[11px] text-foreground/50 hover:text-foreground transition disabled:opacity-50">
              Restaurar som padrão
            </button>
          )}
        </div>
        <p className="text-[10.5px] text-foreground/35">
          {settings?.dailySplashSoundUrl ? "Som personalizado ativo." : "Usando o som padrão embutido no app."} Mp3, até 2 MB.
        </p>
      </div>

      <div className="bg-card border border-foreground/7 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wide text-foreground/40 font-semibold">Velocidade</div>
          <span className="text-[11px] text-foreground/40 tabular-nums">{(durationMs / 1000).toFixed(1)}s</span>
        </div>
        <input
          type="range" min={800} max={4000} step={100} value={durationMs}
          onChange={(e) => setDurationMs(parseInt(e.target.value, 10))}
          className="w-full accent-[rgb(var(--lz-brand-rgb))]"
        />
        <div className="flex items-center justify-between text-[10px] text-foreground/30">
          <span>Rápida</span>
          <span>Lenta</span>
        </div>
        {durationChanged && (
          <div className="flex items-center gap-2">
            <button onClick={saveDuration} disabled={updateAppSettings.isPending}
              className="lz-btn-primary text-xs px-4 py-2 rounded-md disabled:opacity-50">
              {updateAppSettings.isPending ? "Salvando…" : "Salvar velocidade"}
            </button>
            <button onClick={() => setDurationMs(settings?.dailySplashDurationMs ?? DEFAULT_DURATION_MS)}
              className="text-[11px] text-foreground/50 hover:text-foreground transition">
              Cancelar
            </button>
          </div>
        )}
      </div>

      {previewing && (
        <DailySplash
          onDone={() => setPreviewing(false)}
          soundUrl={settings?.dailySplashSoundUrl ?? undefined}
          durationMs={durationMs}
        />
      )}
    </div>
  );
}
