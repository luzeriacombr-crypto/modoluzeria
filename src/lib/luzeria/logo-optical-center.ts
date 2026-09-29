// Centralização óptica de logo (usado na Sidebar, div do topo): a maioria
// das artes de logo enviadas pelas agências não tem o "centro de massa"
// visual exatamente no meio do canvas do PNG — algum elemento (ícone, traço
// decorativo etc.) pode pesar mais pra um lado. Se a gente só estica a
// imagem inteira (w-full) com padding simétrico, a logo pode PARECER
// desalinhada mesmo com margens matematicamente iguais dos dois lados.
//
// Aqui calculamos o centro de massa real da arte (peso = canal alfa de
// cada pixel) e posicionamos a logo pra esse centro cair exatamente no
// meio do espaço disponível — ao invés de simplesmente esticar a imagem
// de borda a borda. Funciona pra qualquer logo (não é específico de
// nenhuma agência), com fallback simétrico simples se o cálculo falhar
// (rede, CORS etc.) ou enquanto ele ainda não terminou.
import { useEffect, useState } from "react";

export type OpticalBox = { width: number; marginLeft: number };

const cache = new Map<string, OpticalBox>();
const inflight = new Map<string, Promise<OpticalBox>>();

function symmetricFallback(containerWidth: number, minMargin: number): OpticalBox {
  return { width: Math.max(0, containerWidth - minMargin * 2), marginLeft: minMargin };
}

async function computeOpticalBox(url: string, containerWidth: number, minMargin: number, maxHeight: number): Promise<OpticalBox> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Falha ao buscar a logo");
  const blob = await resp.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const W = canvas.width;
  const H = canvas.height;

  let sumX = 0;
  let totalAlpha = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = data[(y * W + x) * 4 + 3] / 255;
      if (a === 0) continue;
      sumX += x * a;
      totalAlpha += a;
    }
  }
  if (totalAlpha === 0) return symmetricFallback(containerWidth, minMargin);

  const centroidX = sumX / totalAlpha;
  const center = containerWidth / 2;

  // Maior largura possível que ainda deixa >= minMargin dos dois lados,
  // respeitando a posição real do centro de massa (não o centro geométrico
  // da imagem) — os dois lados podem exigir larguras máximas diferentes,
  // usamos o menor dos dois (o lado mais "apertado" manda).
  const boundLeft = centroidX > 0 ? ((center - minMargin) * W) / centroidX : Infinity;
  const boundRight = W - centroidX > 0 ? ((center - minMargin) * W) / (W - centroidX) : Infinity;
  let width = Math.max(0, Math.min(boundLeft, boundRight, containerWidth - minMargin * 2));

  // Rede de segurança: uma logo quadrada é bem-vinda (fica grande de
  // propósito, ver comentário na Sidebar), mas algumas agências sobem um
  // arquivo tipo template de Stories (retrato, ex: 1080×1920) como "logo" —
  // sem esse teto, a altura calculada a partir da largura ficaria enorme
  // (centenas de px) e quebraria o layout da sidebar. Com o teto, o lado
  // que manda passa a ser a altura: a largura é recalculada a partir dele,
  // e a margem também precisa ser recalculada (largura menor = mais folga).
  const height = width * (H / W);
  if (height > maxHeight) {
    width = maxHeight * (W / H);
  }

  const scale = width / W;
  const marginLeft = center - centroidX * scale;

  return { width, marginLeft: Math.max(minMargin, marginLeft) };
}

/** `url` já deve ser a URL final (assinada) da logo. A parte antes de "?" é
 * usada como chave de cache — URLs assinadas trocam o token a cada
 * re-fetch, mas o arquivo (e portanto o cálculo) continua o mesmo. */
export function useLogoOpticalBox(url: string | null | undefined, containerWidth: number, minMargin: number, maxHeight: number): OpticalBox {
  const key = url ? url.split("?")[0] : null;
  const fallback = symmetricFallback(containerWidth, minMargin);
  const [box, setBox] = useState<OpticalBox>(() => (key && cache.has(key) ? cache.get(key)! : fallback));

  useEffect(() => {
    if (!url || !key) return;
    const cached = cache.get(key);
    if (cached) { setBox(cached); return; }
    let cancelled = false;
    const promise = inflight.get(key) ?? computeOpticalBox(url, containerWidth, minMargin, maxHeight)
      .catch(() => symmetricFallback(containerWidth, minMargin))
      .then((result) => { cache.set(key, result); inflight.delete(key); return result; });
    inflight.set(key, promise);
    promise.then((result) => { if (!cancelled) setBox(result); });
    return () => { cancelled = true; };
  }, [url, key, containerWidth, minMargin, maxHeight]);

  return key ? box : fallback;
}
