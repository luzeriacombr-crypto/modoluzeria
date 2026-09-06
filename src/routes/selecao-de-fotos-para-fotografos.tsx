import { createFileRoute } from "@tanstack/react-router";
import { Image, ShieldCheck, Users2, Link2, Lock, ArrowDownWideNarrow } from "lucide-react";
import { FeatureLandingPage, type FeatureLandingContent } from "@/components/luzeria/FeatureLandingPage";

const TITLE = "Seleção de Fotos pra Fotógrafos — Modo Criador";
const DESCRIPTION =
  "Cliente escolhe as fotos favoritas por um link, sem criar conta, direto da sua pasta do Google Drive — com marca d'água automática contra roubo. Teste grátis.";

const CONTENT: FeatureLandingContent = {
  badgeIcon: Image,
  badgeLabel: "Seleção de fotos por link",
  heroLines: [
    "Seu cliente escolhe",
    { text: "as fotos dele", highlight: true },
    "sem sair do link",
  ],
  heroSubtitle:
    "Manda um link, ele vê a galeria inteira já com marca d'água contra print e roubo, escolhe as favoritas e pronto — você recebe a lista certinha, sem ida e volta por WhatsApp.",
  ctaLabel: "Quero testar grátis",
  whatsappMessage: "Oi! Vi a página de Seleção de Fotos do Modo Criador e quero saber mais.",
  illustrationKey: "feedPreview",
  heroBadges: [
    { icon: Lock, label: "Marca d'água automática" },
    { icon: Users2, label: "Sem o cliente criar conta" },
    { icon: Link2, label: "Direto da pasta do Drive" },
  ],
  benefits: [
    {
      icon: ShieldCheck,
      title: "Marca d'água queimada na imagem",
      text: "Não é um overlay de CSS que qualquer print ignora — a marca (texto ou logo da sua agência) fica nos pixels da foto que o cliente vê.",
    },
    {
      icon: Image,
      title: "Você escolhe a foto de capa",
      text: "Nada de deixar por conta do acaso: a capa da galeria é a que você decidir, não a primeira foto da pasta.",
    },
    {
      icon: ArrowDownWideNarrow,
      title: "Ordem por nome ou por horário",
      text: "Monta a galeria na ordem que fizer mais sentido pro ensaio — cronológica (horário real da foto) ou por nome do arquivo.",
    },
    {
      icon: Users2,
      title: "Mais de uma pessoa pode responder",
      text: "Noivo e noiva, cada familiar — todo mundo usa o mesmo link, escolhe suas fotos e digita o nome. Você vê cada resposta separada.",
    },
  ],
  steps: [
    { title: "Cola o link da pasta do Google Drive", text: "A mesma pasta onde você já organiza as fotos do ensaio — não precisa subir nada em lugar novo." },
    { title: "Escolhe a capa e a ordem", text: "Define qual foto abre a galeria e se a ordem é por nome ou pelo horário real de cada clique." },
    { title: "Manda o link pro cliente", text: "Ele abre, vê a galeria em tela cheia com a marca d'água da sua agência, e marca as fotos favoritas." },
    { title: "Recebe a lista pronta", text: "Cada resposta chega organizada no seu painel, com o nome de quem escolheu — pronta pra virar o código do Lightroom." },
  ],
  fit: {
    yes: [
      "Entrega ensaios ou eventos com dezenas (ou centenas) de fotos pro cliente escolher",
      "Já se incomodou com fotos de prévia sendo usadas sem autorização antes da entrega final",
      "Quer parar de mandar pasta de Drive crua, sem controle de quem viu ou escolheu o quê",
      "Usa Google Drive pra organizar as fotos e não quer trocar de fluxo de trabalho",
    ],
    no: [
      "Já usa uma ferramenta de seleção e está satisfeito com ela",
      "Entrega poucas fotos por vez e prefere combinar direto por mensagem",
      "Não guarda as fotos no Google Drive",
      "Só quer testar por curiosidade, sem cliente real pra usar agora",
    ],
  },
  included: {
    items: [
      "Galeria pública por link, sem o cliente precisar criar conta nem senha",
      "Marca d'água configurável — texto personalizado ou logo da sua agência",
      "Capa e ordem da galeria (nome ou horário) escolhidas por você",
      "Várias pessoas podem responder ao mesmo link, cada uma com seu nome",
      "Prazo de seleção e opção de encerrar o link manualmente quando quiser",
    ],
  },
  faqGroups: [
    {
      category: "Como funciona",
      items: [
        ["Preciso subir as fotos em algum lugar novo?", "Não. Você só cola o link da pasta do Google Drive onde as fotos já estão. O Modo Criador lê direto de lá."],
        ["O cliente precisa criar conta pra escolher as fotos?", "Não. Ele abre o link, vê a galeria e escolhe — só digita o nome dele na hora de finalizar, pra você saber quem respondeu."],
        ["Consigo saber quais fotos cada pessoa escolheu?", "Sim. Se mais de uma pessoa usar o mesmo link (ex: noivo e noiva), cada resposta aparece separada no seu painel, com o nome de quem escolheu."],
      ],
    },
    {
      category: "Proteção das fotos",
      items: [
        ["A marca d'água realmente protege contra roubo?", "Ela é aplicada nos pixels da própria imagem antes de chegar ao navegador do cliente — não é um efeito visual que some com um print ou clique direito."],
        ["Dá pra usar minha logo em vez de um texto?", "Sim, a marca d'água aceita tanto texto configurável quanto uma imagem (PNG) da sua agência, em grade repetida sobre a foto."],
      ],
    },
    {
      category: "Preço e teste",
      items: [
        ["A Seleção de Fotos custa separado?", "Ela já faz parte do Modo Criador, junto com o resto da gestão de conteúdo pra agências e fotógrafos."],
        ["Posso testar antes de decidir?", "Sim, o teste grátis de 30 dias cobre a Seleção de Fotos também."],
      ],
    },
  ],
  finalTitle: "Vamos organizar a seleção do seu próximo ensaio?",
  finalSubtitle: "Sem compromisso — a gente te mostra como funciona na prática, com sua própria pasta do Drive.",
  finalCtaLabel: "Quero testar grátis",
};

export const Route = createFileRoute("/selecao-de-fotos-para-fotografos")({
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
    links: [{ rel: "canonical", href: "https://www.modocriador.com.br/selecao-de-fotos-para-fotografos" }],
  }),
});
