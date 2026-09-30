// House — briefing da marca: as perguntas do bloco "Briefing da marca" da
// ficha e como elas viram o texto que as IAs leem (clients.content_briefing).

export const BRAND_BRIEFING_FIELDS = [
  { key: "servicos", label: "Serviços e produtos", hint: "O que a empresa oferece. Os carros-chefe primeiro.", rows: 3 },
  { key: "publico", label: "Público", hint: "Quem são os clientes: idade, região, o que buscam, o que os preocupa.", rows: 3 },
  { key: "diferenciais", label: "Diferenciais", hint: "Por que escolher essa empresa e não outra.", rows: 3 },
  { key: "tom", label: "Tom de voz", hint: "Ex: acolhedor e próximo, sem termos técnicos; ou sério e técnico.", rows: 2 },
  { key: "ofertas", label: "Ofertas e campanhas atuais", hint: "Promoções, condições, datas importantes do momento.", rows: 2 },
  { key: "evitar", label: "O que evitar", hint: "Assuntos, palavras, promessas ou fotos que não podem aparecer.", rows: 2 },
  { key: "instagram", label: "Como é o Instagram hoje", hint: "O que funciona, o que não funciona, quem aparece nos vídeos.", rows: 2 },
] as const;

export type BrandBriefingKey = (typeof BRAND_BRIEFING_FIELDS)[number]["key"];
export type BrandBriefing = Partial<Record<BrandBriefingKey, string>>;

/** Texto que vai pro clients.content_briefing (lido pela prévia de
 * planejamento com IA e pelas ideias de stories). */
export function composeBriefingText(b: BrandBriefing): string {
  return BRAND_BRIEFING_FIELDS
    .filter((f) => b[f.key]?.trim())
    .map((f) => `## ${f.label}\n${b[f.key]!.trim()}`)
    .join("\n\n");
}

/** Quanto do briefing está preenchido (0 a 1) — pro aviso no Meu dia. */
export function briefingCompleteness(b: BrandBriefing | null | undefined, description?: string | null): number {
  const filled = BRAND_BRIEFING_FIELDS.filter((f) => b?.[f.key]?.trim()).length + (description?.trim() ? 1 : 0);
  return filled / (BRAND_BRIEFING_FIELDS.length + 1);
}

export type StoryIdea = {
  momento: "manha" | "tarde" | "noite";
  formato: string;
  titulo: string;
  roteiro: string;
  textoNaTela?: string;
  cta?: string;
};

export const MOMENTO_LABEL: Record<StoryIdea["momento"], string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Fim do dia",
};
