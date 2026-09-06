import { createFileRoute } from "@tanstack/react-router";
import { Cloud, FolderCheck, ShieldCheck, HardDriveDownload, FolderTree, RefreshCw } from "lucide-react";
import { FeatureLandingPage, type FeatureLandingContent } from "@/components/luzeria/FeatureLandingPage";

const TITLE = "Backup Automático de Conteúdo no Google Drive — Modo Criador";
const DESCRIPTION =
  "Todo post que passa pelo Modo Criador vai organizado sozinho pro Google Drive da sua agência, por cliente e por mês. Nunca mais perca um arquivo. Teste grátis.";

const CONTENT: FeatureLandingContent = {
  badgeIcon: Cloud,
  badgeLabel: "Backup automático",
  heroLines: [
    "Seu conteúdo",
    { text: "nunca some", highlight: true },
    "no Google Drive",
  ],
  heroSubtitle:
    "Cada post publicado vai sozinho pro Drive da sua agência, já organizado por cliente e por mês — sem você precisar lembrar de salvar nada, arquivo por arquivo.",
  ctaLabel: "Quero testar grátis",
  whatsappMessage: "Oi! Vi a página de Backup Automático no Drive do Modo Criador e quero saber mais.",
  illustrationKey: "security",
  heroBadges: [
    { icon: FolderTree, label: "Organizado por cliente e mês" },
    { icon: RefreshCw, label: "Automático, sem esforço" },
    { icon: ShieldCheck, label: "No Drive da sua agência" },
  ],
  benefits: [
    {
      icon: FolderCheck,
      title: "Organização automática",
      text: "Cada arquivo cai numa pasta já separada por cliente e por mês — sem você mexer em nada depois de publicar.",
    },
    {
      icon: HardDriveDownload,
      title: "Fica no SEU Google Drive",
      text: "Não é um armazenamento terceiro que some se você cancelar o plano — os arquivos ficam na conta Google que já é sua.",
    },
    {
      icon: ShieldCheck,
      title: "Nunca mais perde um arquivo",
      text: "Acabou aquele computador que travou, pasta que sumiu ou pen drive que ninguém sabe onde está.",
    },
    {
      icon: RefreshCw,
      title: "Sem passo manual nenhum",
      text: "O backup acontece sozinho no momento em que o conteúdo é aprovado ou publicado — nada pra você lembrar de fazer.",
    },
  ],
  steps: [
    { title: "Conecta sua conta do Google Drive", text: "Uma vez só, direto nas configurações da sua agência." },
    { title: "Trabalha normalmente no calendário", text: "Sobe imagem, legenda, aprova com o cliente — do jeito que você já faz." },
    { title: "O backup acontece sozinho", text: "Cada arquivo vai pra pasta certa do cliente, organizada por mês, sem nenhum clique extra seu." },
    { title: "Acessa quando precisar", text: "Direto pelo Google Drive, do jeito que você já usa — não precisa entrar no Modo Criador pra achar um arquivo antigo." },
  ],
  faqGroups: [
    {
      category: "Como funciona",
      items: [
        ["Os arquivos ficam guardados onde?", "No Google Drive da sua própria agência — você conecta sua conta e os arquivos vão direto pra lá, organizados por cliente e mês."],
        ["Preciso fazer algo manualmente pra ativar o backup de cada post?", "Não, depois de conectar o Drive uma vez, o backup acontece sozinho conforme o conteúdo é aprovado ou publicado."],
        ["Se eu cancelar o plano, perco os arquivos?", "Não — como eles ficam no seu próprio Google Drive, continuam lá independente do que acontecer com sua assinatura."],
      ],
    },
    {
      category: "Organização",
      items: [
        ["Como fica a estrutura de pastas?", "Uma pasta por cliente, com subpastas por mês — assim fica fácil achar qualquer arquivo antigo sem precisar abrir o Modo Criador."],
        ["Dá pra mudar a organização das pastas?", "A estrutura padrão já cobre o uso mais comum de agências com vários clientes; fale com a gente se seu fluxo precisa de algo diferente."],
      ],
    },
  ],
  finalTitle: "Vamos parar de perder arquivo de cliente?",
  finalSubtitle: "Sem compromisso — a gente te mostra como fica a organização das pastas no seu próprio Drive.",
  finalCtaLabel: "Quero testar grátis",
};

export const Route = createFileRoute("/backup-automatico-drive")({
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
    links: [{ rel: "canonical", href: "https://www.modocriador.com.br/backup-automatico-drive" }],
  }),
});
