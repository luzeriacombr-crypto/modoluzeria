import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import {
  ChevronDown, ExternalLink, Image as ImageIcon, MessageCircle, Video, Send, Lightbulb, Bug,
  UploadCloud, FolderInput, ClipboardList, CheckCircle2, Settings, LogIn, FolderTree, FolderCheck,
  AlertTriangle, RefreshCw, Link2, RotateCcw, Instagram, Facebook, Users, MousePointerClick, ShieldCheck,
  Plus, Pencil, FileText, UserPlus, UserCog, GitBranch, Zap, CalendarClock, CalendarCheck, XCircle,
  FilePlus2, Save, IdCard, Building2, History, FolderOpen, Wand2, ClipboardPaste, Copy, FileDown,
  ListFilter, Type, Download, Filter, Share2, KeyRound, AlertCircle, TrendingDown, TrendingUp, Search,
  Star, Code2, FlaskConical, Clock, MoreVertical, Smartphone, Repeat, Bell, MessageSquareText, Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useMe, useApi, myBugReportsQO, allBugReportsQO } from "@/lib/luzeria/queries";
import type { MyBugReport, AllBugReport, BugReportStatus, BugReportKind } from "@/lib/luzeria/bug-reports.functions";
import { ForumTab } from "./ForumTab";
import { SupportChatAdminPanel } from "./SupportChatWidget";
import { SupportChatTopicsPanel } from "./SupportChatTopicsPanel";
import { FAQ, TUTORIALS as TUTORIALS_BASE } from "@/lib/luzeria/help-content";

type Tab = "faq" | "tutoriais" | "minhas" | "todas" | "chats" | "temas" | "forum";

// Mídia (imagens/vídeo) é só visual — fica aqui, fora da base de conhecimento
// compartilhada com o Chat do Modo Criador (help-content.ts).
const TUTORIAL_MEDIA: Record<string, { images?: { src: string; alt: string }[]; videoUrl?: string }> = {
  "Conectar o Google Drive": { videoUrl: "https://youtu.be/UhX1xvRlMSM?si=in2xsAV4x2xDNxOw" },
  "Instalar o Modo Criador como app no celular": { videoUrl: "/tutorials/instalar-como-app.mp4" },
  "Criar um conteúdo pro cliente (briefing, materiais e responsáveis)": {
    images: [{ src: "/tutorials/conteudo-item-detalhe.jpg", alt: "Detalhe de um conteúdo: Briefing, Materiais brutos, Status, Responsáveis e Editor" }],
  },
  "Preencher a Ficha do Cliente pra IA ter mais contexto": {
    images: [{ src: "/tutorials/ficha-cliente-concorrentes-briefing.jpg", alt: "Campos Concorrentes, Briefing/sistema de conteúdo e Roteiros recentes na Ficha do Cliente" }],
  },
  "Colar um roteiro feito fora do Modo Criador e formatar com IA": {
    images: [{ src: "/tutorials/roteiros-planejamento-ia.jpg", alt: "Aba Roteiros & Planejamento com os botões Formatar com IA e Copiar modelo" }],
  },
};
const TUTORIALS = TUTORIALS_BASE.map((t) => ({ ...t, ...TUTORIAL_MEDIA[t.title] }));

// Ícone por passo — só visual (igual a mídia acima), pra Central de Ajuda
// ficar mais fácil de escanear. Cada lista precisa bater com o número de
// passos do tutorial correspondente em help-content.ts.
const STEP_ICONS: Record<string, LucideIcon[]> = {
  "Importar vários clientes de uma vez": [UploadCloud, FolderInput, Sparkles, ClipboardList, CheckCircle2],
  "Conectar o Google Drive": [Settings, LogIn, FolderTree, FolderCheck, CheckCircle2],
  "Resolver erro de permissão ao conectar o Google Drive": [AlertTriangle, RefreshCw, Link2, RotateCcw],
  "Conectar o Instagram de um cliente sem pedir a senha dele": [Instagram, Link2, Share2, CheckCircle2, LogIn],
  "Definir a função de um colaborador (Membro, Adm Setor ou Adm Master)": [Users, MousePointerClick, ShieldCheck, CheckCircle2],
  "Criar um conteúdo pro cliente (briefing, materiais e responsáveis)": [Plus, Pencil, FileText, ImageIcon, UploadCloud, MessageSquareText, UserPlus, UserCog, GitBranch, Zap],
  "Programar ou publicar direto no Instagram": [CheckCircle2, CalendarClock, Send, CalendarCheck, XCircle, Facebook],
  "Configurar a Base de Conhecimento pra treinar a IA": [Settings, FilePlus2, FileText, Save, Sparkles],
  "Preencher a Ficha do Cliente pra IA ter mais contexto": [IdCard, Building2, FileText, History, Save],
  "Colar um roteiro feito fora do Modo Criador e formatar com IA": [FolderOpen, Wand2, ClipboardPaste, Sparkles, Pencil, Save, Copy],
  "Exportar roteiros em PDF pra imprimir": [FileDown, ListFilter, Type, Download],
  "Ver publicações programadas, publicadas e os Insights de um cliente": [Instagram, Filter, CalendarClock, CheckCircle2, Share2, Download],
  "Gerar uma prévia de planejamento com IA (novidade)": [KeyRound, AlertCircle, TrendingDown, FileText, Sparkles, MessageSquareText, Search, ClipboardList, Star, TrendingUp],
  "Criar uma automação (com modelo pronto ou do zero)": [Settings, Zap, GitBranch, Filter, Code2, FlaskConical, Clock],
  "Instalar o Modo Criador como app no celular": [Share2, MoreVertical, Smartphone, Repeat, Bell],
};

export function AjudaPage({ initialTab }: { initialTab?: string } = {}) {
  const me = useMe().data;
  const disabled = new Set(me?.disabledFeatures ?? []);
  const forumEnabled = me?.role === "master" && !disabled.has("forum");
  const validTabs = ["faq", "tutoriais", "minhas", "todas", "chats", "temas", ...(forumEnabled ? ["forum"] : [])];
  const [tab, setTab] = useState<Tab>(validTabs.includes(initialTab ?? "") ? (initialTab as Tab) : "faq");

  const tabs: { id: Tab; label: string }[] = [
    { id: "faq", label: "Perguntas frequentes" },
    { id: "tutoriais", label: "Tutoriais" },
    { id: "minhas", label: "Minhas solicitações" },
    ...(me?.isPlatformAdmin ? [{ id: "todas" as Tab, label: "Todas as solicitações" }] : []),
    ...(me?.isPlatformAdmin ? [{ id: "chats" as Tab, label: "Chats" }] : []),
    ...(me?.isPlatformAdmin ? [{ id: "temas" as Tab, label: "Assuntos" }] : []),
    ...(forumEnabled ? [{ id: "forum" as Tab, label: "Fórum" }] : []),
  ];

  return (
    <div className={`p-10 mx-auto ${tab === "forum" || tab === "chats" || tab === "temas" ? "max-w-6xl" : "max-w-4xl"}`}>
      <h1 className="text-[32px] font-bold text-foreground tracking-tight">Central de ajuda</h1>
      <p className="text-sm text-foreground/50 mt-2">Dúvidas frequentes, tutoriais, o histórico do que você já reportou e o fórum entre agências.</p>

      {/* Auditoria de UX (2.5): pra platform-admin (7 abas: as 3 de todo
          mundo + Todas as solicitações/Chats/Assuntos, só dele) essa linha
          não cabia numa tela média e quebrava em 2 fileiras, parecendo duas
          navegações empilhadas. `overflow-x-auto` é o mesmo padrão já usado
          na barra de abas de Configurações pro mesmo problema (muitas
          abas, tela estreita) — rola direto em vez de quebrar linha. */}
      <div className="flex items-center gap-1 border-b border-foreground/10 mt-6 mb-6 overflow-x-auto overflow-y-hidden">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="shrink-0 whitespace-nowrap px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors -mb-px border-b-2"
              style={{
                color: active ? "var(--lz-accent-ink)" : "color-mix(in srgb, var(--foreground) 50%, transparent)",
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
              <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-3">{group.category}</h2>
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
            <div key={t.title} className="bg-card rounded-lg p-5">
              <div className="font-bold text-foreground mb-4">{t.title}</div>
              {t.images && t.images.length > 0 && (
                <div className={`mb-5 grid gap-3 ${t.images.length > 1 ? "sm:grid-cols-2" : ""}`}>
                  {t.images.map((img) => (
                    <img key={img.src} src={img.src} alt={img.alt} className="w-full h-auto rounded-md border border-foreground/10" />
                  ))}
                </div>
              )}
              <ol className="list-none">
                {t.steps.map((s, i) => {
                  const Icon = STEP_ICONS[t.title]?.[i];
                  const isLast = i === t.steps.length - 1;
                  return (
                    <li key={i} className="flex gap-3">
                      <div className="flex flex-col items-center shrink-0">
                        <div
                          className="h-7 w-7 rounded-full flex items-center justify-center shrink-0"
                          style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}
                        >
                          {Icon ? <Icon size={13} /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                        </div>
                        {!isLast && (
                          <div className="w-px flex-1 my-1" style={{ backgroundColor: "color-mix(in srgb, var(--foreground) 10%, transparent)" }} />
                        )}
                      </div>
                      <div className={`text-sm text-foreground/60 leading-relaxed ${isLast ? "pb-1" : "pb-4"}`}>{s}</div>
                    </li>
                  );
                })}
              </ol>
              {t.videoUrl && (
                <a
                  href={t.videoUrl}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 mt-2 text-xs font-semibold rounded-full transition-opacity hover:opacity-80"
                  style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}
                >
                  <Video size={13} /> Assistir vídeo
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "minhas" && <MinhasSolicitacoes />}
      {tab === "todas" && me?.isPlatformAdmin && <TodasSolicitacoes />}
      {tab === "chats" && me?.isPlatformAdmin && <SupportChatAdminPanel />}
      {tab === "temas" && me?.isPlatformAdmin && <SupportChatTopicsPanel />}
      {tab === "forum" && forumEnabled && <ForumTab />}
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left px-5 py-4"
      >
        <span className="font-semibold text-sm text-foreground">{question}</span>
        <ChevronDown size={16} className="shrink-0 text-foreground/50 transition-transform" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>
      {open && <p className="text-foreground/60 text-sm leading-relaxed px-5 pb-4">{answer}</p>}
    </div>
  );
}

const STATUS_LABEL: Record<BugReportStatus, string> = {
  novo: "Novo",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
};
const STATUS_STYLE: Record<BugReportStatus, { bg: string; color: string }> = {
  novo: { bg: "color-mix(in srgb, var(--foreground) 8%, transparent)", color: "color-mix(in srgb, var(--foreground) 60%, transparent)" },
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

const KIND_STYLE: Record<BugReportKind, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  bug: { label: "Problema", bg: "rgba(239,68,68,0.12)", color: "#F87171", icon: <Bug size={10} /> },
  suggestion: { label: "Sugestão", bg: "rgba(var(--lz-brand-light-rgb),0.18)", color: "var(--lz-accent-ink)", icon: <Lightbulb size={10} /> },
};

function KindBadge({ kind }: { kind: BugReportKind }) {
  const k = KIND_STYLE[kind];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: k.bg, color: k.color }}>
      {k.icon} {k.label}
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
      onError: (e: any) => toastFriendlyError(e, "Erro ao enviar mensagem"),
    });
  }

  return (
    <div className="bg-card rounded-lg p-5">
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="text-xs text-foreground/40">
          {new Date(report.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          {showOrigin && asAll.orgName && <> · <span className="text-foreground/60 font-semibold">{asAll.orgName}</span> · {asAll.reporterName}</>}
        </div>
        <div className="flex items-center gap-2">
          <KindBadge kind={report.kind} />
          {!showOrigin && <StatusBadge status={report.status} />}
          {report.screenshotUrl && (
            <a href={report.screenshotUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[var(--lz-accent-ink)] hover:underline shrink-0">
              <ImageIcon size={12} /> Ver print
            </a>
          )}
        </div>
      </div>
      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{report.message}</p>
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {report.pageUrl && (
          <a href={report.pageUrl} className="inline-flex items-center gap-1 text-xs text-foreground/40 hover:text-foreground/60">
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
        <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-foreground/6">
          {STATUS_ORDER.map((s) => {
            const active = report.status === s;
            return (
              <button
                key={s}
                disabled={active}
                onClick={() => updateBugReportStatus.mutate(
                  { data: { id: report.id, status: s } },
                  { onError: (e: any) => toastFriendlyError(e, "Erro ao atualizar status") },
                )}
                className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-all duration-200 disabled:cursor-default hover:brightness-110"
                style={{
                  backgroundColor: active ? STATUS_STYLE[s].bg : "color-mix(in srgb, var(--foreground) 4%, transparent)",
                  color: active ? STATUS_STYLE[s].color : "color-mix(in srgb, var(--foreground) 40%, transparent)",
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
            className="flex-1 bg-card border border-foreground/10 rounded-md px-3 py-2 text-xs text-foreground placeholder:text-foreground/30 outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
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
  if (isLoading) return <div className="text-sm text-foreground/40">Carregando…</div>;
  if (data.length === 0) return <div className="text-sm text-foreground/40 px-1">Você ainda não reportou nada por aqui.</div>;
  return <div className="space-y-3">{data.map((r) => <BugReportRow key={r.id} report={r} />)}</div>;
}

function TodasSolicitacoes() {
  const { data = [], isLoading } = useQuery(allBugReportsQO());
  if (isLoading) return <div className="text-sm text-foreground/40">Carregando…</div>;
  if (data.length === 0) return <div className="text-sm text-foreground/40 px-1">Nenhuma solicitação de nenhuma agência ainda.</div>;
  return <div className="space-y-3">{data.map((r) => <BugReportRow key={r.id} report={r} showOrigin />)}</div>;
}
