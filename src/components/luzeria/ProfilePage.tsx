import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { useMe, useApi } from "@/lib/luzeria/queries";
import { AvatarEditor, ColorPicker, showAvatarError, uploadAvatar } from "./AvatarEditor";
import { roleLabel } from "./Sidebar";

export function ProfilePage() {
  const me = useMe().data;
  const { updateMyProfile } = useApi();
  const [color, setColor] = useState<string>(me?.color ?? "#C8D44E");
  const [avatarPath, setAvatarPath] = useState<string | null>(me?.avatarPath ?? null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(me?.avatarUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!me) return;
    setColor(me.color);
    setAvatarPath(me.avatarPath ?? null);
    setAvatarPreview(me.avatarUrl ?? null);
    setDirty(false);
  }, [me?.id, me?.color, me?.avatarUrl, me?.avatarPath]);

  if (!me) return null;
  const meUser = me;

  async function onPickFile(file: File) {
    setUploading(true);
    try {
      const path = await uploadAvatar(file, meUser.id);
      setAvatarPath(path);
      setAvatarPreview(URL.createObjectURL(file));
      setDirty(true);
    } catch (e) { showAvatarError(e); }
    finally { setUploading(false); }
  }

  function onRemovePhoto() {
    setAvatarPath(null);
    setAvatarPreview(null);
    setDirty(true);
  }

  function save() {
    updateMyProfile.mutate(
      { data: { color, avatarPath } },
      {
        onSuccess: () => { toast.success("Perfil atualizado."); setDirty(false); },
        onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
      },
    );
  }

  return (
    <div className="px-5 md:px-10 py-8 md:py-12 max-w-2xl mx-auto">
      <div className="text-[10px] uppercase font-bold tracking-wider mb-2" style={{ color: "#C8D44E" }}>
        Meu perfil
      </div>
      <h1 className="text-white text-[28px] md:text-[32px] font-bold tracking-tight">{me.name}</h1>
      <p className="text-white/50 text-sm mt-1 flex items-center gap-1.5">
        <Mail size={13} /> {me.email}
      </p>
      <span className="inline-block text-[10px] uppercase font-bold mt-3 px-2 py-0.5 rounded"
        style={{ backgroundColor: "rgba(200,212,78,0.15)", color: "#C8D44E" }}>
        {roleLabel(me.role)}
      </span>

      <div className="mt-8 bg-[#1C1C1C] rounded-lg p-6 md:p-8">
        <div className="text-[10px] uppercase font-bold tracking-wider text-white/50 mb-5 text-center md:text-left">
          Foto de perfil
        </div>
        <AvatarEditor
          me={meUser}
          draftColor={color}
          draftAvatarUrl={avatarPreview}
          uploading={uploading}
          onPickFile={onPickFile}
          onRemovePhoto={onRemovePhoto}
        />
      </div>

      <div className="mt-6 bg-[#1C1C1C] rounded-lg p-6 md:p-8">
        <div className="text-[10px] uppercase font-bold tracking-wider text-white/50 mb-5 text-center md:text-left">
          {avatarPreview ? "Cor de fallback" : "Cor do avatar"}
        </div>
        <ColorPicker
          value={color}
          onChange={(c) => { setColor(c); setDirty(true); }}
        />
      </div>

      <div className="mt-8 flex items-center justify-end gap-3">
        <button
          onClick={save}
          disabled={!dirty || updateMyProfile.isPending || uploading}
          className="text-sm font-bold px-6 py-2.5 rounded-md transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}
        >
          {updateMyProfile.isPending ? "Salvando…" : "Salvar alterações"}
        </button>
      </div>

      <p className="text-[11px] text-white/30 mt-4 text-center md:text-right">
        Para alterar nome ou email, fale com um administrador.
      </p>

      <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-white">Tour guiado do app</div>
          <div className="text-[11px] text-white/50 mt-1">Refaça o passo a passo de boas-vindas quando quiser.</div>
        </div>
        <button
          onClick={() => window.dispatchEvent(new Event("lz:start-tour"))}
          className="text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-md text-black shrink-0"
          style={{ backgroundColor: "#C8D44E" }}
        >
          Refazer tour
        </button>
      </div>
    </div>
  );
}