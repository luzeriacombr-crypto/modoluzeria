/** Gera o PDF do contrato assinado — texto do contrato (com um markdown bem
 * simples: `**negrito**` e `### Título de cláusula`) + bloco de assinatura
 * eletrônica no final, com a imagem desenhada pelo cliente. Só roda no
 * servidor (pdf-lib + Buffer). */
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

export type ContractPdfInput = {
  contractText: string;
  clientName: string;
  orgName: string;
  signerName: string;
  signerCpf: string;
  signatureDataUrl: string;
  signedAt: string;
};

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;
const SIZE = 10.5;
const LEADING = 15;

type Token = { text: string; bold: boolean };

function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  let bold = false;
  let buf = "";
  let i = 0;
  const pushBuf = () => {
    if (buf.length) for (const t of buf.split(/\s+/).filter(Boolean)) tokens.push({ text: t, bold });
    buf = "";
  };
  while (i < line.length) {
    if (line.startsWith("**", i)) { pushBuf(); bold = !bold; i += 2; continue; }
    buf += line[i];
    i++;
  }
  pushBuf();
  return tokens;
}

function formatDateTimePt(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export async function renderContractPdf(input: ContractPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => { page = doc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN; };
  const ensureSpace = (h: number) => { if (y - h < MARGIN) newPage(); };

  function layoutLine(raw: string, opts: { size?: number; forceBold?: boolean; center?: boolean; color?: [number, number, number] } = {}) {
    const size = opts.size ?? SIZE;
    const tokens = tokenize(raw).map((t) => ({ ...t, bold: t.bold || !!opts.forceBold }));
    if (tokens.length === 0) { y -= LEADING * 0.55; return; }
    const color = rgb(...(opts.color ?? [0.1, 0.1, 0.1]));
    const spaceW = fontRegular.widthOfTextAtSize(" ", size);
    const widthOf = (t: Token) => (t.bold ? fontBold : fontRegular).widthOfTextAtSize(t.text, size);

    let current: Token[] = [];
    let currentW = 0;
    const flush = () => {
      if (!current.length) return;
      ensureSpace(LEADING);
      let x = MARGIN;
      if (opts.center) x = MARGIN + (CONTENT_W - currentW) / 2;
      // Agrupa em blocos de palavras consecutivas com o mesmo estilo e
      // desenha cada bloco numa só chamada, com espaço de verdade no meio
      // (em vez de 1 drawText por palavra) — deixa o texto selecionável/
      // copiável do jeito certo no PDF final.
      let i = 0;
      while (i < current.length) {
        const bold = current[i].bold;
        let j = i;
        const words: string[] = [];
        while (j < current.length && current[j].bold === bold) { words.push(current[j].text); j++; }
        const runText = words.join(" ");
        const font: PDFFont = bold ? fontBold : fontRegular;
        page.drawText(runText, { x, y, size, font, color });
        x += font.widthOfTextAtSize(runText, size) + (j < current.length ? spaceW : 0);
        i = j;
      }
      y -= LEADING;
      current = []; currentW = 0;
    };
    for (const t of tokens) {
      const w = widthOf(t);
      const addW = current.length === 0 ? w : spaceW + w;
      if (currentW + addW > CONTENT_W && current.length > 0) { flush(); current.push(t); currentW = w; }
      else { current.push(t); currentW += addW; }
    }
    flush();
  }

  const lines = input.contractText.split("\n");
  lines.forEach((raw, idx) => {
    const trimmed = raw.trim();
    if (trimmed === "") { layoutLine(""); return; }
    const heading = trimmed.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      y -= 4;
      layoutLine(heading[1], { size: SIZE + 1, forceBold: true });
      y -= 2;
      return;
    }
    if (idx === 0) {
      layoutLine(trimmed, { size: SIZE + 4, center: true });
      y -= 6;
      return;
    }
    layoutLine(trimmed);
  });

  // Bloco de assinatura eletrônica
  ensureSpace(230);
  y -= 14;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 0.75, color: rgb(0.75, 0.75, 0.75) });
  y -= 22;
  layoutLine("Assinatura eletrônica", { size: SIZE + 1, forceBold: true });
  y -= 4;
  layoutLine(`Assinado por: ${input.signerName}`);
  layoutLine(`CPF: ${input.signerCpf}`);
  layoutLine(`Data: ${formatDateTimePt(input.signedAt)}`);
  y -= 8;

  try {
    const base64 = input.signatureDataUrl.split(",")[1] ?? "";
    const bytes = Buffer.from(base64, "base64");
    const png = await doc.embedPng(bytes);
    const targetW = 180;
    const scale = targetW / png.width;
    const targetH = png.height * scale;
    ensureSpace(targetH + 10);
    page.drawImage(png, { x: MARGIN, y: y - targetH, width: targetW, height: targetH });
    y -= targetH + 10;
  } catch {
    /* imagem da assinatura não decodificou — segue só com nome/CPF/data acima */
  }

  layoutLine(
    `Este documento foi assinado eletronicamente pelo(a) responsável indicado(a) acima, através do Modo Criador, ` +
    `em nome de ${input.orgName}, referente ao cliente ${input.clientName}.`,
    { size: SIZE - 2, color: [0.45, 0.45, 0.45] },
  );

  return doc.save();
}
