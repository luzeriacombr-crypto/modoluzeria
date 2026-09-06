import { createFileRoute } from "@tanstack/react-router";
import { BookMarked, Chrome, FolderKanban, Users2, MousePointerClick, Link2 } from "lucide-react";
import { FeatureLandingPage, type FeatureLandingContent } from "@/components/luzeria/FeatureLandingPage";

const TITLE = "Biblioteca de Referências com Extensão de Chrome — Modo Criador";
const DESCRIPTION =
  "Salve qualquer vídeo, post ou site como referência direto de onde você está, com a extensão do Modo Criador pro Chrome. Organiza geral ou por cliente. Teste grátis.";

const CONTENT: FeatureLandingContent = {
  badgeIcon: BookMarked,
  badgeLabel: "Biblioteca de Referências",
  heroLines: [
    "Salve a referência",
    { text: "sem trocar de aba", highlight: true },
    "com a extensão do Chrome",
  ],
  heroSubtitle:
    "Viu um vídeo, post ou site que serve de referência? Clica na extensão do Modo Criador, escolhe se é geral ou de um cliente, e pronto — nada de copiar link na mão.",
  ctaLabel: "Quero testar grátis",
  whatsappMessage: "Oi! Vi a página de Biblioteca de Referências do Modo Criador e quero saber mais.",
  illustrationKey: "dashboard",
  heroBadges: [
    { icon: Chrome, label: "Extensão oficial do Chrome" },
    { icon: MousePointerClick, label: "Salva em 2 cliques" },
    { icon: FolderKanban, label: "Geral ou por cliente" },
  ],
  benefits: [
    {
      icon: MousePointerClick,
      title: "Salva em 2 cliques",
      text: "Título e link já vêm preenchidos sozinhos — você só escolhe onde guardar e confirma.",
    },
    {
      icon: FolderKanban,
      title: "Geral da agência ou de um cliente",
      text: "Uma referência pode servir pra qualquer projeto, ou ser específica de um cliente — você decide na hora de salvar.",
    },
    {
      icon: Users2,
      title: "Toda a equipe com acesso",
      text: "Qualquer pessoa com acesso àquele cliente vê as referências salvas — sem depender de mandar print por WhatsApp.",
    },
    {
      icon: Link2,
      title: "Sem copiar link na mão",
      text: "Acaba aquele fluxo de copiar URL, abrir outra aba, colar em algum lugar e esquecer onde guardou.",
    },
  ],
  steps: [
    { title: "Instala a extensão do Modo Criador no Chrome", text: "Uma vez só, direto da Chrome Web Store." },
    { title: "Vê algo que serve de referência", text: "Um vídeo, post ou site — em qualquer lugar que você estiver navegando." },
    { title: "Clica no ícone da extensão", text: "Título e link já aparecem preenchidos sozinhos, sem precisar copiar nada." },
    { title: "Escolhe geral ou um cliente, e salva", text: "A referência aparece na hora na Biblioteca do Modo Criador, pronta pra consultar depois." },
  ],
  faqGroups: [
    {
      category: "Como funciona",
      items: [
        ["Preciso copiar o link da página manualmente?", "Não — a extensão já lê o título e o link da aba que você está vendo e preenche sozinha."],
        ["Dá pra salvar referência de qualquer site?", "Sim, funciona em qualquer página que você conseguir abrir no Chrome — vídeo, post de rede social, artigo, o que for."],
        ["A extensão lê o conteúdo das páginas que eu visito?", "Não — ela só age quando você clica no ícone, e só lê o título e o link da aba, nada além disso."],
      ],
    },
    {
      category: "Organização e equipe",
      items: [
        ["Qual a diferença entre referência 'geral' e 'de cliente'?", "Geral fica disponível pra qualquer projeto da agência; de cliente fica vinculada só àquele cliente específico."],
        ["Minha equipe também vê as referências salvas?", "Sim, qualquer pessoa com acesso ao cliente (ou à agência, no caso das gerais) vê as referências salvas por qualquer um do time."],
      ],
    },
  ],
  finalTitle: "Vamos organizar as referências da sua agência?",
  finalSubtitle: "Sem compromisso — a gente te mostra como instalar a extensão e salvar a primeira referência.",
  finalCtaLabel: "Quero testar grátis",
};

export const Route = createFileRoute("/biblioteca-de-referencias")({
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
    links: [{ rel: "canonical", href: "https://www.modocriador.com.br/biblioteca-de-referencias" }],
  }),
});
