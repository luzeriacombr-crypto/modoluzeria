/** PDF do relatório mensal da House — mesma base dos outros PDFs do app
 * (pdf-lib puro, fontes padrão WinAnsi: acentos do português funcionam,
 * emoji/aspas curvas são removidos por sanitize). Uma ou duas páginas A4:
 * números do mês, leads, a variável (se ligada) e o texto da equipe. */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { MonthNumbers } from "./house-owner.functions";
import { LEAD_ORIGIN_LABEL, LEAD_ORIGINS } from "./house-checklists";
import { monthLabel } from "./house-projects";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 50;
const W = PAGE_W - M * 2;
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.42, 0.44, 0.48);
const LINE = rgb(0.88, 0.89, 0.9);
const ACCENT = rgb(0.36, 0.55, 0.2);

function sanitize(text: string): string {
  return text
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-")
    .replace(/[\u{100}-\u{10FFFF}]/gu, "").replace(/[ \t]{2,}/g, " ");
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const lines: string[] = [];
  for (const para of sanitize(text).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(""); continue; }
    let cur = "";
    for (const w of words) {
      const cand = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(cand, size) > maxW && cur) { lines.push(cur); cur = w; } else cur = cand;
    }
    if (cur) lines.push(cur);
  }
  return lines;
}

const pct = (v: number | null) => (v == null ? "-" : `${Math.round(v * 100)}%`);
const money = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function buildHouseReportPdf(input: {
  orgName: string; monthKey: string; numbers: MonthNumbers;
  whatWorked: string; learned: string; nextChanges: string; status: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;

  const ensure = (h: number) => {
    if (y - h < M) { page = doc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - M; }
  };
  const text = (t: string, x: number, size: number, f = font, color = INK) => {
    page.drawText(sanitize(t), { x, y, size, font: f, color });
  };
  const heading = (t: string) => {
    ensure(40);
    y -= 26;
    text(t.toUpperCase(), M, 9.5, bold, ACCENT);
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.6, color: LINE });
    y -= 6;
  };
  const row = (label: string, value: string, sub?: string) => {
    ensure(20);
    y -= 16;
    text(label, M, 10.5);
    const vw = bold.widthOfTextAtSize(sanitize(value), 10.5);
    text(value, M + W - vw, 10.5, bold);
    if (sub) {
      y -= 12;
      text(sub, M, 8.5, font, MUTED);
    }
  };
  const paragraph = (t: string) => {
    const lines = wrap(t || "(não preenchido)", font, 10.5, W);
    for (const l of lines) { ensure(15); y -= 15; text(l, M, 10.5, font, t ? INK : MUTED); }
  };

  // Cabeçalho
  text(input.orgName, M, 11, bold, MUTED);
  y -= 26;
  text(`Relatório de ${monthLabel(input.monthKey)}`, M, 22, bold);
  y -= 16;
  text(input.status === "enviado" ? "Relatório enviado pela equipe" : "Rascunho (números ao vivo)", M, 9, font, MUTED);

  const n = input.numbers;
  heading("Metas do mês");
  row("Execução das metas", pct(n.goalsPct));
  row("Stories publicados", `${n.stories.done} de ${n.stories.goal}`, n.stories.source === "instagram" ? `contados do Instagram em ${n.stories.trackedDays} dia(s) registrados` : "contados pelo Modo Criador");
  row("Posts no feed", `${n.posts.done} de ${n.posts.goal}`, n.posts.source === "instagram" ? "contados do Instagram" : "contados pelo Modo Criador");
  row(`Planejamento de ${monthLabel(n.planning.targetMonth)}`,
    n.planning.delivered ? (n.planning.onTime ? "Entregue no prazo" : "Entregue com atraso") : n.planning.onTime === false ? "Não entregue (prazo vencido)" : "Pendente",
    `prazo: ${n.planning.deadline.split("-").reverse().join("/")}`);
  row("Checklists concluídos", n.checklists.pct == null ? "-" : `${n.checklists.done} feitos, ${n.checklists.missed} atrasados (${pct(n.checklists.pct)})`);

  heading("Leads do Instagram");
  row("Leads registrados", `${n.leads.total}${n.leads.goal ? ` de ${n.leads.goal}` : ""}`);
  row("Agendaram", `${n.leads.scheduled} (${pct(n.leads.scheduleRate)} dos leads)`);
  row("Compareceram", `${n.leads.attended} (${pct(n.leads.attendRate)} dos agendados)`);
  for (const o of LEAD_ORIGINS) if (n.leads.byOrigin[o]) row(`   ${LEAD_ORIGIN_LABEL[o]}`, String(n.leads.byOrigin[o]));

  if (n.byBrand && n.byBrand.length > 1) {
    heading("Por marca");
    for (const b of n.byBrand) {
      row(b.name, `${b.leads} lead(s), ${b.scheduled} agendado(s)`, `stories ${b.stories.done}/${b.stories.goal}, posts ${b.posts.done}/${b.posts.goal}`);
    }
  }

  if (n.reach && n.reach.some((r) => r.connected || r.followers != null)) {
    heading("Alcance e seguidores");
    for (const r of n.reach) {
      if (!r.connected && r.followers == null) { row(r.name, "Instagram não conectado"); continue; }
      const change = r.followersChange == null ? "" : ` (${r.followersChange >= 0 ? "+" : ""}${r.followersChange} no mês)`;
      row(r.name, `${r.followers ?? "-"} seguidores${change}`,
        r.reach30 != null ? `alcance 30 dias: ${r.reach30} | visitas ao perfil: ${r.profileViews30 ?? "-"} | interações: ${r.interactions30 ?? "-"}` : undefined);
    }
  }

  if (n.ads && (n.ads.spendCents > 0 || n.ads.leads > 0)) {
    heading("Tráfego pago");
    row("Investido em anúncios", money(n.ads.spendCents));
    row("Leads de anúncio", String(n.ads.leads));
    row("Agendamentos de anúncio", String(n.ads.scheduled));
    row("Custo por lead", n.ads.costPerLeadCents == null ? "-" : money(n.ads.costPerLeadCents));
    row("Custo por agendamento", n.ads.costPerScheduledCents == null ? "-" : money(n.ads.costPerScheduledCents));
  }

  if (n.variable) {
    const v = n.variable;
    heading("Variável");
    row(`Execução das metas (peso ${v.weights.goals}%)`, pct(v.scores.goals));
    row(`Leads registrados (peso ${v.weights.leads}%)`, pct(v.scores.leads));
    row(`Leads que agendaram (peso ${v.weights.scheduled}%)`, pct(v.scores.scheduled));
    row("Resultado", `${pct(v.totalPct)} de ${money(v.maxCents)} = ${money(v.valueCents)}`);
  }

  heading("O que funcionou");
  paragraph(input.whatWorked);
  heading("O que aprendemos");
  paragraph(input.learned);
  heading("O que muda no próximo mês");
  paragraph(input.nextChanges);

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(sanitize(`${input.orgName} - Modo Criador`), { x: M, y: 28, size: 8, font, color: MUTED });
    const label = `${i + 1}/${pages.length}`;
    p.drawText(label, { x: PAGE_W - M - font.widthOfTextAtSize(label, 8), y: 28, size: 8, font, color: MUTED });
  });
  return doc.save();
}
