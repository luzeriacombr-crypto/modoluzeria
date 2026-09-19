// Fonte única de conhecimento pro Chat do Modo Criador na página pública de
// vendas (/assinar) — reaproveita texto de marketing já aprovado (a página
// de vendas em si + as 5 páginas de recurso por SEO), nunca inventa copy
// nova. `SALES_FAQ` também é a fonte da seção "Dúvidas frequentes" da
// própria SalesPage.tsx (edita aqui, atualiza os dois lugares).

export const SALES_FAQ: [string, string][] = [
  ["Preciso saber mexer em tecnologia?", "Não. É muito intuitivo usar o Modo Criador. (Bem mais fácil que o ClickUp e Trello.)"],
  ["Estou vindo de outra plataforma, consigo migrar meus clientes?", "Sim, criamos um sistema que você consegue colocar toda a sua operação dentro do Modo Criador com rapidez."],
  ["Meu cliente precisa criar conta pra aprovar o conteúdo?", "Não. Ele recebe um link público, com a sua marca, e aprova direto, sem cadastro."],
  ["Funciona pra qualquer tipo de agência?", "Sim, foi feito pra qualquer agência ou social media que gerencia múltiplos clientes."],
  ["Posso trocar de plano depois?", "Sim, a qualquer momento nas configurações da sua conta."],
  ["O que acontece se eu não cancelar antes do teste acabar?", "A cobrança do plano escolhido começa automaticamente no cartão cadastrado, depois dos 30 dias."],
  ["Meus dados ficam seguros?", "Sim. Seus dados e os dos seus clientes ficam isolados dos de outras agências, com infraestrutura segura."],
];

/** Achata o FAQ de vendas + os benefícios/FAQ das 5 páginas de recurso num
 * bloco de texto pro system prompt do chat público. Import dinâmico das 5
 * páginas de recurso (feito só dentro da function, nunca no topo do
 * arquivo) — evita puxar módulos de rota pro grafo de módulos server-only. */
export async function buildSalesKnowledgeText(): Promise<string> {
  const [aprovacao, drive, instagram, selecao, biblioteca] = await Promise.all([
    import("@/routes/aprovacao-de-conteudo-por-link"),
    import("@/routes/backup-automatico-drive"),
    import("@/routes/publicacao-automatica-instagram"),
    import("@/routes/selecao-de-fotos-para-fotografos"),
    import("@/routes/biblioteca-de-referencias"),
  ]);

  const faqText = SALES_FAQ.map(([q, a]) => `P: ${q}\nR: ${a}`).join("\n\n");

  const features = [aprovacao.CONTENT, drive.CONTENT, instagram.CONTENT, selecao.CONTENT, biblioteca.CONTENT];
  const featuresText = features.map((f) => {
    const benefits = f.benefits.map((b) => `- ${b.title}: ${b.text}`).join("\n");
    const faq = f.faqGroups.flatMap((g) => g.items).map(([q, a]) => `P: ${q}\nR: ${a}`).join("\n\n");
    return `## ${f.badgeLabel}\n${f.heroSubtitle}\n\nBenefícios:\n${benefits}\n\n${faq}`;
  }).join("\n\n");

  return `DÚVIDAS FREQUENTES GERAIS:\n\n${faqText}\n\nRECURSOS DO MODO CRIADOR:\n\n${featuresText}`;
}
