/** Gera o PDF de exportação dos Insights do Instagram — capa com a marca
 * da agência, depois Visão geral / Atividade / Público em páginas
 * separadas. Mesma base de contract-pdf.server.ts/roteiros-pdf.server.ts
 * (pdf-lib puro, sem headless browser): os gráficos são barras desenhadas
 * na mão (retângulo + texto), não imagem rasterizada — fica nítido em
 * qualquer zoom e não precisa de nenhuma lib de canvas. Suporta tema claro
 * ou escuro, escolhido por quem exporta. */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

type RGB = [number, number, number];

type Theme = {
  background: RGB;
  card: RGB;
  ink: RGB;
  inkSoft: RGB;
  gray: RGB;
  barMuted: RGB;
  positive: RGB;
  negative: RGB;
};

function hexToRgb01(hex: string | null | undefined, fallback: RGB): RGB {
  const m = hex ? /^#([0-9a-fA-F]{6})$/.exec(hex.trim()) : null;
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function buildTheme(mode: "light" | "dark", brandHex: string | null): { theme: Theme; brand: RGB } {
  const brand = hexToRgb01(brandHex, [0.784, 0.831, 0.306]); // lime padrão do Modo Criador
  if (mode === "dark") {
    return {
      brand,
      theme: {
        background: [0.051, 0.051, 0.051],
        card: [0.11, 0.11, 0.11],
        ink: [0.96, 0.96, 0.96],
        inkSoft: [0.8, 0.8, 0.8],
        gray: [0.55, 0.55, 0.55],
        barMuted: [0.28, 0.28, 0.28],
        positive: [0.494, 0.851, 0.341],
        negative: [1, 0.42, 0.42],
      },
    };
  }
  return {
    brand,
    theme: {
      background: [1, 1, 1],
      card: [0.965, 0.965, 0.96],
      ink: [0.09, 0.094, 0.102],
      inkSoft: [0.227, 0.235, 0.247],
      gray: [0.541, 0.553, 0.569],
      barMuted: [0.88, 0.88, 0.86],
      positive: [0.204, 0.6, 0.16],
      negative: [0.8, 0.204, 0.204],
    },
  };
}

// A fonte padrão (Helvetica/WinAnsi) só desenha Latin-1 — mesma regra de
// roteiros-pdf.server.ts (emoji/legenda com símbolo quebraria o pdf-lib).
function sanitizeForPdf(text: string): string {
  return text.replace(/[\u{100}-\u{10FFFF}]/gu, "").replace(/[ \t]{2,}/g, " ").trim();
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

export type InsightsPdfInput = {
  clientName: string;
  username: string | null;
  orgName: string;
  logoBytes?: Uint8Array | null;
  brandColorHex?: string | null;
  theme: "light" | "dark";
  generatedAtLabel: string;
  kpis: {
    followersCount: number; followersChangePct: number | null;
    reach: number; reachChangePct: number | null;
    profileViews: number; profileViewsChangePct: number | null;
    totalInteractions: number; totalInteractionsChangePct: number | null;
  };
  followerComparison: { periodLabel: string; earliest: number; latest: number } | null;
  reachSeries: { date: string; value: number }[];
  followersSeries: { date: string; value: number }[];
  postingFrequency: { day: string; count: number }[];
  engagementByHour: { hour: number; value: number }[] | null;
  topContent: { label: string; metricLabel: string; metricValue: number; thumbnailBytes: Uint8Array | null }[];
  demographics: {
    gender: { label: string; pct: number }[];
    age: { label: string; pct: number }[];
    countries: { label: string; pct: number }[];
  } | null;
};

export async function renderInsightsPdf(input: InsightsPdfInput): Promise<Uint8Array> {
  const { theme: T, brand } = buildTheme(input.theme, input.brandColorHex ?? null);
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let logoImg: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  if (input.logoBytes && input.logoBytes.length > 0) {
    try { logoImg = await doc.embedPng(input.logoBytes); }
    catch { try { logoImg = await doc.embedJpg(input.logoBytes); } catch { logoImg = null; } }
  }

  function newPage(): PDFPage {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(...T.background) });
    return page;
  }

  function sectionHeader(page: PDFPage, y: number, label: string): number {
    page.drawText(sanitizeForPdf(label.toUpperCase()), { x: MARGIN, y, size: 9, font: fontBold, color: rgb(...brand) });
    page.drawLine({ start: { x: MARGIN, y: y - 8 }, end: { x: MARGIN + CONTENT_W, y: y - 8 }, thickness: 1, color: rgb(...T.barMuted) });
    return y - 26;
  }

  function kpiTile(page: PDFPage, x: number, y: number, w: number, h: number, label: string, value: number, changePct: number | null) {
    page.drawRectangle({ x, y: y - h, width: w, height: h, color: rgb(...T.card) });
    page.drawText(fmtInt(value), { x: x + 12, y: y - 30, size: 20, font: fontBold, color: rgb(...T.ink) });
    page.drawText(sanitizeForPdf(label), { x: x + 12, y: y - h + 14, size: 8.5, font: fontRegular, color: rgb(...T.gray) });
    if (changePct != null) {
      const sign = changePct >= 0 ? "+" : "";
      const txt = `${sign}${changePct}%`;
      const color = changePct >= 0 ? T.positive : T.negative;
      const size = 9;
      const tw = fontBold.widthOfTextAtSize(txt, size);
      page.drawText(txt, { x: x + w - tw - 12, y: y - 20, size, font: fontBold, color: rgb(...color) });
    }
  }

  /** Barras simples: cada bar é |valor| normalizado pela maior do grupo;
   * cor override por índice pra positivo/negativo ou "melhor horário". */
  function barChart(page: PDFPage, opts: {
    x: number; y: number; width: number; height: number;
    bars: { label: string; value: number }[];
    colorFor?: (v: number, i: number) => RGB;
    labelEvery?: number;
  }) {
    const { x, y, width, height, bars } = opts;
    const labelEvery = opts.labelEvery ?? 1;
    const labelH = 12;
    const chartH = height - labelH;
    const max = Math.max(...bars.map((b) => Math.abs(b.value)), 1);
    const gap = bars.length > 20 ? 1 : 3;
    const barW = (width - gap * (bars.length - 1)) / bars.length;
    const baseline = y + labelH;
    page.drawLine({ start: { x, y: baseline }, end: { x: x + width, y: baseline }, thickness: 0.5, color: rgb(...T.barMuted) });
    bars.forEach((b, i) => {
      const bx = x + i * (barW + gap);
      const h = Math.max(1.5, (Math.abs(b.value) / max) * chartH);
      const color = opts.colorFor ? opts.colorFor(b.value, i) : T.barMuted;
      page.drawRectangle({ x: bx, y: baseline, width: Math.max(1, barW), height: h, color: rgb(...color) });
      if (i % labelEvery === 0) {
        const label = sanitizeForPdf(b.label);
        const size = 6;
        const lw = fontRegular.widthOfTextAtSize(label, size);
        page.drawText(label, { x: bx + (barW - lw) / 2, y: y, size, font: fontRegular, color: rgb(...T.gray) });
      }
    });
  }

  function hBarGroup(page: PDFPage, x: number, y: number, width: number, rows: { label: string; pct: number }[]): number {
    let cy = y;
    for (const r of rows) {
      const label = sanitizeForPdf(r.label);
      page.drawText(label, { x, y: cy, size: 8.5, font: fontRegular, color: rgb(...T.inkSoft) });
      const barY = cy - 11;
      const barMaxW = width - 40;
      page.drawRectangle({ x, y: barY, width: barMaxW, height: 5, color: rgb(...T.barMuted) });
      page.drawRectangle({ x, y: barY, width: Math.max(2, (r.pct / 100) * barMaxW), height: 5, color: rgb(...brand) });
      const pctLabel = `${r.pct}%`;
      page.drawText(pctLabel, { x: x + barMaxW + 8, y: barY, size: 8, font: fontBold, color: rgb(...T.ink) });
      cy -= 24;
    }
    return cy;
  }

  function footer(page: PDFPage, pageNum: number, totalPages: number) {
    const label = sanitizeForPdf(`${input.orgName} · Página ${pageNum} de ${totalPages}`);
    const w = fontRegular.widthOfTextAtSize(label, 8);
    page.drawText(label, { x: (PAGE_W - w) / 2, y: 24, size: 8, font: fontRegular, color: rgb(...T.gray) });
  }

  // ===== Página 1 — Capa =====
  {
    const page = newPage();
    let y = PAGE_H - 120;
    if (logoImg) {
      const maxW = 160, maxH = 34;
      const scale = Math.min(maxW / logoImg.width, maxH / logoImg.height, 1);
      const w = logoImg.width * scale, h = logoImg.height * scale;
      page.drawImage(logoImg, { x: MARGIN, y: PAGE_H - 70 - h, width: w, height: h });
    }
    page.drawText("INSTAGRAM · INSIGHTS", { x: MARGIN, y, size: 11, font: fontBold, color: rgb(...brand) });
    y -= 36;
    page.drawText(sanitizeForPdf(input.clientName), { x: MARGIN, y, size: 30, font: fontBold, color: rgb(...T.ink) });
    y -= 26;
    if (input.username) {
      page.drawText(sanitizeForPdf(`@${input.username}`), { x: MARGIN, y, size: 14, font: fontRegular, color: rgb(...T.gray) });
      y -= 40;
    }
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 1, color: rgb(...T.barMuted) });
    y -= 24;
    page.drawText(sanitizeForPdf(`Feito por ${input.orgName}`), { x: MARGIN, y, size: 10, font: fontBold, color: rgb(...T.inkSoft) });
    y -= 16;
    page.drawText(sanitizeForPdf(`Gerado em ${input.generatedAtLabel}`), { x: MARGIN, y, size: 9, font: fontRegular, color: rgb(...T.gray) });
  }

  // ===== Página 2 — Visão geral =====
  {
    const page = newPage();
    let y = PAGE_H - MARGIN;
    y = sectionHeader(page, y, "Visão geral");

    const tileW = (CONTENT_W - 24) / 4;
    const tileH = 66;
    const tiles: [string, number, number | null][] = [
      ["Seguidores", input.kpis.followersCount, input.kpis.followersChangePct],
      ["Alcance (30d)", input.kpis.reach, input.kpis.reachChangePct],
      ["Visitas ao perfil", input.kpis.profileViews, input.kpis.profileViewsChangePct],
      ["Interações", input.kpis.totalInteractions, input.kpis.totalInteractionsChangePct],
    ];
    tiles.forEach(([label, value, changePct], i) => {
      kpiTile(page, MARGIN + i * (tileW + 8), y, tileW, tileH, label, value, changePct);
    });
    y -= tileH + 26;

    if (input.followerComparison) {
      const c = input.followerComparison;
      const delta = c.latest - c.earliest;
      const deltaPct = c.earliest > 0 ? Math.round((delta / c.earliest) * 1000) / 10 : 0;
      page.drawRectangle({ x: MARGIN, y: y - 34, width: CONTENT_W, height: 34, color: rgb(...T.card) });
      page.drawText(sanitizeForPdf(`Comparativo de seguidores — ${c.periodLabel}: ${fmtInt(c.earliest)} -> hoje ${fmtInt(c.latest)}`),
        { x: MARGIN + 12, y: y - 21, size: 9.5, font: fontRegular, color: rgb(...T.inkSoft) });
      const deltaTxt = `${delta >= 0 ? "+" : ""}${fmtInt(delta)} (${deltaPct >= 0 ? "+" : ""}${deltaPct}%)`;
      const dw = fontBold.widthOfTextAtSize(deltaTxt, 10);
      page.drawText(deltaTxt, { x: MARGIN + CONTENT_W - dw - 12, y: y - 21, size: 10, font: fontBold, color: rgb(...(delta >= 0 ? T.positive : T.negative)) });
      y -= 50;
    }

    const chartW = (CONTENT_W - 20) / 2;
    const chartH = 130;
    page.drawText("ALCANCE POR DIA (30 DIAS)", { x: MARGIN, y, size: 8, font: fontBold, color: rgb(...T.gray) });
    page.drawText("SEGUIDORES POR DIA (30 DIAS)", { x: MARGIN + chartW + 20, y, size: 8, font: fontBold, color: rgb(...T.gray) });
    y -= 14;
    const reachMax = Math.max(...input.reachSeries.map((r) => r.value), 1);
    barChart(page, {
      x: MARGIN, y: y - chartH, width: chartW, height: chartH,
      bars: input.reachSeries.map((r) => ({ label: new Date(r.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), value: r.value })),
      colorFor: (v) => (v === reachMax ? brand : T.barMuted),
      labelEvery: 5,
    });
    barChart(page, {
      x: MARGIN + chartW + 20, y: y - chartH, width: chartW, height: chartH,
      bars: input.followersSeries.map((r) => ({ label: new Date(r.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), value: r.value })),
      colorFor: (v) => (v >= 0 ? T.positive : T.negative),
      labelEvery: 5,
    });
    y -= chartH + 20;

    if (input.topContent.length > 0) {
      y = sectionHeader(page, y, "Conteúdo mais relevante");
      const thumbSize = 28;
      const rowH = 34;
      for (const c of input.topContent.slice(0, 6)) {
        let thumbImg: Awaited<ReturnType<typeof doc.embedJpg>> | null = null;
        if (c.thumbnailBytes) {
          try { thumbImg = await doc.embedJpg(c.thumbnailBytes); }
          catch { try { thumbImg = await doc.embedPng(c.thumbnailBytes); } catch { thumbImg = null; } }
        }
        // Recuo fixo (com ou sem miniatura) pra lista ficar alinhada mesmo
        // quando algum item não tem thumbnail_url (comum em vídeo/carrossel).
        const textX = MARGIN + thumbSize + 10;
        const textY = y - (rowH - 9) / 2 + 3;
        if (thumbImg) {
          // Encaixa dentro do quadrado pelo menor lado ("contain", não
          // recorta) — simples e sem precisar de clip path no pdf-lib.
          const scale = thumbSize / Math.max(thumbImg.width, thumbImg.height);
          const w = thumbImg.width * scale, h = thumbImg.height * scale;
          const boxY = y - rowH + (rowH - thumbSize) / 2;
          page.drawImage(thumbImg, { x: MARGIN + (thumbSize - w) / 2, y: boxY + (thumbSize - h) / 2, width: w, height: h });
        }
        page.drawText(sanitizeForPdf(c.label), { x: textX, y: textY, size: 9, font: fontRegular, color: rgb(...T.inkSoft) });
        const valTxt = `${fmtInt(c.metricValue)} ${sanitizeForPdf(c.metricLabel).toLowerCase()}`;
        const vw = fontBold.widthOfTextAtSize(valTxt, 9);
        page.drawText(valTxt, { x: MARGIN + CONTENT_W - vw, y: textY, size: 9, font: fontBold, color: rgb(...T.ink) });
        y -= rowH;
      }
    }
  }

  // ===== Página 3 — Atividade e engajamento =====
  {
    const page = newPage();
    let y = PAGE_H - MARGIN;
    y = sectionHeader(page, y, "Atividade");

    const maxFreq = Math.max(...input.postingFrequency.map((d) => d.count), 1);
    page.drawText("FREQUÊNCIA DE POSTAGEM", { x: MARGIN, y, size: 8, font: fontBold, color: rgb(...T.gray) });
    y -= 14;
    barChart(page, {
      x: MARGIN, y: y - 130, width: CONTENT_W, height: 130,
      bars: input.postingFrequency.map((d) => ({ label: d.day, value: d.count })),
      colorFor: (v) => (v === maxFreq && maxFreq > 0 ? brand : T.barMuted),
    });
    y -= 160;

    if (input.engagementByHour) {
      const bestHour = [...input.engagementByHour].sort((a, b) => b.value - a.value)[0];
      const maxEng = Math.max(...input.engagementByHour.map((h) => h.value), 1);
      page.drawText("MELHOR HORÁRIO POR ENGAJAMENTO", { x: MARGIN, y, size: 8, font: fontBold, color: rgb(...T.gray) });
      if (bestHour) {
        const label = `Melhor: ${String(bestHour.hour).padStart(2, "0")}h`;
        const lw = fontBold.widthOfTextAtSize(label, 9);
        page.drawText(label, { x: MARGIN + CONTENT_W - lw, y, size: 9, font: fontBold, color: rgb(...brand) });
      }
      y -= 14;
      barChart(page, {
        x: MARGIN, y: y - 130, width: CONTENT_W, height: 130,
        bars: input.engagementByHour.map((h) => ({ label: `${String(h.hour).padStart(2, "0")}h`, value: h.value })),
        colorFor: (v) => (v === maxEng && maxEng > 0 ? brand : T.barMuted),
        labelEvery: 2,
      });
    }
  }

  // ===== Página 4 — Público (só se tiver dado suficiente) =====
  if (input.demographics) {
    const page = newPage();
    let y = PAGE_H - MARGIN;
    y = sectionHeader(page, y, "Público");

    page.drawText("GÊNERO", { x: MARGIN, y, size: 8, font: fontBold, color: rgb(...T.gray) });
    y -= 18;
    y = hBarGroup(page, MARGIN, y, CONTENT_W, input.demographics.gender);
    y -= 16;

    page.drawText("FAIXA ETÁRIA", { x: MARGIN, y, size: 8, font: fontBold, color: rgb(...T.gray) });
    y -= 18;
    y = hBarGroup(page, MARGIN, y, CONTENT_W, input.demographics.age);
    y -= 16;

    page.drawText("PRINCIPAIS LOCALIZAÇÕES", { x: MARGIN, y, size: 8, font: fontBold, color: rgb(...T.gray) });
    y -= 18;
    hBarGroup(page, MARGIN, y, CONTENT_W, input.demographics.countries);
  }

  const pages = doc.getPages();
  pages.forEach((p, i) => footer(p, i + 1, pages.length));

  return doc.save();
}
