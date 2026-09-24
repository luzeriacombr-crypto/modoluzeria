import { createFileRoute } from "@tanstack/react-router";
import { PenLine, Lock, FileText, Smartphone, Send } from "lucide-react";
import { FeatureLandingPage, type FeatureLandingContent } from "@/components/luzeria/FeatureLandingPage";

const TITLE = "Contrato com Assinatura Eletrônica — Modo Criador";
const DESCRIPTION =
  "Manda o contrato por link, o cliente digita nome e CPF e assina com o dedo na tela — sem imprimir, sem PDF perdido no WhatsApp. Teste grátis.";

export const CONTENT: FeatureLandingContent = {
  badgeIcon: PenLine,
  badgeLabel: "Assinatura eletrônica",
  heroLines: [
    "O contrato sai",
    { text: "assinado", highlight: true },
    "sem imprimir nada",
  ],
  heroSubtitle:
    "Manda o link do contrato pro cliente, ele digita nome e CPF e assina com o dedo na tela. Sem imprimir, sem escanear, sem PDF perdido no meio do WhatsApp.",
  ctaLabel: "Quero testar grátis",
  whatsappMessage: "Oi! Vi a página de Contrato com Assinatura Eletrônica do Modo Criador e quero saber mais.",
  illustrationKey: "signature",
  heroBadges: [
    { icon: Smartphone, label: "Assina pelo celular" },
    { icon: Lock, label: "Sem login, sem senha" },
    { icon: FileText, label: "Seu próprio modelo" },
  ],
  benefits: [
    {
      icon: FileText,
      title: "O modelo é seu",
      text: "Cadastre o texto do seu contrato uma vez, com campos como nome do cliente, valor e vencimento — o Modo Criador monta o documento sozinho pra cada novo fechamento.",
    },
    {
      icon: Send,
      title: "Manda por link, sem PDF",
      text: "Nada de anexar arquivo e esperar o cliente imprimir, assinar, escanear e devolver. É um link só, direto no WhatsApp ou e-mail.",
    },
    {
      icon: PenLine,
      title: "Assina com o dedo, na hora",
      text: "O cliente abre o link no celular ou computador, confere o contrato, digita nome e CPF e desenha a própria assinatura na tela.",
    },
    {
      icon: Lock,
      title: "Sem criar conta",
      text: "Assim como no link de aprovação de conteúdo, o cliente não precisa de login nem senha pra assinar.",
    },
  ],
  steps: [
    { title: "Cadastre o modelo do seu contrato", text: "Uma vez só, com os campos que variam de cliente pra cliente (nome, valor, vencimento, quantidade de posts...)." },
    { title: "Gere o contrato pra um cliente novo", text: "O Modo Criador preenche o modelo sozinho com os dados daquele fechamento." },
    { title: "Manda o link pro cliente", text: "Por WhatsApp, e-mail, ou como preferir — sem precisar anexar arquivo nenhum." },
    { title: "Ele lê e assina na tela", text: "Digita nome e CPF e desenha a assinatura com o dedo ou o mouse. Pronto, registrado." },
  ],
  faqGroups: [
    {
      category: "Como funciona",
      items: [
        ["Preciso criar um contrato do zero pra cada cliente?", "Não. Você cadastra o modelo (o texto padrão da sua agência) uma vez, com os campos que mudam de cliente pra cliente, e o Modo Criador monta o documento sozinho a cada novo fechamento."],
        ["O cliente precisa instalar algo ou criar conta?", "Não. Ele recebe um link, abre no navegador do celular ou computador, e assina direto — sem cadastro."],
        ["Onde fica guardada a assinatura?", "O nome, o CPF, a assinatura desenhada e a data ficam registrados junto com aquele contrato, dentro do Modo Criador."],
      ],
    },
    {
      category: "Validade",
      items: [
        ["Isso é a mesma coisa que assinatura digital certificada (ICP-Brasil)?", "Não. É uma assinatura eletrônica simples — o cliente desenha a própria assinatura na tela, com nome, CPF e data registrados. Não passa por um certificado digital ICP-Brasil nem por verificação de identidade por terceiros, então não tem o mesmo peso jurídico de uma assinatura digital certificada."],
        ["Isso substitui contrato assinado em papel ou em cartório?", "Pra a maioria das agências, resolve o dia a dia de formalizar um fechamento rapidamente. Se você precisa de validade jurídica reforçada pra um caso específico, vale confirmar com um advogado se a assinatura eletrônica simples atende."],
      ],
    },
  ],
  finalTitle: "Vamos parar de perder contrato no WhatsApp?",
  finalSubtitle: "Sem compromisso — a gente te mostra como cadastrar seu primeiro modelo de contrato.",
  finalCtaLabel: "Quero testar grátis",
};

export const Route = createFileRoute("/assinatura-eletronica-de-contratos")({
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
    links: [{ rel: "canonical", href: "https://www.modocriador.com.br/assinatura-eletronica-de-contratos" }],
  }),
});
