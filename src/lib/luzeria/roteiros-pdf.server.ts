/** Gera o PDF de exportação de Roteiros — mockup aprovado pelo Junior
 * (claude.ai/artifact/N1Vhikuq6VwWq2JM4WkGYY, revisado depois num feedback
 * ao vivo no PDF real): logo da agência, nome do cliente e mês no topo, e
 * cada roteiro só com numerozinho + título + corpo — sem repetir "Roteiro
 * N" (já é o número do card) nem etiqueta de formato (Junior achou
 * redundante). Só roda no servidor (pdf-lib). */
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

export type RoteiroPdfItem = {
  title: string;
  body: string;
  contentType: "post" | "reel";
};

export type RoteirosPdfInput = {
  clientName: string;
  /** Mês do documento (ex.: "Outubro 2026") — null quando o doc não tem
   * mês associado (ex.: roteiros colados manualmente, sem vir da prévia de
   * planejamento). */
  monthLabel: string | null;
  orgName: string;
  totalCount: number;
  filterLabel: string | null;
  /** Logo da agência pra fundo branco (PNG/JPEG/SVG não — só raster). */
  logoBytes?: Uint8Array | null;
  items: RoteiroPdfItem[];
};

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;
const SIZE = 10.5;
const LEADING = 15.5;

// Cores da marca (mesmo mockup): tinta quase-preta e o verde-limão da Luzeria.
const INK: [number, number, number] = [0.09, 0.094, 0.102];
const INK_SOFT: [number, number, number] = [0.227, 0.235, 0.247];
const GRAY: [number, number, number] = [0.541, 0.553, 0.569];

// A fonte padrão (Helvetica/WinAnsi) só desenha Latin-1 — qualquer coisa
// acima disso (emoji, símbolos como ✨) quebra o pdf-lib inteiro na hora de
// desenhar, e os roteiros gerados por IA usam emoji ocasional de propósito
// (parte do tom de casa). Tira só isso, mantém acentuação normal (á é í ó ú
// ã õ ç ñ etc. são todos ≤ 0xFF, então sobrevivem).
function sanitizeForPdf(text: string): string {
  return text.replace(/[\u{100}-\u{10FFFF}]/gu, "").replace(/[ \t]{2,}/g, " ").trim();
}

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

export async function renderRoteirosPdf(input: RoteirosPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);

  let logoImg: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  if (input.logoBytes && input.logoBytes.length > 0) {
    try { logoImg = await doc.embedPng(input.logoBytes); }
    catch { try { logoImg = await doc.embedJpg(input.logoBytes); } catch { logoImg = null; } }
  }

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => { page = doc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN; };
  const ensureSpace = (h: number) => { if (y - h < MARGIN) newPage(); };

  // Papel timbrado só na primeira página: logo da agência.
  if (logoImg) {
    const HEADER_LOGO_MAX_W = 150, HEADER_LOGO_MAX_H = 26;
    const scale = Math.min(HEADER_LOGO_MAX_W / logoImg.width, HEADER_LOGO_MAX_H / logoImg.height, 1);
    const w = logoImg.width * scale, h = logoImg.height * scale;
    page.drawImage(logoImg, { x: MARGIN, y: y - h, width: w, height: h });
    y -= h + 18;
  }
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 1, color: rgb(0.906, 0.898, 0.878) });
  y -= 22;

  function layoutLine(raw: string, opts: {
    size?: number; forceBold?: boolean; italic?: boolean; color?: [number, number, number]; gapAfter?: number;
  } = {}) {
    const size = opts.size ?? SIZE;
    const tokens = tokenize(sanitizeForPdf(raw)).map((t) => ({ ...t, bold: t.bold || !!opts.forceBold }));
    if (tokens.length === 0) { y -= LEADING * 0.55; return; }
    const color = rgb(...(opts.color ?? INK_SOFT));
    const spaceW = fontRegular.widthOfTextAtSize(" ", size);
    const fontFor = (bold: boolean) => (opts.italic ? fontItalic : bold ? fontBold : fontRegular);
    const widthOf = (t: Token) => fontFor(t.bold).widthOfTextAtSize(t.text, size);

    let current: Token[] = [];
    let currentW = 0;
    const flush = () => {
      if (!current.length) return;
      ensureSpace(LEADING);
      let x = MARGIN;
      let i = 0;
      while (i < current.length) {
        const bold = current[i].bold;
        let j = i;
        const words: string[] = [];
        while (j < current.length && current[j].bold === bold) { words.push(current[j].text); j++; }
        const runText = words.join(" ");
        const font: PDFFont = fontFor(bold);
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
    if (opts.gapAfter) y -= opts.gapAfter;
  }

  // Cabeçalho: "ROTEIROS" → nome do cliente → mês + contagem.
  layoutLine(input.filterLabel ? `ROTEIROS · ${input.filterLabel.toUpperCase()}` : "ROTEIROS", {
    size: 9, forceBold: true, color: [0.42, 0.44, 0.102], gapAfter: 6,
  });
  layoutLine(input.clientName, { size: 19, forceBold: true, color: INK, gapAfter: 4 });
  const countLabel = input.filterLabel
    ? `${input.items.length} de ${input.totalCount} roteiros (${input.filterLabel.toLowerCase()})`
    : `${input.items.length} roteiro${input.items.length === 1 ? "" : "s"}`;
  const monthPart = input.monthLabel ? `${input.monthLabel} · ` : "";
  layoutLine(`${monthPart}${countLabel} · ${input.orgName}`, { size: 9.5, color: GRAY, gapAfter: 4 });

  ensureSpace(4);
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 1.5, color: rgb(...INK) });
  y -= 26;

  input.items.forEach((item, i) => {
    ensureSpace(60);
    const kicker = `ROTEIRO ${String(i + 1).padStart(2, "0")}`;

    const kickerSize = 9.5;
    page.drawText(kicker, { x: MARGIN, y, size: kickerSize, font: fontBold, color: rgb(...INK) });
    y -= LEADING + 4;

    layoutLine(item.title, { size: 13.5, forceBold: true, color: INK, gapAfter: 3 });

    for (const para of item.body.split(/\n{2,}/)) {
      const lines = para.split("\n").filter((l) => l.trim());
      for (const l of lines) layoutLine(l.trim());
      y -= 5;
    }

    y -= 8;
    if (i < input.items.length - 1) {
      ensureSpace(20);
      page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 0.75, color: rgb(0.929, 0.922, 0.902) });
      y -= 22;
    }
  });

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = sanitizeForPdf(`${input.orgName} · Página ${i + 1} de ${pages.length}`);
    const w = fontRegular.widthOfTextAtSize(label, 8);
    p.drawText(label, { x: (PAGE_W - w) / 2, y: 28, size: 8, font: fontRegular, color: rgb(...GRAY) });
  });

  return doc.save();
}
