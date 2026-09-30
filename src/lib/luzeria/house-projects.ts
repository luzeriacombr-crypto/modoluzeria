// House (Fase 4) — modelos prontos de projeto de marketing. Cada tarefa tem
// uma etapa e um prazo relativo à data principal do projeto (dia do evento,
// do programa, lançamento da campanha): -7 = uma semana antes.

export type ProjectTemplateId = "evento" | "radio" | "campanha" | "livre";
export type ProjectStatus = "planejado" | "andamento" | "concluido" | "cancelado";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planejado: "Planejado",
  andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

type TemplateTask = { title: string; offset: number };
export type ProjectTemplate = {
  id: ProjectTemplateId;
  label: string;
  description: string;
  dateLabel: string;
  stages: { stage: string; tasks: TemplateTask[] }[];
};

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "evento",
    label: "Evento",
    description: "Antes, durante e depois, com estrutura, cobertura e patrocínio.",
    dateLabel: "Data do evento",
    stages: [
      { stage: "Antes", tasks: [
        { title: "Definir objetivo, público e data", offset: -30 },
        { title: "Reservar local", offset: -28 },
        { title: "Criar arte de divulgação", offset: -21 },
        { title: "Post de convite no feed", offset: -14 },
        { title: "Contagem regressiva nos stories", offset: -7 },
        { title: "Confirmar presença dos convidados", offset: -3 },
      ] },
      { stage: "Estrutura e materiais", tasks: [
        { title: "Lista de materiais (banner, brindes, som, internet)", offset: -21 },
        { title: "Encomendar materiais impressos", offset: -14 },
        { title: "Testar som, luz e internet no local", offset: -1 },
      ] },
      { stage: "Patrocínio", tasks: [
        { title: "Listar possíveis patrocinadores e parceiros", offset: -30 },
        { title: "Enviar proposta de patrocínio", offset: -25 },
        { title: "Confirmar contrapartidas e receber logos", offset: -10 },
      ] },
      { stage: "Cobertura", tasks: [
        { title: "Definir responsável pela cobertura", offset: -7 },
        { title: "Roteiro de fotos e vídeos", offset: -3 },
        { title: "Carregar celular, bateria e microfone", offset: -1 },
      ] },
      { stage: "Durante", tasks: [
        { title: "Stories ao vivo", offset: 0 },
        { title: "Fotos das pessoas e da estrutura", offset: 0 },
        { title: "Gravar depoimentos curtos (15 segundos)", offset: 0 },
        { title: "Registrar os leads do evento no + Lead", offset: 0 },
      ] },
      { stage: "Depois", tasks: [
        { title: "Post de agradecimento com as melhores fotos", offset: 2 },
        { title: "Reels com os melhores momentos", offset: 4 },
        { title: "Agradecer patrocinadores e parceiros", offset: 5 },
        { title: "Resultado do evento no relatório do mês", offset: 7 },
      ] },
    ],
  },
  {
    id: "radio",
    label: "Programa de rádio",
    description: "Pauta, convidado, divulgação e reaproveitamento pras redes.",
    dateLabel: "Data do programa",
    stages: [
      { stage: "Pauta", tasks: [
        { title: "Definir o tema", offset: -7 },
        { title: "Escrever de 3 a 5 perguntas", offset: -5 },
        { title: "Definir a mensagem principal", offset: -5 },
      ] },
      { stage: "Convidado", tasks: [
        { title: "Convidar e confirmar o convidado", offset: -7 },
        { title: "Pegar nome, cargo e @ do convidado", offset: -5 },
        { title: "Enviar orientações (horário, tema, duração)", offset: -2 },
      ] },
      { stage: "Divulgação", tasks: [
        { title: "Arte de divulgação", offset: -4 },
        { title: "Post e stories avisando dia e horário", offset: -2 },
        { title: "Story no dia chamando pra ouvir", offset: 0 },
      ] },
      { stage: "No dia", tasks: [
        { title: "Gravar bastidores em vídeo vertical", offset: 0 },
        { title: "Foto com o convidado", offset: 0 },
      ] },
      { stage: "Reaproveitamento para redes", tasks: [
        { title: "Stories: \"você perdeu? olha esse trecho\"", offset: 1 },
        { title: "Cortar 2 a 3 Reels com os melhores trechos", offset: 2 },
        { title: "Carrossel com as principais dicas", offset: 3 },
      ] },
    ],
  },
  {
    id: "campanha",
    label: "Campanha",
    description: "Do objetivo e oferta ao resultado no relatório.",
    dateLabel: "Lançamento",
    stages: [
      { stage: "Planejamento", tasks: [
        { title: "Objetivo e oferta da campanha", offset: -14 },
        { title: "Público e período", offset: -14 },
        { title: "Orçamento de tráfego pago", offset: -12 },
      ] },
      { stage: "Criação", tasks: [
        { title: "Roteiros e textos das peças", offset: -10 },
        { title: "Artes e vídeos", offset: -7 },
        { title: "Aprovação do gestor", offset: -4 },
      ] },
      { stage: "Lançamento", tasks: [
        { title: "Publicar as peças", offset: 0 },
        { title: "Subir os anúncios", offset: 0 },
        { title: "Avisar quem atende no direct", offset: 0 },
      ] },
      { stage: "Acompanhamento", tasks: [
        { title: "Conferir leads e custo por conversa", offset: 3 },
        { title: "Ajustar anúncios (pausar o que não gera conversa)", offset: 5 },
      ] },
      { stage: "Encerramento", tasks: [
        { title: "Resultado da campanha no relatório do mês", offset: 15 },
      ] },
    ],
  },
  {
    id: "livre",
    label: "Em branco",
    description: "Monte as etapas do seu jeito.",
    dateLabel: "Data principal",
    stages: [{ stage: "Tarefas", tasks: [] }],
  },
];

export function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ===== Variável (relatório mensal) ===== */

export type VariableWeights = { goals: number; leads: number; scheduled: number };
export const DEFAULT_VARIABLE_WEIGHTS: VariableWeights = { goals: 30, leads: 30, scheduled: 40 };

export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const names = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${names[m - 1]} de ${y}`;
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/* ===== Demandas avulsas ===== */

export const DEMAND_KINDS = ["banner", "jingle", "folder", "convite", "cartao", "video", "arte", "outro"] as const;
export type DemandKind = (typeof DEMAND_KINDS)[number];
export const DEMAND_KIND_META: Record<DemandKind, { label: string; hint: string }> = {
  banner: { label: "Banner", hint: "Tamanho (ex: 2x1m), texto, onde vai ficar, fotos/logos." },
  jingle: { label: "Jingle pra rádio", hint: "Duração, mensagem principal, tom (alegre, sério), emissora." },
  folder: { label: "Folder", hint: "Formato (A4 dobrado, A5), textos, quantidade, gráfica." },
  convite: { label: "Convite", hint: "Evento, data, local, horário, digital ou impresso." },
  cartao: { label: "Cartão de visita", hint: "Nome, cargo, contatos, frente e verso." },
  video: { label: "Vídeo", hint: "Duração, onde vai passar, roteiro ou ideia, prazo de captação." },
  arte: { label: "Arte avulsa", hint: "Formato, texto, onde vai ser usada." },
  outro: { label: "Outro", hint: "Descreva o que precisa ser feito." },
};
