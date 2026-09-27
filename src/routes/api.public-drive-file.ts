import { createFileRoute } from "@tanstack/react-router";
import { getAccessToken, withDriveOrg } from "@/lib/luzeria/drive.functions";

// Proxy de bytes pro download público de arquivo (preview de feed / stories
// / campanha compartilhada) — antes disso, getPublicDriveVideoToken
// devolvia o token OAuth de verdade do Drive direto pro navegador de
// qualquer pessoa com o link, com escopo de leitura/escrita no Drive
// INTEIRO da agência (não só o arquivo do preview). Agora o navegador só
// fala com esse endpoint aqui, sem token nenhum; a credencial real do
// Drive nunca sai do servidor. Reaplica a mesma checagem por-arquivo que
// getPublicDriveVideoToken já fazia — sem isso, esse endpoint viraria uma
// forma de baixar qualquer fileId, não só os do link.
export const Route = createFileRoute("/api/public-drive-file")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? "";
        const fileId = url.searchParams.get("fileId") ?? "";
        if (token.length < 8 || token.length > 60 || fileId.length < 5 || fileId.length > 200) {
          return new Response("Requisição inválida.", { status: 400 });
        }

        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
        );
        const { data: ok } = await supabase.rpc("verify_public_token_file", {
          _token: token,
          _file_id: fileId,
        });
        if (!ok) return new Response("Arquivo não encontrado nesse link.", { status: 404 });
        const { data: orgId } = await supabase.rpc("get_org_id_for_token", { _token: token });
        if (!orgId) return new Response("Link inválido.", { status: 404 });

        return withDriveOrg(orgId as string, async () => {
          const accessToken = await getAccessToken();
          const driveRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );
          if (!driveRes.ok || !driveRes.body) {
            return new Response("Erro ao baixar do Drive.", { status: 502 });
          }
          const headers = new Headers();
          const contentType = driveRes.headers.get("content-type");
          const contentLength = driveRes.headers.get("content-length");
          if (contentType) headers.set("content-type", contentType);
          if (contentLength) headers.set("content-length", contentLength);
          headers.set("cache-control", "private, max-age=300");
          return new Response(driveRes.body, { status: 200, headers });
        });
      },
    },
  },
});
