// Estimativa de tempo da prévia de planejamento com IA — usada na contagem
// regressiva da tela de carregamento. Antes era um "50s" fixo (medido com 12
// itens, sem pesquisa de concorrentes) e estourava com muitos conteúdos.
//
// Modelo: tempo fixo de cada chamada (~12s: ler briefing, base de
// conhecimento e arquivos) + ~3,4s por conteúdo gerado + ~20s quando há
// concorrentes cadastrados (a IA pesquisa na web na primeira chamada).
// Acima de 20 itens a geração roda em mais de uma chamada em sequência
// (CHUNK_SIZE em ai-planning.functions.ts), cada uma com o tempo fixo.
// Medido: 12 itens sem pesquisa ≈ 44s. A estimativa é propositalmente um
// pouco conservadora: melhor terminar antes do que passar do previsto.

export const PLAN_CHUNK_SIZE = 20;
export const DEFAULT_PLAN_ITEMS = 6;

export function estimatePlanSeconds(opts: { items: number; researchCompetitors?: boolean; extraContextChars?: number }): number {
  const items = Math.max(1, Math.round(opts.items));
  const chunks = Math.max(1, Math.ceil(items / PLAN_CHUNK_SIZE));
  const research = opts.researchCompetitors ? 20 : 0;
  // Contexto extra grande (transcrição de reunião) demora mais pra ler.
  const context = Math.min(12, Math.round((opts.extraContextChars ?? 0) / 5000));
  return Math.round(12 * chunks + 3.4 * items + research + context);
}
