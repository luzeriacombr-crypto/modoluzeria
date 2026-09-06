import { createFileRoute } from "@tanstack/react-router";
import { Instagram, CalendarClock, BadgeCheck, Layers, Zap } from "lucide-react";
import { FeatureLandingPage, type FeatureLandingContent } from "@/components/luzeria/FeatureLandingPage";

const TITLE = "Publicação Automática no Instagram — Modo Criador";
const DESCRIPTION =
  "Agenda o post aprovado e ele vai sozinho pro Instagram do cliente, no feed ou nos reels, sem precisar copiar, colar ou publicar na mão. Teste grátis.";

const CONTENT: FeatureLandingContent = {
  badgeIcon: Instagram,
  badgeLabel: "Publicação automática",
  heroLines: [
    "O post aprovado",
    { text: "publica sozinho", highlight: true },
    "no Instagram",
  ],
  heroSubtitle:
    "Sem copiar imagem, sem colar legenda, sem abrir o Instagram do cliente na mão. Depois de aprovado, o Modo Criador publica no horário agendado — feed ou reels.",
  ctaLabel: "Quero testar grátis",
  whatsappMessage: "Oi! Vi a página de Publicação Automática no Instagram do Modo Criador e quero saber mais.",
  illustrationKey: "calendar",
  heroBadges: [
    { icon: BadgeCheck, label: "Integração aprovada pela Meta" },
    { icon: CalendarClock, label: "Agenda com antecedência" },
    { icon: Layers, label: "Feed e Reels" },
  ],
  benefits: [
    {
      icon: Zap,
      title: "Zero publicação manual",
      text: "Depois que o cliente aprova, você não precisa mais abrir o Instagram dele pra postar — o Modo Criador publica sozinho.",
    },
    {
      icon: CalendarClock,
      title: "Agenda com a antecedência que quiser",
      text: "Monta o mês inteiro de conteúdo aprovado e deixa programado, sem depender de estar online na hora certa.",
    },
    {
      icon: Layers,
      title: "Feed e Reels",
      text: "Funciona pros dois formatos, então o planejamento de conteúdo não fica travado só em imagem estática.",
    },
    {
      icon: BadgeCheck,
      title: "Integração oficial, aprovada pela Meta",
      text: "Não é um gambiarra por fora — é uma integração oficial com a API do Instagram, liberada em produção pra qualquer conta.",
    },
  ],
  steps: [
    { title: "Conecta a conta do Instagram do cliente", text: "Uma vez só, direto no painel daquele cliente." },
    { title: "Sobe o conteúdo e passa pela aprovação", text: "O fluxo normal do Modo Criador — calendário, aprovação por link, tudo integrado." },
    { title: "Define a data e hora de publicação", text: "Agenda quando quiser, com a antecedência que fizer sentido pro seu planejamento." },
    { title: "O post publica sozinho no horário certo", text: "Sem você precisar estar online, copiar arquivo ou abrir o Instagram na hora." },
  ],
  faqGroups: [
    {
      category: "Como funciona",
      items: [
        ["Preciso ter acesso ao Instagram do cliente?", "Sim, é preciso conectar a conta profissional do Instagram do cliente uma vez — depois disso a publicação acontece sozinha."],
        ["Funciona pra Reels também, ou só feed?", "Funciona pros dois formatos."],
        ["E se eu precisar mudar o post depois de agendado?", "Dá pra ajustar ou remarcar antes do horário programado, direto no calendário do Modo Criador."],
      ],
    },
    {
      category: "Confiabilidade",
      items: [
        ["É uma integração oficial ou um gambiarra?", "É integração oficial com a API do Instagram (Meta), com o App Review aprovado — não depende de automação por fora que pode parar de funcionar do nada."],
        ["Funciona pra qualquer conta de cliente?", "Sim, a liberação em produção cobre qualquer conta profissional do Instagram conectada, não só contas de teste."],
      ],
    },
  ],
  finalTitle: "Vamos parar de publicar na mão?",
  finalSubtitle: "Sem compromisso — a gente te mostra como conectar a primeira conta de Instagram.",
  finalCtaLabel: "Quero testar grátis",
};

export const Route = createFileRoute("/publicacao-automatica-instagram")({
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
    links: [{ rel: "canonical", href: "https://www.modocriador.com.br/publicacao-automatica-instagram" }],
  }),
});
