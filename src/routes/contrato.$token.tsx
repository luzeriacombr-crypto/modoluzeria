import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Check, Eraser } from "lucide-react";
import { publicContractRequestQO } from "@/lib/luzeria/queries";
import { signContractRequest } from "@/lib/luzeria/contract-requests.functions";

export const Route = createFileRoute("/contrato/$token")({
  component: PublicContractPage,
  loader: async ({ params, context }) => {
    try {
      return await (context as any).queryClient.fetchQuery(publicContractRequestQO(params.token));
    } catch {
      return null;
    }
  },
  head: ({ loaderData }) => {
    const title = loaderData?.orgName ? `Contrato — ${loaderData.orgName}` : "Contrato";
    return {
      meta: [
        { title },
        { name: "robots", content: "noindex" },
        { name: "description", content: "Assinatura de contrato." },
      ],
    };
  },
});

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

/** Markdown bem simples do modelo de contrato — `**negrito**` e
 * `### Título de cláusula` — renderizado formatado em vez de mostrar os
 * asteriscos/cerquilhas literais pro cliente que vai assinar. */
function ContractText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((raw, i) => {
        const trimmed = raw.trim();
        if (trimmed === "") return <div key={i} className="h-2.5" />;
        const heading = trimmed.match(/^#{1,6}\s+(.*)$/);
        const content = heading ? heading[1] : trimmed;
        const parts = content.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
        return (
          <p key={i} className={heading ? "font-bold text-white mt-3 mb-1" : "mb-1"}>
            {parts.map((p, j) =>
              p.startsWith("**") && p.endsWith("**")
                ? <strong key={j} className="font-bold text-white">{p.slice(2, -2)}</strong>
                : <span key={j}>{p}</span>,
            )}
          </p>
        );
      })}
    </>
  );
}

function PublicContractPage() {
  const { token } = Route.useParams();
  const q = useQuery(publicContractRequestQO(token));
  const signFn = useServerFn(signContractRequest);

  const [signerName, setSignerName] = useState("");
  const [signerCpf, setSignerCpf] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justSigned, setJustSigned] = useState(false);

  if (q.isLoading) {
    return <Shell><div className="text-white/60 text-sm">Carregando…</div></Shell>;
  }
  if (!q.data) {
    return (
      <Shell>
        <div className="text-center">
          <div className="text-white text-2xl font-bold mb-2">Link inválido</div>
          <div className="text-white/50 text-sm">Este link não existe. Solicite um novo à sua agência.</div>
        </div>
      </Shell>
    );
  }

  const { contractText, status, clientName, orgName, orgLogoUrl, signerName: alreadySignedBy, signedAt } = q.data;
  const alreadySigned = status === "assinado" || justSigned;

  async function submit() {
    if (!signerName.trim()) { toast.error("Digite seu nome pra assinar."); return; }
    if (!signerCpf.trim()) { toast.error("Digite seu CPF pra assinar."); return; }
    if (!signatureDataUrl) { toast.error("Desenhe sua assinatura no quadro antes de continuar."); return; }
    setSubmitting(true);
    try {
      await signFn({ data: { token, signerName: signerName.trim(), signerCpf: signerCpf.trim(), signatureDataUrl } });
      setJustSigned(true);
      toast.success("Contrato assinado!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao assinar. Tente de novo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen pb-16" style={{ background: "#0D0D0D" }}>
      <Toaster theme="dark" position="bottom-right" />

      <div className="max-w-2xl mx-auto px-4 sm:px-8 pt-10">
        {orgLogoUrl && <img src={orgLogoUrl} alt={orgName} className="h-9 w-auto object-contain mb-6" />}
        <h1 className="text-white text-2xl font-bold mb-1">Contrato — {clientName}</h1>
        <p className="text-white/40 text-xs mb-8">{orgName}</p>

        {alreadySigned ? (
          <div className="rounded-xl p-8 text-center" style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="size-12 rounded-full mx-auto mb-3 grid place-items-center" style={{ background: "rgba(34,197,94,0.15)" }}>
              <Check size={22} color="rgb(34,197,94)" />
            </div>
            <div className="text-white font-bold text-base mb-1">
              {justSigned ? "Assinado, obrigado!" : "Esse contrato já foi assinado"}
            </div>
            <div className="text-white/50 text-sm">
              {justSigned
                ? "Sua agência já foi avisada."
                : `Assinado${alreadySignedBy ? ` por ${alreadySignedBy}` : ""}${signedAt ? ` em ${formatDateTime(signedAt)}` : ""}.`}
            </div>
          </div>
        ) : (
          <>
            <div
              className="rounded-xl p-5 sm:p-6 mb-8 text-white/80 text-sm leading-relaxed"
              style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <ContractText text={contractText} />
            </div>

            <div className="rounded-xl p-5 sm:p-6" style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-white font-bold text-base mb-4">Assinar contrato</div>

              <label className="block text-white/50 text-xs mb-1.5">Nome completo</label>
              <input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Seu nome"
                maxLength={120}
                className="w-full rounded-md px-3 py-2.5 text-sm text-white outline-none mb-4"
                style={{ background: "#0D0D0D", border: "1px solid rgba(255,255,255,0.12)" }}
              />

              <label className="block text-white/50 text-xs mb-1.5">CPF</label>
              <input
                value={signerCpf}
                onChange={(e) => setSignerCpf(e.target.value)}
                placeholder="000.000.000-00"
                maxLength={20}
                className="w-full rounded-md px-3 py-2.5 text-sm text-white outline-none mb-4"
                style={{ background: "#0D0D0D", border: "1px solid rgba(255,255,255,0.12)" }}
              />

              <label className="block text-white/50 text-xs mb-1.5">Assinatura (desenhe com o dedo ou o mouse)</label>
              <SignaturePad onChange={setSignatureDataUrl} />

              <button
                onClick={submit}
                disabled={submitting}
                className="w-full mt-5 py-3 rounded-md text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
              >
                {submitting ? "Enviando…" : "Assinar contrato"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Sem lib nenhuma — canvas cru com pointer events (funciona pra mouse e
 * toque no mesmo código). Desenha um traço preto sobre fundo branco (pra
 * ficar legível quando visualizado depois) e devolve um PNG base64 via
 * onChange a cada traço solto. */
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "#0D0D0D";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    drawingRef.current = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasDrawnRef.current = true;
  }

  function end() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (hasDrawnRef.current && canvasRef.current) {
      onChange(canvasRef.current.toDataURL("image/png"));
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const ratio = window.devicePixelRatio || 1;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    hasDrawnRef.current = false;
    onChange(null);
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full rounded-md touch-none"
        style={{ height: 160, border: "1px solid rgba(255,255,255,0.12)" }}
      />
      <button
        type="button"
        onClick={clear}
        className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white transition"
      >
        <Eraser size={12} /> Limpar assinatura
      </button>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center px-6" style={{ background: "#0D0D0D" }}>
      <div className="max-w-md w-full">{children}</div>
    </div>
  );
}
