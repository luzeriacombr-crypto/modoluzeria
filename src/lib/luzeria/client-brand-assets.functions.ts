import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";

export type ClientBrandAsset = {
  id: string;
  driveFileId: string;
  name: string;
  mimeType: string | null;
  iconUrl: string | null;
  webViewUrl: string | null;
  createdAt: string;
};

export const listClientBrandAssets = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ClientBrandAsset[]> => {
    // `client_brand_assets` é tabela nova — cast até os tipos do Supabase
    // serem regenerados depois da migração rodar.
    const db = context.supabase as any;
    const { data: rows, error } = await db
      .from("client_brand_assets")
      .select("id, drive_file_id, name, mime_type, icon_url, web_view_url, created_at")
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      driveFileId: r.drive_file_id,
      name: r.name,
      mimeType: r.mime_type,
      iconUrl: r.icon_url,
      webViewUrl: r.web_view_url,
      createdAt: r.created_at,
    }));
  });
