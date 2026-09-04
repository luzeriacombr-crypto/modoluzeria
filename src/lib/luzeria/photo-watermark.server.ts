import sharp from "sharp";

/** Preview, não entrega final — reduz o peso e o tempo de composição sem
 * prejudicar a decisão do cliente na hora de escolher. */
const PREVIEW_MAX_DIMENSION = 1600;

/** Recebe os bytes originais de uma foto e, se `watermarkBuf` for
 * informado, devolve a mesma foto com a marca d'água da agência
 * repetida na diagonal, já queimada nos pixels (não é overlay de CSS —
 * o arquivo que sai daqui é o único que o navegador do cliente final
 * chega a ver). Sem marca d'água configurada, só redimensiona pro
 * tamanho de preview e devolve. */
export async function protectPhotoBytes(imageBuf: Buffer, watermarkBuf: Buffer | null): Promise<Buffer> {
  const resized = await sharp(imageBuf)
    .rotate()
    .resize({ width: PREVIEW_MAX_DIMENSION, height: PREVIEW_MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });

  if (!watermarkBuf) {
    return sharp(resized.data).jpeg({ quality: 82 }).toBuffer();
  }

  const { width = PREVIEW_MAX_DIMENSION, height = PREVIEW_MAX_DIMENSION } = resized.info;

  // Marca d'água em ~24% da largura da foto, girada, repetida cobrindo
  // toda a área (com margem negativa pra não deixar canto sem cobertura
  // depois da rotação).
  const tileWidth = Math.max(60, Math.round(width * 0.24));
  const rotatedTile = await sharp(watermarkBuf)
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

  return sharp(resized.data)
    .composite(composites)
    .jpeg({ quality: 82 })
    .toBuffer();
}
