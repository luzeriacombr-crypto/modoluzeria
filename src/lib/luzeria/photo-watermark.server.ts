import sharp from "sharp";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { WATERMARK_FONT_BASE64 } from "./watermark-font-data";

/** Preview, não entrega final — reduz o peso e o tempo de composição sem
 * prejudicar a decisão do cliente na hora de escolher. Usado pra capa e
 * pra visualização em tela cheia (lightbox) — não pra grade, que usa
 * GRID_THUMB_MAX_DIMENSION, bem menor. */
const PREVIEW_MAX_DIMENSION = 1280;

/** Miniatura da grade — é a imagem que carrega logo de cara, uma por foto
 * da galeria inteira (60+ em ensaios grandes), então precisa ser leve, mas
 * não a ponto de ficar borrada em tela retina (a grade mostra até ~300px
 * de largura em CSS, que em tela 2x já pede ~600px de pixels reais).
 * A foto em tamanho real só é buscada quando o cliente abre o lightbox
 * (ver getPublicPhotoThumbnails com size: "full"). */
export const GRID_THUMB_MAX_DIMENSION = 640;

/** mozjpeg dá uma compressão bem melhor que o encoder padrão pro mesmo
 * "quality" — menos artefato visível pro mesmo peso de arquivo. */
const JPEG_OPTS = { quality: 88, mozjpeg: true } as const;

const WATERMARK_FONT_FAMILY = "LZWatermarkFont";
let fontRegistered = false;

/** sharp não renderiza texto de forma confiável (depende de fontconfig do
 * host, que a Vercel não tem por padrão) — por isso o texto da marca
 * d'água usa @napi-rs/canvas com uma fonte embutida em base64
 * (watermark-font-data.ts), nunca uma fonte do sistema. Registrada uma
 * única vez por processo. */
function ensureFontRegistered() {
  if (fontRegistered) return;
  GlobalFonts.register(Buffer.from(WATERMARK_FONT_BASE64, "base64"), WATERMARK_FONT_FAMILY);
  fontRegistered = true;
}

export type WatermarkSpec =
  | { mode: "none" }
  | { mode: "image"; buffer: Buffer }
  | { mode: "text"; text: string; opacity: number; density: "baixa" | "media" | "alta" };

const TEXT_DENSITY_GAP: Record<string, number> = { baixa: 1.7, media: 1.15, alta: 0.75 };

function clampOpacity(opacity: number): number {
  return Math.min(90, Math.max(5, opacity)) / 100;
}

/** Desenha a camada inteira da marca d'água num canvas do MESMO tamanho da
 * foto — o texto se repete numa grade rotacionada (com uma margem extra
 * pras pontas continuarem cobertas depois de girar). Bem mais simples e
 * previsível que girar e depois tentar recortar/ladrilhar uma faixa. */
async function buildTextWatermarkLayer(
  text: string, opacity: number, density: "baixa" | "media" | "alta", width: number, height: number,
): Promise<Buffer> {
  ensureFontRegistered();
  const clean = (text || "REPRODUÇÃO PROIBIDA").trim().toUpperCase().slice(0, 60) || "REPRODUÇÃO PROIBIDA";
  const fontSize = Math.max(14, Math.round(width / 18));

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.font = `${fontSize}px "${WATERMARK_FONT_FAMILY}"`;
  ctx.fillStyle = `rgba(255,255,255,${clampOpacity(opacity)})`;
  ctx.textBaseline = "middle";
  const textWidth = ctx.measureText(clean).width;

  const gap = TEXT_DENSITY_GAP[density] ?? 1.4;
  const stepX = Math.max(40, Math.round((textWidth + fontSize * 3) * gap));
  const stepY = Math.max(30, Math.round(fontSize * 3 * gap));

  ctx.translate(width / 2, height / 2);
  ctx.rotate((-25 * Math.PI) / 180);
  ctx.translate(-width / 2, -height / 2);

  const margin = Math.round(Math.max(width, height) * 0.75);
  for (let y = -margin; y < height + margin; y += stepY) {
    for (let x = -margin; x < width + margin; x += stepX) {
      ctx.fillText(clean, x, y);
    }
  }

  return canvas.encode("png");
}

/** Recebe os bytes originais de uma foto e devolve com a marca d'água já
 * queimada nos pixels, conforme `watermark` — não é overlay de CSS: o
 * arquivo que sai daqui é o único que o navegador do cliente final chega a
 * ver. `mode: "none"` só redimensiona pro tamanho de preview. */
export async function protectPhotoBytes(
  imageBuf: Buffer,
  watermark: WatermarkSpec,
  maxDim: number = PREVIEW_MAX_DIMENSION,
): Promise<Buffer> {
  const resized = await sharp(imageBuf)
    .rotate()
    .resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });

  if (watermark.mode === "none") {
    return sharp(resized.data).jpeg(JPEG_OPTS).toBuffer();
  }

  const { width = maxDim, height = maxDim } = resized.info;

  if (watermark.mode === "text") {
    const layer = await buildTextWatermarkLayer(watermark.text, watermark.opacity, watermark.density, width, height);
    return sharp(resized.data).composite([{ input: layer, left: 0, top: 0 }]).jpeg(JPEG_OPTS).toBuffer();
  }

  // mode: "image" — grade de repetições pequenas do PNG enviado pela agência.
  const tileWidth = Math.max(60, Math.round(width * 0.24));
  const rotatedTile = await sharp(watermark.buffer)
    .resize({ width: tileWidth })
    .rotate(-25, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const tileMeta = await sharp(rotatedTile).metadata();
  const tileW = tileMeta.width ?? tileWidth;
  const tileH = tileMeta.height ?? tileWidth;
  const stepX = Math.round(tileW * 1.6);
  const stepY = Math.round(tileH * 1.6);

  const composites: { input: Buffer; left: number; top: number }[] = [];
  for (let y = -tileH; y < height + tileH; y += stepY) {
    for (let x = -tileW; x < width + tileW; x += stepX) {
      composites.push({ input: rotatedTile, left: x, top: y });
    }
  }
  return sharp(resized.data).composite(composites).jpeg(JPEG_OPTS).toBuffer();
}

/** Fundo neutro pra pré-visualizar a marca d'água nas Configurações, sem
 * precisar de uma foto real. */
export async function buildPreviewBackground(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width, height, channels: 3,
      background: { r: 70, g: 90, b: 110 },
    },
  }).jpeg().toBuffer();
}
