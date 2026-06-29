import { useRef, useState } from "react";
import { Camera, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "./Avatar";
import type { Profile } from "@/lib/luzeria/types";

export const AVATAR_PALETTE = [
  "#C8D44E", "#FF6B6B", "#4A9EFF", "#FF8C42",
  "#A855F7", "#10B981", "#F59E0B", "#EC4899",
  "#FFFFFF", "#FF4444", "#00BCD4", "#E91E63",
];

const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

/** Uploads the file to the user's avatars/<uid>/ folder and returns the storage path. */
export async function uploadAvatar(file: File, userId: string): Promise<string> {
  if (file.size > MAX_SIZE) throw new Error("Imagem maior que 5MB.");
  if (!ACCEPT.includes(file.type)) throw new Error("Use JPG, PNG ou WEBP.");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: "31536000",
  });
  if (error) throw error;
  return path;
}

export function AvatarEditor({
  me,
  draftColor,
  draftAvatarUrl,
  uploading,
  onPickFile,
  onRemovePhoto,
  size = 128,
}: {
  me: Profile;
  draftColor: string;
  draftAvatarUrl: string | null;
  uploading: boolean;
  onPickFile: (file: File) => void;
  onRemovePhoto: () => void;
  size?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hovering, setHovering] = useState(false);
  const [dragging, setDragging] = useState(false);

  const previewProfile = { ...me, color: draftColor, avatarUrl: draftAvatarUrl };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative group"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onPickFile(f);
        }}
        style={{
          width: size, height: size,
          borderRadius: "50%",
          border: dragging ? "2px dashed #C8D44E" : "2px solid transparent",
          transition: "border-color 200ms ease",
        }}
      >
        <Avatar profile={previewProfile} size={size} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label="Alterar foto"
          className="absolute inset-0 flex items-center justify-center rounded-full transition-opacity"
          style={{
            backgroundColor: "rgba(0,0,0,0.55)",
            color: "#FFFFFF",
            opacity: hovering || uploading || dragging ? 1 : 0,
          }}
        >
          {uploading ? <Loader2 className="animate-spin" size={22} /> : <Camera size={22} />}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPickFile(f);
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-xs font-semibold px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 transition-colors border"
          style={{ borderColor: "rgba(200,212,78,0.4)", color: "#C8D44E", backgroundColor: "transparent" }}
        >
          <Upload size={12} /> {draftAvatarUrl ? "Trocar foto" : "Enviar foto"}
        </button>
        {draftAvatarUrl && (
          <button
            type="button"
            onClick={onRemovePhoto}
            className="text-xs font-semibold px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 transition-colors border border-white/10 text-white/60 hover:text-red-400 hover:border-red-400/40"
          >
            <Trash2 size={12} /> Remover
          </button>
        )}
      </div>
      <p className="text-[10px] text-white/30">JPG, PNG ou WEBP, até 5MB.</p>
    </div>
  );
}

export function ColorPicker({
  value, onChange, disabled,
}: { value: string; onChange: (c: string) => void; disabled?: boolean }) {
  return (
    <div className={`flex flex-wrap gap-2 justify-center ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      {AVATAR_PALETTE.map((c) => {
        const selected = c.toUpperCase() === value.toUpperCase();
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`Cor ${c}`}
            className="h-8 w-8 rounded-full transition-transform hover:scale-110"
            style={{
              backgroundColor: c,
              boxShadow: selected
                ? "0 0 0 2px #0D0D0D, 0 0 0 4px #C8D44E"
                : "0 0 0 1px rgba(255,255,255,0.1)",
            }}
          />
        );
      })}
    </div>
  );
}

export function showAvatarError(e: unknown) {
  const msg = e instanceof Error ? e.message : "Erro ao enviar imagem.";
  toast.error(msg);
}