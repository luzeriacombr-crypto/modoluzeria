import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { completeDriveConnect } from "@/lib/luzeria/drive.functions";

export const Route = createFileRoute("/_authenticated/oauth/drive-callback")({
  component: DriveCallbackPage,
  ssr: false,
});

function DriveCallbackPage() {
  const complete = useServerFn(completeDriveConnect);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const errorParam = url.searchParams.get("error");
    if (errorParam) {
      setStatus("error");
      setMessage("Autorização cancelada ou negada no Google.");
      return;
    }
    if (!code) {
      setStatus("error");
      setMessage("Código de autorização ausente na URL.");
      return;
    }
    complete({ data: { code, redirectOrigin: url.origin } })
      .then((r: any) => {
        setStatus("success");
        setMessage(r?.driveEmail ? `Conectado como ${r.driveEmail}.` : "Google Drive conectado com sucesso.");
      })
      .catch((e: any) => {
        setStatus("error");
        setMessage(e?.message ?? "Falha ao conectar com o Google Drive.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] p-6">
      <div className="max-w-sm w-full bg-[#1A1A1A] rounded-xl p-8 text-center border border-white/10">
        {status === "loading" && (
          <p className="text-white/70 text-sm">Conectando ao Google Drive…</p>
        )}
        {status === "success" && (
          <>
            <p className="text-[#C8D44E] font-semibold mb-2">Drive conectado!</p>
            <p className="text-white/60 text-sm">{message}</p>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-red-400 font-semibold mb-2">Não foi possível conectar</p>
            <p className="text-white/60 text-sm">{message}</p>
          </>
        )}
        <a href="/configuracoes" className="lz-btn-primary inline-block mt-6 px-4 py-2 rounded-md text-sm">
          Voltar às Configurações
        </a>
      </div>
    </div>
  );
}
