import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Renderiza o conteúdo dentro de um <iframe> de verdade, com seu próprio
 * viewport — diferente de só encolher um <div>, isso faz as classes
 * responsivas do Tailwind (`sm:`, `md:`...) reagirem à LARGURA DO IFRAME,
 * igual aconteceria no celular de verdade. Um <div style={{width:390}}>
 * sozinho não muda o viewport real do navegador, então esses breakpoints
 * continuavam se comportando como se fosse desktop — por isso a prévia
 * mobile ficava "estranha".
 *
 * O CSS é copiado do <head> do documento principal pro <head> do iframe
 * (e mantido em sincronia via MutationObserver, cobre o HMR do Vite em
 * dev). A altura do iframe acompanha a altura do conteúdo, pra quem
 * envolve isso continuar controlando o scroll como antes. */
export function PreviewFrame({ width, children }: { width: number; children: React.ReactNode }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(400);

  useEffect(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc) return;

    doc.open();
    doc.write('<!doctype html><html><head></head><body style="margin:0"></body></html>');
    doc.close();

    function syncHead() {
      doc!.head.querySelectorAll("[data-copied]").forEach((n) => n.remove());
      document.head.querySelectorAll("style, link[rel='stylesheet']").forEach((node) => {
        const clone = node.cloneNode(true) as HTMLElement;
        clone.setAttribute("data-copied", "1");
        doc!.head.appendChild(clone);
      });
    }
    syncHead();
    const headObserver = new MutationObserver(syncHead);
    headObserver.observe(document.head, { childList: true });

    setMountNode(doc.body);

    const resizeObserver = new ResizeObserver(() => setHeight(doc.body.scrollHeight));
    resizeObserver.observe(doc.body);

    return () => {
      headObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <>
      <iframe
        ref={iframeRef}
        title="Prévia mobile"
        style={{ width, height, border: "none", display: "block" }}
      />
      {mountNode && createPortal(children, mountNode)}
    </>
  );
}
