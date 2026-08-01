import { useState } from "react";
import { toast } from "sonner";
import { Video } from "lucide-react";
import { useApi } from "@/lib/luzeria/queries";
import type { Profile } from "@/lib/luzeria/types";
import { AvatarEditor, ColorPicker, showAvatarError, uploadAvatar } from "./AvatarEditor";
import { ImportClientsStep } from "./ImportClientsStep";

export function WelcomeOnboarding({ me }: { me: Profile }) {
  const { updateMyProfile } = useApi();
  const [step, setStep] = useState<"profile" | "import">("profile");
  const [color, setColor] = useState<string>(me.color);
  const [avatarPath, setAvatarPath] = useState<string | null>(me.avatarPath ?? null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(me.avatarUrl ?? null);
  const [uploading, setUploading] = useState(false);

  async function onPickFile(file: File) {
    setUploading(true);
    try {
      const path = await uploadAvatar(file, me.id);
      setAvatarPath(path);
      setAvatarPreview(URL.createObjectURL(file));
    } catch (e) { showAvatarError(e); }
    finally { setUploading(false); }
  }

  function onRemovePhoto() {
    setAvatarPath(null);
    setAvatarPreview(null);
  }

  function goToImportStep(saveCustomization: boolean) {
    if (!saveCustomization) { setStep("import"); return; }
    updateMyProfile.mutate({ data: { color, avatarPath } }, {
      onSuccess: () => { toast.success("Perfil personalizado."); setStep("import"); },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar perfil"),
    });
  }

  function completeOnboarding() {
    updateMyProfile.mutate({ data: { onboarded: true } }, {
      onError: (e: any) => toast.error(e?.message ?? "Erro ao concluir"),
    });
  }

  const firstName = me.name.split(" ")[0] || me.name;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: "radial-gradient(circle at top, rgba(var(--lz-brand-light-rgb),0.07), transparent 60%), #0D0D0D" }}>
      <div className="w-full max-w-md bg-[#1A1A1A] rounded-2xl p-7 md:p-9"
        style={{ border: "1px solid rgba(var(--lz-brand-light-rgb),0.18)" }}>
        {step === "profile" ? (
          <>
            <div className="text-[10px] uppercase font-bold tracking-wider mb-2" style={{ color: "rgb(var(--lz-brand-rgb))" }}>
              Bem-vinda(o)
            </div>
            <h1 className="text-white text-[24px] font-bold leading-tight">
              Olá, {firstName}!
            </h1>
            <p className="text-white/60 text-sm mt-1.5 mb-6">
              Personalize seu perfil antes de começar.
            </p>

            <AvatarEditor
              me={me}
              draftColor={color}
              draftAvatarUrl={avatarPreview}
              uploading={uploading}
              onPickFile={onPickFile}
              onRemovePhoto={onRemovePhoto}
            />

            <div className="mt-7">
              <div className="text-[10px] uppercase font-bold tracking-wider text-white/50 mb-3 text-center">
                {avatarPreview ? "Cor de fallback (sem foto)" : "Escolha a cor do seu avatar"}
              </div>
              <ColorPicker value={color} onChange={setColor} />
            </div>

            <button
              onClick={() => goToImportStep(true)}
              disabled={updateMyProfile.isPending || uploading}
              className="mt-8 w-full rounded-md py-3 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
            >
              {updateMyProfile.isPending ? "Salvando…" : "Salvar e continuar"}
            </button>
            <button
              onClick={() => goToImportStep(false)}
              disabled={updateMyProfile.isPending}
              className="mt-3 w-full text-xs text-white/50 hover:text-white transition disabled:opacity-40"
            >
              Pular por agora
            </button>
          </>
        ) : (
          <>
            <div className="text-[10px] uppercase font-bold tracking-wider mb-2" style={{ color: "rgb(var(--lz-brand-rgb))" }}>
              Importar clientes
            </div>
            <h1 className="text-white text-[24px] font-bold leading-tight mb-6">
              Traga seus clientes
            </h1>
            <ImportClientsStep onDone={completeOnboarding} onSkip={completeOnboarding} />
          </>
        )}
      </div>
      <a
        href="https://youtu.be/UhX1xvRlMSM?si=in2xsAV4x2xDNxOw"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full bg-white/[0.06] hover:bg-white/10 text-white/70 hover:text-white transition-colors"
      >
        <Video size={13} /> Precisa de ajuda? Assista o tutorial!
      </a>
    </div>
  );
}