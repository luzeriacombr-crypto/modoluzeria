import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";

export type ClientContract = {
  id: string;
  driveFileId: string;
  fileName: string;
  mimeType: string | null;
  webViewUrl: string | null;
  createdAt: string;
};

export const getClientContract = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ClientContract | null> => {
    // `client_contracts` é tabela nova — cast até os tipos do Supabase
    // serem regenerados depois da migração rodar.
    const db = context.supabase as any;
    const { data: row } = await db
      .from("client_contracts")
      .select("id, drive_file_id, file_name, mime_type, web_view_url, created_at")
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (!row) return null;
    return {
      id: row.id,
      driveFileId: row.drive_file_id,
      fileName: row.file_name,
      mimeType: row.mime_type,
      webViewUrl: row.web_view_url,
      createdAt: row.created_at,
    };
  });
