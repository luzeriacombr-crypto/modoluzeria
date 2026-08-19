import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Check, Video } from "lucide-react";
import { requestDemo } from "@/lib/luzeria/demo-request.functions";
import { LIME } from "./salesPageBlocks";

export function DemoRequestModal({ onClose }: { onClose: () => void }) {
  const submitDemo = useServerFn(requestDemo);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await submitDemo({ data: { name, email, phone, website } });
      setDone(true);
    } catch (err: any) {
      setError(err?.message ?? "Não foi possível enviar. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl p-6 sm:p-8 max-w-md w-full relative"
        style={{ background: "#fff", color: "#0A0E23" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#0A0E23]/40 hover:text-[#0A0E23] p-1 rounded-full hover:bg-black/5 transition"
        >
          <X size={18} />
        </button>

        {done ? (
          <div className="text-center py-4">
            <div className="mb-3 flex justify-center">
              <span className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: LIME }}>
                <Check size={20} color="#0A0E23" strokeWidth={3} />
              </span>
            </div>
            <div className="font-bold text-lg mb-2">Recebemos seu pedido!</div>
            <p className="text-[#0A0E23]/60 text-sm">
              Vamos entrar em contato pelo telefone ou e-mail que você deixou pra combinar o melhor horário.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-1 flex items-center gap-2">
              <span className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(215,255,63,0.15)" }}>
                <Video size={16} color="#8A9E00" />
              </span>
              <h3 className="font-black text-xl">Que tal agendar uma demonstração gratuita?</h3>
            </div>
            <p className="text-[#0A0E23]/60 text-sm mb-5 mt-2">
              Eu mesmo mostro na prática como o Modo Criador funciona e como ele encaixa na rotina da sua agência — sem compromisso.
            </p>
            <form onSubmit={submit} className="space-y-3">
              <input
                required value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome" maxLength={120} className="lz-input-onlight"
              />
              <input
                required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Seu e-mail" className="lz-input-onlight"
              />
              <input
                required value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="Seu telefone (com DDD)" maxLength={30} className="lz-input-onlight"
              />
              {/* Honeypot */}
              <input
                type="text" value={website} onChange={(e) => setWebsite(e.target.value)}
                autoComplete="off" tabIndex={-1} aria-hidden="true"
                style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
              />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit" disabled={loading}
                className="w-full font-black uppercase text-sm px-5 py-3.5 rounded-full transition disabled:opacity-50"
                style={{ background: LIME, color: "#0A0E23" }}
              >
                {loading ? "Enviando…" : "Quero agendar minha demo →"}
              </button>
            </form>
            <button
              onClick={onClose}
              className="w-full text-center text-[#0A0E23]/40 hover:text-[#0A0E23]/70 text-xs mt-3 transition"
            >
              Prefiro continuar sozinho por enquanto
            </button>
          </>
        )}
      </div>
    </div>
  );
}
