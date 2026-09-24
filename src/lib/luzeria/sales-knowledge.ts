// Fonte única de conhecimento pro Chat do Modo Criador na página pública de
// vendas (/assinar) — reaproveita texto de marketing já aprovado (a página
// de vendas em si + as 6 páginas de recurso por SEO), nunca inventa copy
// nova. `SALES_FAQ` também é a fonte da seção "Dúvidas frequentes" da
// própria SalesPage.tsx (edita aqui, atualiza os dois lugares).

export const SALES_FAQ: [string, string][] = [
  ["Preciso saber mexer em tecnologia?", "Não. É muito intuitivo usar o Modo Criador. (Bem mais fácil que o ClickUp e Trello.)"],
  ["Estou vindo de outra plataforma, consigo migrar meus clientes?", "Sim, criamos um sistema que você consegue colocar toda a sua operação dentro do Modo Criador com rapidez."],
  ["Meu cliente precisa criar conta pra aprovar o conteúdo?", "Não. Ele recebe um link público, com a sua marca, e aprova direto, sem cadastro."],
  ["Funciona pra qualquer tipo de agência?", "Sim, foi feito pra qualquer agência ou social media que gerencia múltiplos clientes."],
  ["Posso trocar de plano depois?", "Sim, a qualquer momento nas configurações da sua conta."],
  ["O que acontece se eu não cancelar antes do teste acabar?", "A cobrança do plano escolhido começa automaticamente no cartão cadastrado, depois dos 30 dias."],
  ["Meus dados ficam seguros?", "Sim, o Modo Criador é muito seguro. Não é à toa que conseguimos aprovação oficial do Google pra integração com Drive e Agenda, e também autorização como desenvolvedor Meta, com acesso à API oficial do Instagram e do Facebook dentro do próprio app. Pra passar por essas revisões, o site precisa cumprir critérios rígidos de segurança e ter uma política de privacidade clara, alinhada à LGPD. Seus dados e os dos seus clientes ficam sempre isolados dos de outras agências."],
];

/** Recursos reais do produto que não têm página de SEO própria (ao
 * contrário dos 5 de `buildSalesKnowledgeText` abaixo) — descritos aqui
 * direto, baseado no comportamento real do app (não é copy de marketing
 * publicada em lugar nenhum, mas é fiel ao que o produto faz). */
export const EXTRA_FEATURES: [string, string][] = [
  [
    "Como é o Preview de Feed dentro do Modo Criador?",
    "É a tela que o cliente vê quando abre o link de aprovação: uma grade de 3 colunas, igual o feed do Instagram, mostrando os posts programados daquele mês na ordem que vão ser publicados — dá pra ver como o feed vai ficar visualmente antes mesmo de postar. Tem uma aba separada pra Stories, num carrossel de círculos. O cliente pode aprovar o feed inteiro do mês com um clique, ou comentar post por post pedindo ajuste — tudo isso sem precisar criar conta nem senha.",
  ],
];

/** Achata o FAQ de vendas + os benefícios/FAQ das 6 páginas de recurso num
 * bloco de texto pro system prompt do chat público. Import dinâmico das 6
 * páginas de recurso (feito só dentro da function, nunca no topo do
 * arquivo) — evita puxar módulos de rota pro grafo de módulos server-only. */
export async function buildSalesKnowledgeText(): Promise<string> {
  const [aprovacao, drive, instagram, selecao, biblioteca, contrato] = await Promise.all([
    import("@/routes/aprovacao-de-conteudo-por-link"),
    import("@/routes/backup-automatico-drive"),
    import("@/routes/publicacao-automatica-instagram"),
    import("@/routes/selecao-de-fotos-para-fotografos"),
    import("@/routes/biblioteca-de-referencias"),
    import("@/routes/assinatura-eletronica-de-contratos"),
  ]);

  const faqText = SALES_FAQ.map(([q, a]) => `P: ${q}\nR: ${a}`).join("\n\n");
  const extraText = EXTRA_FEATURES.map(([q, a]) => `P: ${q}\nR: ${a}`).join("\n\n");

  const features = [aprovacao.CONTENT, drive.CONTENT, instagram.CONTENT, selecao.CONTENT, biblioteca.CONTENT, contrato.CONTENT];
  const featuresText = features.map((f) => {
    const benefits = f.benefits.map((b) => `- ${b.title}: ${b.text}`).join("\n");
    const faq = f.faqGroups.flatMap((g) => g.items).map(([q, a]) => `P: ${q}\nR: ${a}`).join("\n\n");
    return `## ${f.badgeLabel}\n${f.heroSubtitle}\n\nBenefícios:\n${benefits}\n\n${faq}`;
  }).join("\n\n");

  return `DÚVIDAS FREQUENTES GERAIS:\n\n${faqText}\n\n${extraText}\n\nRECURSOS DO MODO CRIADOR:\n\n${featuresText}`;
}
