/** Limites de tamanho de vídeo da Meta pra publicação pela API — usado no
 * servidor (barra antes de tentar publicar) e no painel do item (avisa assim
 * que o item fica "Pronto para publicar"). Acima disso o Instagram só devolve
 * um "ERROR" genérico depois de processar, sem dizer o motivo.
 * Fonte: especificações de Reels (300 MB) e Stories (100 MB) na referência
 * de IG User Media. Vídeo de carrossel não tem limite documentado — usa o
 * mesmo do Reel pra não barrar à toa. */
const MB = 1024 * 1024;

export function videoSizeLimitMb(itemType: string): number {
  return itemType === "story" ? 100 : 300;
}

export function videoSizeProblem(
  itemType: string,
  files: { mimeType: string | null; sizeBytes: number | null }[],
): string | null {
  const limitMb = videoSizeLimitMb(itemType);
  const biggest = files
    .filter((f) => (f.mimeType ?? "").startsWith("video/") && (f.sizeBytes ?? 0) > limitMb * MB)
    .sort((a, b) => (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0))[0];
  if (!biggest) return null;
  const sizeMb = Math.ceil((biggest.sizeBytes ?? 0) / MB);
  const where = itemType === "story" ? "Stories" : itemType === "reel" ? "Reels" : "posts";
  return `O vídeo tem ${sizeMb} MB e o Instagram só aceita até ${limitMb} MB em ${where}. Comprima o vídeo (MP4 H.264) e anexe de novo antes de publicar.`;
}

/** Duração aceita pela API (mesma referência): Story de 3 s a 60 s, Reel de
 * 3 s a 15 min. Vídeo de carrossel não tem limite documentado — não checa.
 * A duração vem do próprio Google Drive (videoMediaMetadata); quando o Drive
 * ainda não processou o vídeo, vem null e simplesmente não checa. */
export function videoDurationProblem(itemType: string, durationsMs: (number | null)[]): string | null {
  if (itemType !== "story" && itemType !== "reel") return null;
  const maxS = itemType === "story" ? 60 : 15 * 60;
  const where = itemType === "story" ? "Stories" : "Reels";
  const fmt = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}` : `${s} s`);
  for (const ms of durationsMs) {
    if (ms == null) continue;
    const s = Math.round(ms / 1000);
    if (s > maxS) return `O vídeo tem ${fmt(s)} e o Instagram só aceita até ${fmt(maxS)} em ${where} publicados pelo Modo Criador. Corte o vídeo e anexe de novo antes de publicar.`;
    if (ms < 3000) return `O vídeo tem menos de 3 segundos, o mínimo que o Instagram aceita em ${where}. Troque o vídeo antes de publicar.`;
  }
  return null;
}
