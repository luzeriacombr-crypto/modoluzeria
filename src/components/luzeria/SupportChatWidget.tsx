import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { X, Send, CheckCircle2, ArrowLeft } from "lucide-react";
import { ChatBubbleIcon } from "./ChatBubbleIcon";
import { useMe, useApi, mySupportThreadQO, openSupportThreadsQO, supportThreadMessagesQO } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import type { SupportMessage } from "@/lib/luzeria/support-chat.functions";

const WELCOME: SupportMessage = {
  id: "welcome",
  role: "assistant",
  content: "Oi! Sou o chat de suporte do Modo Criador. Me conta sua dúvida que eu te ajudo.",
  createdAt: "",
};

/** Renderiza **negrito** e [texto](link) dentro de uma mensagem do chat — um
 * link interno (começa com "/") navega pela SPA e fecha o painel do chat
 * pra pessoa ver a tela de destino; um link externo abre em nova aba. */
function ChatText({ text }: { text: string }) {
  const navigate = useNavigate();
  const { setSupportChatOpen } = useUI();
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
        }
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          const [, label, href] = linkMatch;
          if (href.startsWith("/")) {
            const [path, query] = href.split("?");
            const search = query ? Object.fromEntries(new URLSearchParams(query)) : undefined;
            return (
              <button
                key={i}
                onClick={() => { setSupportChatOpen(false); navigate({ to: path as any, search: search as any }); }}
                className="underline font-semibold hover:opacity-80"
                style={{ color: "inherit" }}
              >
                {label}
              </button>
            );
          }
          return (
            <a key={i} href={href} target="_blank" rel="noreferrer" className="underline font-semibold hover:opacity-80">
              {label}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/** Bolha de chat flutuante, visível pra qualquer usuário autenticado — o
 * canal pensado pra substituir contato direto no WhatsApp pessoal do
 * Junior. Some no lugar disso: um bot que responde as dúvidas comuns e,
 * quando não sabe, escala pra ele — sem trocar de tela nem de conversa. */
export function SupportChatWidget() {
  const me = useMe().data;
  const { supportChatOpen: open, setSupportChatOpen: setOpen } = useUI();
  const { data } = useQuery({ ...mySupportThreadQO(), refetchInterval: open ? 5000 : false });
  const { sendSupportMessage } = useApi();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const messages = data?.messages && data.messages.length > 0 ? data.messages : [WELCOME];

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [open, messages.length, pending]);

  if (!me) return null;

  function send() {
    const text = input.trim();
    if (!text || sendSupportMessage.isPending) return;
    setInput("");
    setPending(text);
    sendSupportMessage.mutate(
      { data: { threadId: data?.threadId ?? undefined, text } },
      {
        onError: (e: any) => { toast.error(e?.message ?? "Não consegui enviar sua mensagem."); setPending(null); },
        onSuccess: () => setPending(null),
      },
    );
  }

  return (
    <>
      <div className="fixed z-[9997] bottom-[88px] right-4 md:bottom-6 md:right-6 group">
        {!open && (
          <span
            className="absolute bottom-1/2 translate-y-1/2 right-[60px] whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 bg-card border border-foreground/10 text-foreground"
          >
            Pergunte ao Chat do Modo Criador
          </span>
        )}
        <button
          onClick={() => setOpen(!open)}
          aria-label="Chat do Modo Criador"
          className="flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
          style={{
            width: 52,
            height: 52,
            background: "rgb(var(--lz-brand-rgb))",
            color: "#0D0D0D",
          }}
        >
          {open ? <X size={22} /> : <ChatBubbleIcon size={22} />}
        </button>
      </div>

      {open && (
        <div
          className="fixed z-[9998] bg-card border border-foreground/10 rounded-xl shadow-2xl flex flex-col overflow-hidden bottom-[148px] right-4 md:bottom-24 md:right-6"
          style={{
            width: "min(360px, calc(100vw - 32px))",
            height: "min(480px, calc(100vh - 220px))",
          }}
        >
          <div className="px-4 py-3 border-b border-foreground/10 flex items-center gap-2 shrink-0">
            <ChatBubbleIcon size={16} style={{ color: "var(--lz-accent-ink)" }} />
            <span className="text-sm font-bold text-foreground">Chat do Modo Criador</span>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
            {pending && <MessageBubble message={{ id: "pending-user", role: "user", content: pending, createdAt: "" }} />}
            {sendSupportMessage.isPending && (
              <div className="flex items-center gap-1 px-3 py-2 text-xs text-foreground/40">
                <span className="lz-typing-dot" /><span className="lz-typing-dot" /><span className="lz-typing-dot" />
              </div>
            )}
          </div>

          <div className="p-2.5 border-t border-foreground/10 flex items-center gap-2 shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Digite sua dúvida…"
              maxLength={2000}
              className="flex-1 bg-background border border-foreground/10 rounded-full px-4 py-2 text-sm text-foreground placeholder:text-foreground/30 outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
            />
            <button
              onClick={send}
              disabled={!input.trim() || sendSupportMessage.isPending}
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-40"
              style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        .lz-typing-dot { width: 5px; height: 5px; border-radius: 999px; background: currentColor; display: inline-block; animation: lz-typing 1.2s infinite ease-in-out; }
        .lz-typing-dot:nth-child(2) { animation-delay: 0.15s; }
        .lz-typing-dot:nth-child(3) { animation-delay: 0.3s; }
        @keyframes lz-typing { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-2px); } }
      `}</style>
    </>
  );
}

function MessageBubble({ message }: { message: SupportMessage }) {
  const fromUser = message.role === "user";
  return (
    <div className={`flex ${fromUser ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap"
        style={
          fromUser
            ? { background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D", borderBottomRightRadius: 4 }
            : { background: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "var(--foreground)", borderBottomLeftRadius: 4 }
        }
      >
        <ChatText text={message.content} />
      </div>
    </div>
  );
}

/** Painel admin (Central de Ajuda → Chats, só platform admin): conversas
 * abertas/escaladas de qualquer agência — responder aqui aparece direto na
 * mesma conversa da pessoa, como se o chat continuasse sozinho. */
export function SupportChatAdminPanel() {
  const { data: threads = [], isLoading } = useQuery(openSupportThreadsQO());
  const [selected, setSelected] = useState<string | null>(null);
  const { data: messages = [] } = useQuery(supportThreadMessagesQO(selected));
  const { replyToSupportThread, closeSupportThread } = useApi();
  const [reply, setReply] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  useEffect(() => {
    if (!selected && threads.length > 0) setSelected(threads[0].id);
  }, [threads, selected]);

  const activeThread = threads.find((t) => t.id === selected);

  function sendReply() {
    const text = reply.trim();
    if (!text || !selected) return;
    replyToSupportThread.mutate(
      { data: { threadId: selected, text } },
      { onSuccess: () => setReply(""), onError: (e: any) => toast.error(e?.message ?? "Erro ao responder") },
    );
  }

  if (isLoading) return <div className="text-sm text-foreground/40">Carregando…</div>;
  if (threads.length === 0) return <div className="text-sm text-foreground/40 px-1">Nenhuma conversa esperando resposta agora.</div>;

  return (
    <div className="flex flex-col md:flex-row gap-4 h-[75vh] md:h-[560px]">
      <div className={`w-full md:w-64 shrink-0 overflow-y-auto space-y-1.5 pr-1 ${selected ? "hidden md:block" : ""}`}>
        {threads.map((t) => {
          const active = t.id === selected;
          return (
            <button
              key={t.id}
              onClick={() => setSelected(t.id)}
              className="w-full text-left rounded-lg p-3 transition-colors"
              style={{ background: active ? "rgba(var(--lz-brand-light-rgb),0.15)" : "var(--card)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-foreground truncate">{t.userName}</span>
                {t.status === "escalated" && (
                  <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: "rgba(250,204,21,0.15)", color: "#FACC15" }}>
                    Aguardando
                  </span>
                )}
              </div>
              <div className="text-[11px] text-foreground/40 truncate mt-0.5">{t.orgName}</div>
              {t.lastMessage && <div className="text-[11px] text-foreground/50 truncate mt-1.5">{t.lastMessage}</div>}
            </button>
          );
        })}
      </div>

      {activeThread && (
        <div className={`flex-1 flex flex-col min-w-0 bg-card rounded-lg overflow-hidden ${selected ? "" : "hidden md:flex"}`}>
          <div className="px-4 py-3 border-b border-foreground/10 flex items-center gap-2.5 justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <button onClick={() => setSelected(null)} aria-label="Voltar pra lista" className="md:hidden shrink-0 text-foreground/50 hover:text-foreground">
                <ArrowLeft size={17} />
              </button>
              <div className="min-w-0">
                <div className="text-sm font-bold text-foreground truncate">{activeThread.userName}</div>
                <div className="text-[11px] text-foreground/40 truncate">{activeThread.orgName}</div>
              </div>
            </div>
            <button
              onClick={() => closeSupportThread.mutate({ data: { threadId: activeThread.id } }, { onSuccess: () => setSelected(null) })}
              className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/50 hover:text-foreground"
            >
              <CheckCircle2 size={14} /> <span className="hidden sm:inline">Marcar como resolvido</span>
            </button>
          </div>
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                <div className="max-w-[80%]">
                  {m.role !== "user" && (
                    <div className="text-[10px] text-foreground/30 mb-0.5 text-right">{m.role === "assistant" ? "Bot" : "Você"}</div>
                  )}
                  <div
                    className="rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap"
                    style={
                      m.role === "user"
                        ? { background: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "var(--foreground)" }
                        : { background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }
                    }
                  >
                    <ChatText text={m.content} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-foreground/10 flex items-center gap-2 shrink-0">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendReply(); }}
              placeholder="Responder na conversa da pessoa…"
              maxLength={2000}
              className="flex-1 bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
            />
            <button
              onClick={sendReply}
              disabled={!reply.trim() || replyToSupportThread.isPending}
              className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-bold text-black disabled:opacity-40"
              style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }}
            >
              <Send size={12} /> Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
