import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const MAX_SIZE = 8 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

/** Uploads to the public marketing-assets bucket and returns a permanent
 * public URL — unlike avatars/reel-covers (private buckets needing signed
 * URLs), this bucket is public so getPublicUrl() never expires. */
export async function uploadMarketingAsset(file: File): Promise<string> {
  if (file.size > MAX_SIZE) throw new Error("Imagem maior que 8MB.");
  if (!ACCEPT.includes(file.type)) throw new Error("Use JPG, PNG ou WEBP.");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("marketing-assets").upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: "31536000",
  });
  if (error) throw error;
  const { data } = supabase.storage.from("marketing-assets").getPublicUrl(path);
  return data.publicUrl;
}

export function useMarketingAssetUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File): Promise<string | null> {
    setUploading(true);
    setError(null);
    try {
      return await uploadMarketingAsset(file);
    } catch (err: any) {
      setError(err?.message ?? "Falha no upload.");
      return null;
    } finally {
      setUploading(false);
    }
  }

  return { upload, uploading, error, setError };
}
