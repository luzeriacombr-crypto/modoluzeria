import { useEffect, useState } from "react";
import { Copy, X } from "lucide-react";
import { toast } from "sonner";

const DISMISS_KEY = "modocriador:in-app-browser-banner-dismissed";

/** Instagram/Facebook abrem links num navegador embutido (webview) que não
 * suporta "adicionar à tela de início" do mesmo jeito que Chrome/Safari —
 * quem entra por lá (o canal mais comum de link de indicação/cliente novo)
 * trava sozinho tentando instalar como app. Detecta pela assinatura de user
 * agent conhecida e avisa antes da pessoa tentar. Só nas páginas públicas —
 * dentro do app logado a pessoa já está num navegador de verdade. */
export function InAppBrowserBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      const isInApp = /Instagram|FBAN|FBAV/i.test(navigator.userAgent);
      setDismissed(!isInApp || localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      // localStorage indisponível (aba privada etc) — mostra mesmo assim se detectar in-app.
      setDismissed(!/Instagram|FBAN|FBAV/i.test(navigator.userAgent));
    }
  }, []);

  if (dismissed) return null;

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setDismissed(true);
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(
      () => toast.success("Link copiado — cole no seu navegador (Chrome/Safari)."),
      () => toast.error("Não consegui copiar o link."),
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-sm text-white" style={{ background: "rgba(200,212,78,0.14)", borderBottom: "1px solid rgba(200,212,78,0.3)" }}>
      <span className="flex-1 min-w-0">
        Você abriu esse link pelo navegador do Instagram — toque em{" "}
        <b className="font-semibold">⋮ (ou o ícone de compartilhar)</b> e escolha{" "}
        <b className="font-semibold">"Abrir no navegador"</b> pra usar tudo direitinho.
      </span>
      <button onClick={copyLink} title="Copiar link" className="shrink-0 opacity-80 hover:opacity-100">
        <Copy size={14} />
      </button>
      <button onClick={dismiss} title="Dispensar" className="shrink-0 opacity-80 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
}
