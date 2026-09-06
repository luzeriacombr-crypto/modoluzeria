import { createFileRoute } from "@tanstack/react-router";
import { Link2, MessageSquareText, CheckCircle2, History, MousePointerClick, KeyRound } from "lucide-react";
import { FeatureLandingPage, type FeatureLandingContent } from "@/components/luzeria/FeatureLandingPage";

const TITLE = "Aprovação de Conteúdo por Link, Sem o Cliente Criar Conta — Modo Criador";
const DESCRIPTION =
  "Seu cliente aprova ou pede ajuste em cada post por um link, sem senha e sem app. Chega de aprovação perdida no meio de conversa de WhatsApp. Teste grátis.";

const CONTENT: FeatureLandingContent = {
  badgeIcon: Link2,
  badgeLabel: "Aprovação por link",
  heroLines: [
    "Seu cliente aprova",
    { text: "sem criar conta", highlight: true },
    "nem baixar nada",
  ],
  heroSubtitle:
    "Um link só, sem senha: o cliente vê o post, aprova ou deixa um comentário dizendo o que precisa mudar — e some aquele vaivém de aprovação perdida no meio da conversa do WhatsApp.",
  ctaLabel: "Quero testar grátis",
  whatsappMessage: "Oi! Vi a página de Aprovação por Link do Modo Criador e quero saber mais.",
  illustrationKey: "feedPreview",
  heroBadges: [
    { icon: KeyRound, label: "Sem senha pro cliente" },
    { icon: MousePointerClick, label: "Aprova em 1 clique" },
    { icon: History, label: "Histórico de tudo" },
  ],
  benefits: [
    {
      icon: KeyRound,
      title: "Zero fricção pro cliente",
      text: "Ele não precisa lembrar senha, baixar app nem criar cadastro — abre o link, vê o conteúdo, decide.",
    },
    {
      icon: CheckCircle2,
      title: "Aprovação com 1 clique",
      text: "Post aprovado já muda de status no seu painel na hora — sem você precisar perguntar 'e aí, ficou bom?'.",
    },
    {
      icon: MessageSquareText,
      title: "Comentário direto no post certo",
      text: "Se precisar de ajuste, o comentário fica anexado àquele conteúdo específico — não se perde solto numa conversa antiga.",
    },
    {
      icon: History,
      title: "Histórico de quem aprovou o quê",
      text: "Cada aprovação fica registrada com data — útil quando o cliente pergunta 'mas eu aprovei isso mesmo?'.",
    },
  ],
  steps: [
    { title: "Você sobe o conteúdo no calendário", text: "Imagem, legenda e data — igual você já organiza no Modo Criador." },
    { title: "Gera o link de aprovação daquele cliente", text: "Um link único por cliente, sem precisar reenviar toda vez." },
    { title: "Cliente abre e decide", text: "Aprova com um clique ou deixa um comentário pedindo ajuste — direto do celular, sem instalar nada." },
    { title: "Você vê o status mudar na hora", text: "O painel já mostra o que foi aprovado e o que ainda precisa de retorno, sem precisar perguntar." },
  ],
  faqGroups: [
    {
      category: "Como funciona",
      items: [
        ["O cliente precisa criar login pra aprovar?", "Não. Ele recebe um link único e abre direto — sem senha, sem cadastro."],
        ["Dá pra aprovar pelo celular?", "Sim, a tela de aprovação funciona bem em qualquer navegador de celular, sem precisar de app."],
        ["O que acontece se o cliente pedir ajuste?", "O comentário dele fica anexado ao post específico, visível no seu painel — você sabe exatamente o que mudar."],
      ],
    },
    {
      category: "Controle e segurança",
      items: [
        ["Qualquer pessoa com o link consegue aprovar por engano?", "O link é único por cliente e só mostra o conteúdo daquele cliente — ninguém vê ou aprova conteúdo de outra conta pelo mesmo link."],
        ["Fico com um histórico de quem aprovou o quê?", "Sim, cada aprovação fica registrada com data no seu painel."],
      ],
    },
  ],
  finalTitle: "Vamos acabar com o vaivém de aprovação?",
  finalSubtitle: "Sem compromisso — a gente te mostra como fica a tela de aprovação do jeito que seu cliente vê.",
  finalCtaLabel: "Quero testar grátis",
};

export const Route = createFileRoute("/aprovacao-de-conteudo-por-link")({
  component: () => <FeatureLandingPage content={CONTENT} />,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: "https://www.modocriador.com.br/aprovacao-de-conteudo-por-link" }],
  }),
});
