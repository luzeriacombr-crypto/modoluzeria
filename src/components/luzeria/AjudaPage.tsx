import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ExternalLink, Image as ImageIcon, MessageCircle, Video, Send } from "lucide-react";
import { useMe, useApi, myBugReportsQO, allBugReportsQO } from "@/lib/luzeria/queries";
import type { MyBugReport, AllBugReport, BugReportStatus } from "@/lib/luzeria/bug-reports.functions";
import { ForumTab } from "./ForumTab";
import tutorialAddPost from "@/assets/tutorials/tutorial-add-post.png";
import tutorialFormato from "@/assets/tutorials/tutorial-formato.png";
import tutorialNovaAutomacao from "@/assets/tutorials/tutorial-nova-automacao.png";
import tutorialEquipeCard from "@/assets/tutorials/tutorial-equipe-card.png";
import tutorialEnviarFoto from "@/assets/tutorials/tutorial-enviar-foto.png";

type Tab = "faq" | "tutoriais" | "minhas" | "todas" | "forum";

const FAQ: { category: string; items: { q: string; a: string }[] }[] = [
  {
    category: "Conteúdo (Posts, Reels e Rotina)",
    items: [
      { q: "Como funcionam os cards de Posts e Reels?", a: "Cada post ou reel aparece como um card com capa, status, responsável e prazo. Clique no card pra abrir os detalhes completos (copy, checklist, comentários, arquivos)." },
      { q: "O que é o campo Estático/Carrossel?", a: "É o formato do post. No resumo em cards só aparece o formato já escolhido — pra mudar, abra o post clicando nele e use a seção \"Formato\"." },
      { q: "Como funciona a Rotina?", a: "É a lista de tarefas de organização/limpeza da agência, com um calendário por dia. O Admin Master pode editar a lista de tarefas direto na tela." },
    ],
  },
  {
    category: "Equipe e automações",
    items: [
      { q: "Como envio uma foto de perfil pra um colega que ainda não tem?", a: "Em Configurações → Equipe, clique no card do colaborador — abre um modal onde o Admin Master pode enviar ou trocar a foto dele." },
      { q: "Esqueci minha senha, e agora?", a: "Peça pro Admin Master da sua agência: Configurações → Equipe → clique no seu card → \"Resetar senha\". Você recebe um link por e-mail." },
      { q: "Como funcionam as Automações?", a: "Em Configurações → Automações, o Admin Master pode criar regras do tipo \"quando o status virar X, então alterar status para Y (ou atribuir para alguém)\". Elas rodam sozinhas, mesmo sem ninguém com a tela aberta." },
    ],
  },
  {
    category: "Clientes e arquivos",
    items: [
      { q: "Como meu cliente aprova um post sem ter conta?", a: "Cada cliente tem um link público (aba \"Preview de Feed\" dentro do cliente). Manda esse link — o cliente aprova ou comenta direto, sem login." },
      { q: "Como funciona o backup no Google Drive?", a: "Conecte sua conta do Drive em Configurações → Drive. Os arquivos enviados nos posts/reels são organizados automaticamente lá, por cliente e mês." },
    ],
  },
  {
    category: "Suporte",
    items: [
      { q: "Como reporto um problema ou peço uma sugestão?", a: "Use o ícone de interrogação (?) ao lado do sino de notificações, em qualquer tela. Você também pode acompanhar o que já reportou na aba \"Minhas solicitações\" aqui em cima." },
    ],
  },
];

const TUTORIALS: { title: string; steps: string[]; images?: { src: string; alt: string }[]; videoUrl?: string }[] = [
  {
    title: "Criar um novo post ou reel",
    steps: [
      "Abra o cliente e escolha a aba Posts ou Reels.",
      "Clique no card tracejado \"Adicionar Post/Reel\" no fim da lista.",
      "Clique no título do card pra dar um nome a ele.",
      "Defina status, responsável e prazo direto pelo card.",
    ],
    images: [{ src: tutorialAddPost, alt: "Card tracejado \"Adicionar Posts\" no fim do grid" }],
  },
  {
    title: "Marcar um post como Estático ou Carrossel",
    steps: [
      "Clique no card do post pra abrir os detalhes.",
      "Na seção \"Formato\", escolha Estático ou Carrossel.",
      "Isso só pode ser mudado dentro do post — no resumo em cards ele só aparece pra leitura.",
    ],
    images: [{ src: tutorialFormato, alt: "Seção Formato dentro do post, com as opções Estático e Carrossel" }],
  },
  {
    title: "Conectar o Google Drive",
    steps: [
      "Vá em Configurações → Drive.",
      "Clique em conectar e faça login com a conta Google da agência.",
      "Pronto — os arquivos enviados nos posts passam a ser organizados lá automaticamente.",
    ],
    videoUrl: "https://youtu.be/UhX1xvRlMSM?si=in2xsAV4x2xDNxOw",
  },
  {
    title: "Criar uma automação",
    steps: [
      "Vá em Configurações → Automações (só Admin Master).",
      "Clique em \"Nova automação\".",
      "Escolha o status de gatilho e a ação (alterar status ou atribuir membro).",
      "Salve — a regra passa a rodar sozinha a partir daí.",
    ],
    images: [{ src: tutorialNovaAutomacao, alt: "Botão \"Nova automação\" na aba Automações" }],
  },
  {
    title: "Adicionar foto de um colaborador",
    steps: [
      "Vá em Configurações → Equipe (só Admin Master).",
      "Clique no card da pessoa.",
      "Clique em \"Enviar foto\" e escolha a imagem.",
    ],
    images: [
      { src: tutorialEquipeCard, alt: "Grid de cards da equipe — clique no card de um colaborador" },
      { src: tutorialEnviarFoto, alt: "Botão \"Enviar foto\" dentro do modal do colaborador" },
    ],
  },
];

export function AjudaPage({ initialTab }: { initialTab?: string } = {}) {
  const me = useMe().data;
  const disabled = new Set(me?.disabledFeatures ?? []);
  const forumEnabled = me?.role === "master" && !disabled.has("forum");
  const validTabs = ["faq", "tutoriais", "minhas", "todas", ...(forumEnabled ? ["forum"] : [])];
  const [tab, setTab] = useState<Tab>(validTabs.includes(initialTab ?? "") ? (initialTab as Tab) : "faq");

  const tabs: { id: Tab; label: string }[] = [
    { id: "faq", label: "Perguntas frequentes" },
    { id: "tutoriais", label: "Tutoriais" },
    { id: "minhas", label: "Minhas solicitações" },
    ...(me?.isPlatformAdmin ? [{ id: "todas" as Tab, label: "Todas as solicitações" }] : []),
    ...(forumEnabled ? [{ id: "forum" as Tab, label: "Fórum" }] : []),
  ];

  return (
    <div className={`p-10 mx-auto ${tab === "forum" ? "max-w-6xl" : "max-w-4xl"}`}>
      <h1 className="text-[32px] font-bold text-white tracking-tight">Central de ajuda</h1>
      <p className="text-sm text-white/50 mt-2">Dúvidas frequentes, tutoriais, o histórico do que você já reportou e o fórum entre agências.</p>

      <div className="flex items-center gap-1 border-b border-white/10 mt-6 mb-6 flex-wrap">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors -mb-px border-b-2"
              style={{
                color: active ? "rgb(var(--lz-brand-rgb))" : "rgba(255,255,255,0.5)",
                borderColor: active ? "rgb(var(--lz-brand-rgb))" : "transparent",
              }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "faq" && (
        <div className="space-y-8">
          {FAQ.map((group) => (
            <div key={group.category}>
              <h2 className="text-xs uppercase font-bold text-white/50 tracking-wider mb-3">{group.category}</h2>
              <div className="space-y-3">
                {group.items.map((item) => <FaqItem key={item.q} question={item.q} answer={item.a} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "tutoriais" && (
        <div className="space-y-4">
          {TUTORIALS.map((t) => (
            <div key={t.title} className="bg-[#1C1C1C] rounded-lg p-5">
              <div className="font-bold text-white mb-3">{t.title}</div>
              <ol className="space-y-1.5 list-decimal list-inside">
                {t.steps.map((s, i) => (
                  <li key={i} className="text-sm text-white/60 leading-relaxed">{s}</li>
                ))}
              </ol>
              {t.videoUrl && (
                <a
                  href={t.videoUrl}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 mt-4 text-xs font-semibold rounded-full transition-opacity hover:opacity-80"
                  style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "rgb(var(--lz-brand-rgb))" }}
                >
                  <Video size={13} /> Vídeo: como conectar o Google Drive
                </a>
              )}
              {t.images && t.images.length > 0 && (
                <div className={`mt-4 grid gap-3 ${t.images.length > 1 ? "sm:grid-cols-2" : ""}`}>
                  {t.images.map((img) => (
                    <img key={img.src} src={img.src} alt={img.alt} className="w-full h-auto rounded-md border border-white/10" />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "minhas" && <MinhasSolicitacoes />}
      {tab === "todas" && me?.isPlatformAdmin && <TodasSolicitacoes />}
      {tab === "forum" && forumEnabled && <ForumTab />}
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-[#1C1C1C] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left px-5 py-4"
      >
        <span className="font-semibold text-sm text-white">{question}</span>
        <ChevronDown size={16} className="shrink-0 text-white/50 transition-transform" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>
      {open && <p className="text-white/60 text-sm leading-relaxed px-5 pb-4">{answer}</p>}
    </div>
  );
}

const STATUS_LABEL: Record<BugReportStatus, string> = {
  novo: "Novo",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
};
const STATUS_STYLE: Record<BugReportStatus, { bg: string; color: string }> = {
  novo: { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" },
  em_andamento: { bg: "rgba(250,204,21,0.15)", color: "#FACC15" },
  resolvido: { bg: "rgba(74,222,128,0.15)", color: "#4ADE80" },
};
const STATUS_ORDER: BugReportStatus[] = ["novo", "em_andamento", "resolvido"];

function StatusBadge({ status }: { status: BugReportStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: s.bg, color: s.color }}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function BugReportRow({ report, showOrigin }: { report: MyBugReport | AllBugReport; showOrigin?: boolean }) {
  const asAll = report as AllBugReport;
  const { updateBugReportStatus, sendBugReportMessage } = useApi();
  const waDigits = asAll.whatsapp?.replace(/\D/g, "");
  const [replyText, setReplyText] = useState("");

  function sendReply() {
    const message = replyText.trim();
    if (!message) return;
    sendBugReportMessage.mutate({ data: { id: report.id, message } }, {
      onSuccess: () => { toast.success("Mensagem enviada."); setReplyText(""); },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao enviar mensagem"),
    });
  }

  return (
    <div className="bg-[#1C1C1C] rounded-lg p-5">
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="text-xs text-white/40">
          {new Date(report.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          {showOrigin && asAll.orgName && <> · <span className="text-white/60 font-semibold">{asAll.orgName}</span> · {asAll.reporterName}</>}
        </div>
        <div className="flex items-center gap-2">
          {!showOrigin && <StatusBadge status={report.status} />}
          {report.screenshotUrl && (
            <a href={report.screenshotUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[rgb(var(--lz-brand-rgb))] hover:underline shrink-0">
              <ImageIcon size={12} /> Ver print
            </a>
          )}
        </div>
      </div>
      <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{report.message}</p>
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {report.pageUrl && (
          <a href={report.pageUrl} className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white/60">
            <ExternalLink size={11} /> {report.pageUrl}
          </a>
        )}
        {showOrigin && waDigits && (
          <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#4ADE80] hover:underline">
            <MessageCircle size={12} /> Falar no WhatsApp
          </a>
        )}
      </div>
      {showOrigin && (
        <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-white/[0.06]">
          {STATUS_ORDER.map((s) => {
            const active = report.status === s;
            return (
              <button
                key={s}
                disabled={active}
                onClick={() => updateBugReportStatus.mutate(
                  { data: { id: report.id, status: s } },
                  { onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar status") },
                )}
                className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-all duration-200 disabled:cursor-default hover:brightness-110"
                style={{
                  backgroundColor: active ? STATUS_STYLE[s].bg : "rgba(255,255,255,0.04)",
                  color: active ? STATUS_STYLE[s].color : "rgba(255,255,255,0.4)",
                }}
              >
                {STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
      )}
      {showOrigin && (
        <div className="flex items-center gap-2 mt-3">
          <input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendReply(); }}
            placeholder="Mandar uma mensagem pra quem reportou (aparece nas notificações dela)…"
            maxLength={500}
            className="flex-1 bg-[#141414] border border-white/10 rounded-md px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
          />
          <button
            onClick={sendReply}
            disabled={!replyText.trim() || sendBugReportMessage.isPending}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold text-black disabled:opacity-40"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }}
          >
            <Send size={12} /> Enviar
          </button>
        </div>
      )}
    </div>
  );
}

function MinhasSolicitacoes() {
  const { data = [], isLoading } = useQuery(myBugReportsQO());
  if (isLoading) return <div className="text-sm text-white/40">Carregando…</div>;
  if (data.length === 0) return <div className="text-sm text-white/40 px-1">Você ainda não reportou nada por aqui.</div>;
  return <div className="space-y-3">{data.map((r) => <BugReportRow key={r.id} report={r} />)}</div>;
}

function TodasSolicitacoes() {
  const { data = [], isLoading } = useQuery(allBugReportsQO());
  if (isLoading) return <div className="text-sm text-white/40">Carregando…</div>;
  if (data.length === 0) return <div className="text-sm text-white/40 px-1">Nenhuma solicitação de nenhuma agência ainda.</div>;
  return <div className="space-y-3">{data.map((r) => <BugReportRow key={r.id} report={r} showOrigin />)}</div>;
}
