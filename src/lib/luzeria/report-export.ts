const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const ACTIVITY_KIND_LABEL: Record<string, string> = {
  finalized: "Finalizou", status: "Mudança de status", comment: "Comentário",
  file: "Arquivo", created: "Criação", due_date: "Prazo alterado", rated: "Avaliação",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

export async function exportReportXlsx(
  report: any,
  range: { from: string; to: string; label: string },
) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // Aba 1 — Resumo
  const resumo = [
    ["Relatório Luzeria"],
    ["Período", range.label],
    ["De", new Date(range.from).toLocaleDateString("pt-BR")],
    ["Até", new Date(range.to).toLocaleDateString("pt-BR")],
    [],
    ["Tarefas finalizadas", report.summary.total],
    ["Posts", report.summary.posts],
    ["Reels", report.summary.reels],
    ["Outros", report.summary.outros],
    ["Stories", report.summary.stories],
    ["Limpeza", report.summary.cleaning],
    [],
    ["Reels por formato"],
    ["Lo-fi", report.formatTotals.lofi],
    ["Fácil", report.formatTotals.facil],
    ["Básico", report.formatTotals.basico],
    ["Avançado", report.formatTotals.avancado],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), "Resumo");

  // Aba 2 — Por membro
  const memberHead = ["Membro", "Função", "Posts", "Reels", "Outros", "Stories", "Limpeza", "Total", "% do time"];
  const memberRows = report.byMember.map((m: any) => [
    m.name, m.role, m.posts, m.reels, m.outros, m.stories, m.cleaning, m.total, `${m.pct}%`,
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([memberHead, ...memberRows]), "Por Membro");

  // Aba 3 — Reels por formato
  const fmtHead = ["Editor", "Lo-fi", "Fácil", "Básico", "Avançado", "Total"];
  const fmtRows = report.byEditorFormat.map((r: any) => [
    r.name, r.lofi, r.facil, r.basico, r.avancado, r.total,
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([fmtHead, ...fmtRows]), "Reels por Formato");

  // Aba 4 — Histórico (feed de atividade: comentários, uploads, mudanças de
  // status, criação de itens, etc. — não só finalizações)
  const histHead = ["Data", "Membro", "Cliente", "Ação", "Item", "Descrição"];
  const histRows = (report.activityFeed ?? []).map((h: any) => [
    fmtDate(h.at),
    h.userName,
    h.clientName ?? "—",
    ACTIVITY_KIND_LABEL[h.kind] ?? h.kind,
    h.itemTitle ?? "",
    h.description ?? "",
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([histHead, ...histRows]), "Histórico");

  const refDate = new Date(range.to);
  const fname = `Relatorio_Luzeria_${MONTHS_PT[refDate.getMonth()]}_${refDate.getFullYear()}.xlsx`;
  XLSX.writeFile(wb, fname);
}