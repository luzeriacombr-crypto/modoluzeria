import { useState } from "react";
import { toast } from "sonner";
import { useApi } from "@/lib/luzeria/queries";
import type { Profile } from "@/lib/luzeria/types";
import { AvatarEditor, ColorPicker, showAvatarError, uploadAvatar } from "./AvatarEditor";

export function WelcomeOnboarding({ me }: { me: Profile }) {
  const { updateMyProfile } = useApi();
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

  function finish(saveCustomization: boolean) {
    const payload: { color?: string; avatarPath?: string | null; onboarded: boolean } = { onboarded: true };
    if (saveCustomization) {
      payload.color = color;
      payload.avatarPath = avatarPath;
    }
    updateMyProfile.mutate({ data: payload }, {
      onSuccess: () => { if (saveCustomization) toast.success("Perfil personalizado."); },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar perfil"),
    });
  }

  const firstName = me.name.split(" ")[0] || me.name;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: "radial-gradient(circle at top, rgba(200,212,78,0.07), transparent 60%), #0D0D0D" }}>
      <div className="w-full max-w-md bg-[#1A1A1A] rounded-2xl p-7 md:p-9"
        style={{ border: "1px solid rgba(200,212,78,0.18)" }}>
        <div className="text-[10px] uppercase font-bold tracking-wider mb-2" style={{ color: "#C8D44E" }}>
          Bem-vinda(o) à Luzeria
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
          onClick={() => finish(true)}
          disabled={updateMyProfile.isPending || uploading}
          className="mt-8 w-full rounded-md py-3 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}
        >
          {updateMyProfile.isPending ? "Salvando…" : "Salvar e entrar"}
        </button>
        <button
          onClick={() => finish(false)}
          disabled={updateMyProfile.isPending}
          className="mt-3 w-full text-xs text-white/50 hover:text-white transition disabled:opacity-40"
        >
          Pular por agora
        </button>
      </div>
    </div>
  );
}