/** Gera o PDF de um Orçamento — plano aprovado:
 * claude.ai/artifact/41X9c5BsGyRCCDYvMckid1. Duas versões:
 * "simples" (uma página: itens + total, com a marca da agência) e
 * "completo" (capa → introdução → entregas por frente → investimento →
 * contracapa, no molde do modelo de proposta da Luzeria). Mesma base de
 * roteiros-pdf.server.ts/contract-pdf.server.ts/insights-pdf.server.ts
 * (pdf-lib puro, sem headless browser). Cores (degradê/destaque) começam
 * com a marca da agência mas são editáveis por orçamento — por isso vêm
 * como parâmetro, não fixas no código. */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;

type RGB = [number, number, number];

export type BudgetPdfItem = { label: string; description: string | null; priceCents: number };
export type BudgetPdfFront = { title: string; items: { title: string; description: string | null }[] };

export type BudgetPdfInput = {
  version: "simples" | "completo";
  clientName: string;
  clientSegment: string | null;
  items: BudgetPdfItem[];
  totalCents: number;
  logoBytes: Uint8Array | null;
  headerBytes: Uint8Array | null;
  footerText: string | null;
  gradientFrom: string;
  gradientTo: string;
  accentColor: string;
  coverPhrase: string | null;
  introTitle: string | null;
  introText: string | null;
  fronts: BudgetPdfFront[];
  paymentTerms: string | null;
  cronograma: string | null;
  notIncluded: string | null;
  afterApproval: string | null;
  backPhrase: string | null;
};

function sanitizeForPdf(text: string): string {
  return text.replace(/[\u{100}-\u{10FFFF}]/gu, "").replace(/[ \t]{2,}/g, " ").trim();
}

function hexToRgb01(hex: string | null | undefined, fallback: RGB): RGB {
  const m = hex ? /^#([0-9a-fA-F]{6})$/.exec(hex.trim()) : null;
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

/** Degradê vertical — pdf-lib não tem fill de gradiente nativo, então
 * desenha em tiras horizontais finas interpolando a cor (técnica padrão
 * pra "gradiente" em PDF gerado programaticamente). */
function drawVerticalGradient(page: PDFPage, x: number, y: number, w: number, h: number, from: RGB, to: RGB) {
  const steps = 48;
  const stripH = h / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const color = rgb(lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t));
    page.drawRectangle({ x, y: y + h - (i + 1) * stripH - 0.5, width: w, height: stripH + 1, color });
  }
}

async function embedImage(doc: PDFDocument, bytes: Uint8Array | null) {
  if (!bytes || bytes.length === 0) return null;
  try { return await doc.embedPng(bytes); } catch { /* tenta jpg abaixo */ }
  try { return await doc.embedJpg(bytes); } catch { return null; }
}

/** Quebra um texto em linhas que cabem em `maxW`, sem negrito/token — os
 * campos de orçamento são texto corrido simples, ao contrário do corpo dos
 * roteiros (que usa **negrito**). */
function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const lines: string[] = [];
  for (const paragraph of sanitizeForPdf(text).split(/\n+/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxW && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    if (paragraph === "") lines.push("");
  }
  return lines;
}

export async function renderBudgetPdf(input: BudgetPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const logoImg = await embedImage(doc, input.logoBytes);
  const headerImg = await embedImage(doc, input.headerBytes);

  const gradFrom = hexToRgb01(input.gradientFrom, [0.804, 1, 0]);
  const gradTo = hexToRgb01(input.gradientTo, [0.086, 0.086, 0.055]);
  const accent = hexToRgb01(input.accentColor, gradFrom);
  const INK: RGB = [0.09, 0.094, 0.102];
  const INK_SOFT: RGB = [0.227, 0.235, 0.247];
  const GRAY: RGB = [0.541, 0.553, 0.569];

  function drawLogo(page: PDFPage, x: number, topY: number, maxW: number, maxH: number): number {
    if (!logoImg) return 0;
    const scale = Math.min(maxW / logoImg.width, maxH / logoImg.height, 1);
    const w = logoImg.width * scale, h = logoImg.height * scale;
    page.drawImage(logoImg, { x, y: topY - h, width: w, height: h });
    return h;
  }

  /** Desenha a imagem de cabeçalho (se tiver) no topo da página, ANTES do
   * resto do conteúdo (senão o conteúdo desenhado depois fica por baixo,
   * já que pdf-lib empilha na ordem de desenho). Devolve quanto de altura
   * ela ocupou, pra quem chamou descontar do y inicial do conteúdo. */
  function drawHeaderImage(page: PDFPage, topY: number): number {
    if (!headerImg) return 0;
    const scale = Math.min(CONTENT_W / headerImg.width, 90 / headerImg.height, 1);
    const w = headerImg.width * scale, h = headerImg.height * scale;
    page.drawImage(headerImg, { x: MARGIN + (CONTENT_W - w) / 2, y: topY - h, width: w, height: h });
    return h + 16;
  }

  /** Rodapé é texto fixo lá embaixo — pode ser desenhado a qualquer momento
   * (não disputa espaço com o conteúdo, que nunca desce até y=28). */
  function drawFooterText(page: PDFPage) {
    if (!input.footerText) return;
    const label = sanitizeForPdf(input.footerText);
    const w = fontRegular.widthOfTextAtSize(label, 8.5);
    page.drawText(label, { x: (PAGE_W - w) / 2, y: 28, size: 8.5, font: fontRegular, color: rgb(...GRAY) });
  }

  if (input.version === "simples") {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;
    y -= drawHeaderImage(page, y);
    drawFooterText(page);

    const logoH = drawLogo(page, MARGIN, y, 110, 30);
    const titleX = MARGIN + (logoImg ? 120 : 0);
    page.drawText(sanitizeForPdf(`Orçamento — ${input.clientName}`), { x: titleX, y: y - 18, size: 15, font: fontBold, color: rgb(...INK) });
    y -= Math.max(logoH, 26) + 24;

    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 1, color: rgb(0.85, 0.85, 0.82) });
    y -= 20;

    for (const item of input.items) {
      const priceLabel = money(item.priceCents);
      const priceW = fontBold.widthOfTextAtSize(priceLabel, 11);
      page.drawText(sanitizeForPdf(item.label), { x: MARGIN, y, size: 11, font: fontBold, color: rgb(...INK) });
      page.drawText(priceLabel, { x: MARGIN + CONTENT_W - priceW, y, size: 11, font: fontBold, color: rgb(...INK) });
      y -= 15;
      if (item.description) {
        for (const line of wrapText(item.description, fontRegular, 9.5, CONTENT_W - 20)) {
          page.drawText(line, { x: MARGIN, y, size: 9.5, font: fontRegular, color: rgb(...GRAY) });
          y -= 13;
        }
      }
      y -= 8;
      page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 0.5, color: rgb(0.92, 0.92, 0.89) });
      y -= 18;
    }

    y -= 4;
    page.drawRectangle({ x: MARGIN, y: y - 14, width: CONTENT_W, height: 34, color: rgb(...accent), opacity: 0.12 });
    page.drawText("TOTAL", { x: MARGIN + 12, y: y - 4, size: 11, font: fontBold, color: rgb(...INK) });
    const totalLabel = money(input.totalCents);
    const totalW = fontBold.widthOfTextAtSize(totalLabel, 14);
    page.drawText(totalLabel, { x: MARGIN + CONTENT_W - 12 - totalW, y: y - 6, size: 14, font: fontBold, color: rgb(...INK) });
  } else {
    // ---- Capa ----
    const cover = doc.addPage([PAGE_W, PAGE_H]);
    drawVerticalGradient(cover, 0, 0, PAGE_W, PAGE_H, gradFrom, gradTo);
    const coverLogoH = drawLogo(cover, MARGIN, PAGE_H - 90, 160, 34);
    let cy = PAGE_H - 90 - Math.max(coverLogoH, 34) - 60;
    cover.drawText("PROPOSTA DE ORÇAMENTO", { x: MARGIN, y: cy, size: 24, font: fontBold, color: rgb(1, 1, 1) });
    cy -= 34;
    if (input.coverPhrase) {
      for (const line of wrapText(input.coverPhrase, fontRegular, 13, CONTENT_W * 0.8)) {
        cover.drawText(line, { x: MARGIN, y: cy, size: 13, font: fontRegular, color: rgb(1, 1, 1) });
        cy -= 18;
      }
    }
    cy -= 30;
    cover.drawText(sanitizeForPdf(`${input.clientName}${input.clientSegment ? " · " + input.clientSegment : ""}`), {
      x: MARGIN, y: cy, size: 12, font: fontBold, color: rgb(...accent),
    });

    // ---- Introdução ----
    if (input.introTitle || input.introText) {
      const intro = doc.addPage([PAGE_W, PAGE_H]);
      intro.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(...accent) });
      let y = PAGE_H - 130;
      if (input.introTitle) {
        for (const line of wrapText(input.introTitle, fontBold, 22, CONTENT_W)) {
          intro.drawText(line, { x: MARGIN, y, size: 22, font: fontBold, color: rgb(...INK) });
          y -= 28;
        }
        y -= 14;
      }
      if (input.introText) {
        for (const para of input.introText.split(/\n{2,}/)) {
          for (const line of wrapText(para, fontRegular, 12, CONTENT_W)) {
            intro.drawText(line, { x: MARGIN, y, size: 12, font: fontRegular, color: rgb(...INK) });
            y -= 18;
          }
          y -= 10;
        }
      }
    }

    // ---- Entregas por frente ----
    let page = doc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;
    y -= drawHeaderImage(page, y);
    drawFooterText(page);
    const newContentPage = () => {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      y -= drawHeaderImage(page, y);
      drawFooterText(page);
    };
    const ensureSpace = (h: number) => { if (y - h < MARGIN + 30) newContentPage(); };

    page.drawText("O QUE VOCÊS VÃO RECEBER", { x: MARGIN, y, size: 16, font: fontBold, color: rgb(...INK) });
    y -= 30;
    for (const front of input.fronts) {
      ensureSpace(40);
      page.drawText(sanitizeForPdf(front.title.toUpperCase()), { x: MARGIN, y, size: 10, font: fontBold, color: rgb(...accent) });
      y -= 18;
      for (const it of front.items) {
        ensureSpace(30);
        page.drawText(sanitizeForPdf(it.title), { x: MARGIN, y, size: 11.5, font: fontBold, color: rgb(...INK) });
        y -= 15;
        if (it.description) {
          for (const line of wrapText(it.description, fontRegular, 10, CONTENT_W)) {
            ensureSpace(14);
            page.drawText(line, { x: MARGIN, y, size: 10, font: fontRegular, color: rgb(...INK_SOFT) });
            y -= 14;
          }
        }
        y -= 8;
      }
      y -= 10;
      ensureSpace(1);
      page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 0.5, color: rgb(0.88, 0.88, 0.85) });
      y -= 20;
    }

    // ---- Investimento ----
    ensureSpace(180);
    y -= 10;
    page.drawText("ENTREGÁVEIS", { x: MARGIN, y, size: 14, font: fontBold, color: rgb(...INK) });
    y -= 20;
    for (const item of input.items) {
      ensureSpace(30);
      page.drawText(sanitizeForPdf(item.label), { x: MARGIN, y, size: 10.5, font: fontBold, color: rgb(...INK) });
      y -= 13;
      if (item.description) {
        for (const line of wrapText(item.description, fontRegular, 9.5, CONTENT_W)) {
          ensureSpace(13);
          page.drawText(line, { x: MARGIN, y, size: 9.5, font: fontRegular, color: rgb(...INK_SOFT) });
          y -= 13;
        }
      }
      y -= 6;
    }

    ensureSpace(90);
    y -= 10;
    const boxH = 76;
    page.drawRectangle({ x: MARGIN, y: y - boxH, width: CONTENT_W, height: boxH, borderColor: rgb(...INK), borderWidth: 1, color: rgb(1, 1, 1) });
    page.drawRectangle({ x: MARGIN + 14, y: y - 26, width: 100, height: 18, color: rgb(...accent) });
    page.drawText("INVESTIMENTO", { x: MARGIN + 20, y: y - 21, size: 9, font: fontBold, color: rgb(1, 1, 1) });
    const totalLabel = money(input.totalCents);
    page.drawText(`Valor total: ${totalLabel}`, { x: MARGIN + 14, y: y - 44, size: 13, font: fontBold, color: rgb(...INK) });
    if (input.paymentTerms) {
      for (const line of wrapText(input.paymentTerms, fontRegular, 8.5, CONTENT_W - 28).slice(0, 2)) {
        page.drawText(line, { x: MARGIN + 14, y: y - 60, size: 8.5, font: fontRegular, color: rgb(...GRAY) });
      }
    }
    y -= boxH + 24;

    const extras: [string, string | null][] = [
      ["Cronograma", input.cronograma],
      ["O que não está incluso", input.notIncluded],
      ["Após a aprovação desta proposta", input.afterApproval],
    ];
    for (const [label, text] of extras) {
      if (!text) continue;
      ensureSpace(40);
      page.drawText(label, { x: MARGIN, y, size: 10.5, font: fontBold, color: rgb(...INK) });
      y -= 15;
      for (const line of wrapText(text, fontRegular, 9.5, CONTENT_W)) {
        ensureSpace(13);
        page.drawText(line, { x: MARGIN, y, size: 9.5, font: fontRegular, color: rgb(...INK_SOFT) });
        y -= 13;
      }
      y -= 12;
    }

    // ---- Contracapa ----
    const back = doc.addPage([PAGE_W, PAGE_H]);
    drawVerticalGradient(back, 0, 0, PAGE_W, PAGE_H, gradTo, gradFrom);
    const backPhrase = input.backPhrase || "Vamos criar juntos.";
    let by = PAGE_H / 2 + 40;
    for (const line of wrapText(backPhrase, fontBold, 26, CONTENT_W * 0.85)) {
      back.drawText(line, { x: MARGIN, y: by, size: 26, font: fontBold, color: rgb(1, 1, 1) });
      by -= 32;
    }
    by -= 16;
    drawLogo(back, MARGIN, by + 34, 140, 30);
    // Cabeçalho/rodapé já foram desenhados em cada página de conteúdo na
    // hora de criá-la (drawHeaderImage/drawFooterText) — capa e contracapa
    // ficam de fora de propósito, são momentos de marca cheios.
  }

  return doc.save();
}
