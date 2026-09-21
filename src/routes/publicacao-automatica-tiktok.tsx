import { createFileRoute } from "@tanstack/react-router";
import { Music2, CalendarClock, ShieldCheck, SlidersHorizontal, Zap, Unplug } from "lucide-react";
import { FeatureLandingPage, type FeatureLandingContent } from "@/components/luzeria/FeatureLandingPage";

const TITLE = "Publicação no TikTok — Modo Criador";
const DESCRIPTION =
  "Conecta o TikTok do cliente e publica ou agenda o vídeo aprovado direto do Modo Criador, com você escolhendo a privacidade e as interações de cada vídeo.";

export const CONTENT: FeatureLandingContent = {
  badgeIcon: Music2,
  badgeLabel: "Publicação no TikTok",
  heroLines: [
    "Do calendário",
    { text: "direto pro TikTok", highlight: true },
  ],
  heroSubtitle:
    "Depois que o vídeo é aprovado, o Modo Criador envia pro TikTok do cliente — agora ou no horário agendado. Você define a privacidade e as interações de cada vídeo antes de publicar.",
  ctaLabel: "Quero saber mais",
  whatsappMessage: "Oi! Vi a página de Publicação no TikTok do Modo Criador e quero saber mais.",
  illustrationKey: "calendar",
  heroBadges: [
    { icon: ShieldCheck, label: "Login oficial do TikTok" },
    { icon: SlidersHorizontal, label: "Você escolhe cada opção" },
    { icon: Unplug, label: "Desconecta quando quiser" },
  ],
  benefits: [
    {
      icon: Zap,
      title: "Menos copiar e colar",
      text: "O vídeo aprovado sai do Modo Criador direto pro TikTok do cliente, sem baixar arquivo, abrir o app e subir na mão.",
    },
    {
      icon: CalendarClock,
      title: "Publica agora ou agenda",
      text: "Escolhe entre publicar na hora ou deixar programado pra data e horário definidos no calendário do conteúdo.",
    },
    {
      icon: SlidersHorizontal,
      title: "Você decide como o vídeo sai",
      text: "Privacidade, comentários, Dueto, Stitch e a marcação de conteúdo comercial são escolhidos por você em cada vídeo, nada vem marcado por padrão.",
    },
    {
      icon: ShieldCheck,
      title: "Acesso limitado ao necessário",
      text: "Usamos o login oficial do TikTok. Lemos só o nome e a foto da conta pra mostrar qual perfil está conectado, e nada é publicado sem uma ação sua.",
    },
  ],
  steps: [
    { title: "Conecta a conta do TikTok do cliente", text: "Uma vez só, na Ficha do Cliente, autorizando pelo próprio TikTok." },
    { title: "Sobe o vídeo e passa pela aprovação", text: "O fluxo normal do Modo Criador — calendário, aprovação por link, tudo integrado." },
    { title: "Escolhe as opções de publicação", text: "Privacidade, comentários, Dueto, Stitch e conteúdo comercial, vídeo a vídeo." },
    { title: "Publica agora ou agenda", text: "O vídeo é enviado pro TikTok e o item fica marcado como finalizado." },
  ],
  faqGroups: [
    {
      category: "Como funciona",
      items: [
        ["Preciso da senha do TikTok do cliente?", "Não. A conexão usa o login oficial do TikTok: quem é dono da conta autoriza na tela do próprio TikTok, e o Modo Criador nunca vê a senha."],
        ["O que o Modo Criador acessa na conta?", "O nome de exibição e a foto do perfil, só pra mostrar qual conta está conectada, e a permissão de enviar vídeos quando você pede. Não lemos vídeos, mensagens, seguidores nem outros dados da conta."],
        ["Funciona pra foto ou só vídeo?", "Por enquanto, só vídeo (Posts e Reels com vídeo anexado)."],
      ],
    },
    {
      category: "Controle e privacidade",
      items: [
        ["Dá pra desconectar?", "Sim, a qualquer momento na Ficha do Cliente. Ao desconectar, o acesso é revogado no TikTok e os dados de conexão são apagados do Modo Criador. Também dá pra revogar pelas configurações do próprio TikTok."],
        ["Alguma coisa é publicada sem eu pedir?", "Não. Todo vídeo só é enviado quando você clica em publicar ou agenda uma publicação, com as opções que você escolheu."],
        ["Onde vejo como tratamos os dados?", "Na nossa Política de Privacidade, em modocriador.com.br/privacidade."],
      ],
    },
  ],
  finalTitle: "Quer publicar no TikTok sem sair do Modo Criador?",
  finalSubtitle: "Fala com a gente e a gente te mostra como conectar a primeira conta.",
  finalCtaLabel: "Quero saber mais",
};

export const Route = createFileRoute("/publicacao-automatica-tiktok")({
  component: () => <FeatureLandingPage content={CONTENT} />,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      // Sem indexar por enquanto: a integração ainda está em fase de testes
      // (app do TikTok em revisão). Tirar esta linha ao liberar pras agências.
      { name: "robots", content: "noindex" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: "https://www.modocriador.com.br/publicacao-automatica-tiktok" }],
  }),
});
