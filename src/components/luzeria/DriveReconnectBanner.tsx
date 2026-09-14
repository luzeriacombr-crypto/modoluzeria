import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { RefreshCw, X } from "lucide-react";
import { driveConnectionHealthQO } from "@/lib/luzeria/queries";

const DISMISS_KEY = "modocriador:drive-reconnect-banner-dismissed";

/** Avisa admins (setor + master) quando a conexão de Drive da agência
 * parou de funcionar de verdade — checkDriveConnectionHealth() chama a
 * mesma getAccessToken() que qualquer upload real usa, então não é
 * palpite. Diferente do InstagramLiveBanner (aviso de novidade, uma vez
 * só): aqui é um problema ativo, então o "dispensar" usa sessionStorage,
 * não localStorage — volta a aparecer na próxima sessão se continuar
 * quebrado. */
export function DriveReconnectBanner({ isAdmin }: { isAdmin: boolean }) {
  const { data } = useQuery({ ...driveConnectionHealthQO(), enabled: isAdmin });
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === "1");
  const navigate = useNavigate();

  const shouldShow = isAdmin && !dismissed && data?.connected && !data.ok;
  if (!shouldShow) return null;

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-sm text-white" style={{ background: "rgba(200,212,78,0.14)", borderBottom: "1px solid rgba(200,212,78,0.3)" }}>
      <RefreshCw size={16} className="shrink-0" style={{ color: "#C8D44E" }} />
      <button
        onClick={() => navigate({ to: "/configuracoes", search: { tab: "integrations" } })}
        className="flex-1 min-w-0 text-left hover:underline"
      >
        <b className="font-semibold">Reconecte seu Google Drive</b> — o Google atualizou a política de acesso, sua conta pode ter sido desconectada. Se já estiver tudo certo pra você, pode ignorar.
      </button>
      <button onClick={dismiss} title="Dispensar" className="shrink-0 opacity-80 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}
