import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { completeInstagramConnect, finalizeInstagramConnect, type InstagramPageCandidate } from "@/lib/luzeria/instagram.functions";

export const Route = createFileRoute("/_authenticated/oauth/instagram-callback")({
  component: InstagramCallbackPage,
  ssr: false,
});

function InstagramCallbackPage() {
  const complete = useServerFn(completeInstagramConnect);
  const finalize = useServerFn(finalizeInstagramConnect);
  const [status, setStatus] = useState<"loading" | "choose" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [candidates, setCandidates] = useState<InstagramPageCandidate[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");
    if (errorParam) {
      setStatus("error");
      setMessage("Autorização cancelada ou negada no Facebook.");
      return;
    }
    if (!code || !state) {
      setStatus("error");
      setMessage("Código de autorização ausente na URL.");
      return;
    }
    setClientId(state);
    complete({ data: { code, clientId: state, redirectOrigin: url.origin } })
      .then((r: any) => {
        if (r.ok) {
          setStatus("success");
          setMessage(r.igUsername ? `Conectado como @${r.igUsername}.` : "Instagram conectado com sucesso.");
        } else {
          setCandidates(r.candidates);
          setStatus("choose");
        }
      })
      .catch((e: any) => {
        setStatus("error");
        setMessage(e?.message ?? "Falha ao conectar com o Instagram.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pick(candidate: InstagramPageCandidate) {
    if (!clientId) return;
    setChoosing(true);
    try {
      const r: any = await finalize({ data: { clientId, candidate } });
      setStatus("success");
      setMessage(r?.igUsername ? `Conectado como @${r.igUsername}.` : "Instagram conectado com sucesso.");
    } catch (e: any) {
      setStatus("error");
      setMessage(e?.message ?? "Falha ao conectar com o Instagram.");
    } finally {
      setChoosing(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] p-6">
      <div className="max-w-sm w-full bg-[#1A1A1A] rounded-xl p-8 text-center border border-white/10">
        {status === "loading" && (
          <p className="text-white/70 text-sm">Conectando ao Instagram…</p>
        )}
        {status === "choose" && (
          <>
            <p className="text-white font-semibold mb-1">Qual conta é essa?</p>
            <p className="text-white/50 text-xs mb-4">Você administra mais de uma Página com Instagram conectado — escolhe qual é a desse cliente.</p>
            <div className="space-y-2">
              {candidates.map((c) => (
                <button
                  key={c.pageId}
                  onClick={() => pick(c)}
                  disabled={choosing}
                  className="w-full text-left px-4 py-3 rounded-md bg-white/5 hover:bg-white/10 disabled:opacity-50 transition"
                >
                  <div className="text-sm text-white font-medium">{c.pageName}</div>
                  <div className="text-xs text-white/50">{c.igUsername ? `@${c.igUsername}` : "Instagram sem username"}</div>
                </button>
              ))}
            </div>
          </>
        )}
        {status === "success" && (
          <>
            <p className="text-[rgb(var(--lz-brand-rgb))] font-semibold mb-2">Instagram conectado!</p>
            <p className="text-white/60 text-sm">{message}</p>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-red-400 font-semibold mb-2">Não foi possível conectar</p>
            <p className="text-white/60 text-sm">{message}</p>
          </>
        )}
        {status !== "loading" && status !== "choose" && (
          <a href={clientId ? `/cliente/${clientId}?tab=ficha` : "/minhas-tarefas"} className="lz-btn-primary inline-block mt-6 px-4 py-2 rounded-md text-sm">
            Voltar pro cliente
          </a>
        )}
      </div>
    </div>
  );
}
