import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Send } from "lucide-react";
import { ChatBubbleIcon } from "./ChatBubbleIcon";
import { sendPublicSalesMessage, type PublicSalesChatMessage } from "@/lib/luzeria/public-sales-chat.functions";
import { LIME, BG_BLUE, ACCENT_ON_LIGHT } from "./salesPageBlocks";

const WHATSAPP_LINK = "https://wa.me/5599991135486?text=Oi!%20Fiquei%20com%20uma%20d%C3%BAvida%20sobre%20o%20Modo%20Criador.";

type ChatMsg = PublicSalesChatMessage & { id: string };

const WELCOME: ChatMsg = {
  id: "welcome",
  role: "assistant",
  content: "Oi! Sou o chat do Modo Criador. Me conta o que você quer saber que eu te ajudo — planos, como funciona, o que for.",
};

/** Renderiza **negrito** e [texto](link) — aqui link é sempre externo
 * (wa.me), abre em nova aba. */
function ChatText({ text }: { text: string }) {
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

export function SalesChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [capped, setCapped] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const sendMessage = useServerFn(sendPublicSalesMessage);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [open, messages.length, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending || capped) return;
    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: "user", content: text };
    const history: PublicSalesChatMessage[] = messages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    try {
      const res = await sendMessage({ data: { history, text } });
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: res.reply }]);
      if (res.capped) setCapped(true);
    } catch (e: any) {
      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: e?.message ?? `Deu um probleminha aqui. Me chama no WhatsApp: [Falar no WhatsApp](${WHATSAPP_LINK})`,
      }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="fixed bottom-5 right-5 z-50 group">
        {!open && (
          <span
            className="absolute bottom-1/2 translate-y-1/2 right-[64px] whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100"
            style={{ background: BG_BLUE, color: "white", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Pergunte ao Chat do Modo Criador
          </span>
        )}
        <button
          onClick={() => setOpen(!open)}
          aria-label="Chat do Modo Criador"
          className="flex items-center justify-center rounded-full shadow-2xl transition hover:opacity-90"
          style={{ width: 56, height: 56, background: LIME, color: ACCENT_ON_LIGHT }}
        >
          {open ? <X size={22} /> : <ChatBubbleIcon size={22} />}
        </button>
      </div>

      {open && (
        <div
          className="fixed z-50 rounded-2xl shadow-2xl flex flex-col overflow-hidden bottom-[88px] right-5"
          style={{ width: "min(360px, calc(100vw - 32px))", height: "min(500px, calc(100vh - 140px))", background: BG_BLUE, border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div className="px-4 py-3.5 flex items-center gap-2 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <ChatBubbleIcon size={16} style={{ color: LIME }} />
            <span className="text-sm font-bold text-white">Chat do Modo Criador</span>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap"
                  style={
                    m.role === "user"
                      ? { background: LIME, color: ACCENT_ON_LIGHT, borderBottomRightRadius: 4 }
                      : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.9)", borderBottomLeftRadius: 4 }
                  }
                >
                  <ChatText text={m.content} />
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-1 px-3 py-2 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                <span className="lz-sales-typing-dot" /><span className="lz-sales-typing-dot" /><span className="lz-sales-typing-dot" />
              </div>
            )}
          </div>

          {capped ? (
            <div className="p-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold transition hover:opacity-90"
                style={{ background: "#25D366", color: "#0A0E23" }}
              >
                Continuar no WhatsApp
              </a>
            </div>
          ) : (
            <div className="p-2.5 flex items-center gap-2 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                placeholder="Digite sua dúvida…"
                maxLength={2000}
                className="flex-1 rounded-full px-4 py-2 text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.06)", color: "white", border: "1px solid rgba(255,255,255,0.1)" }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || sending}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-40"
                style={{ background: LIME, color: ACCENT_ON_LIGHT }}
              >
                <Send size={15} />
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        .lz-sales-typing-dot { width: 5px; height: 5px; border-radius: 999px; background: currentColor; display: inline-block; animation: lz-sales-typing 1.2s infinite ease-in-out; }
        .lz-sales-typing-dot:nth-child(2) { animation-delay: 0.15s; }
        .lz-sales-typing-dot:nth-child(3) { animation-delay: 0.3s; }
        @keyframes lz-sales-typing { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-2px); } }
      `}</style>
    </>
  );
}
