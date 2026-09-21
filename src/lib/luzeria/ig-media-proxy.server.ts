/** Proxy de vídeo pra Meta. A Meta só publica um vídeo se conseguir baixá-lo
 * por uma URL pública (video_url). Antes o vídeo era baixado do Drive pra
 * memória e copiado pro storage temporário — reels grandes estouravam a
 * memória da função ou o limite de tamanho do storage. Agora a URL aponta pra
 * esta rota, que repassa o arquivo do Drive em streaming (sem guardar nada e
 * sem limite de tamanho). O link é assinado (HMAC), amarrado a um arquivo e
 * expira em 30 minutos. */
import { createHmac, timingSafeEqual } from "node:crypto";

const SITE = "https://www.modocriador.com.br";
const TTL_MS = 30 * 60 * 1000;

type Payload = { o: string; f: string; m: string; e: number };

function secret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Segredo do servidor ausente.");
  return s;
}
const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

export function makeIgMediaUrl(orgId: string, driveFileId: string, mime: string): string {
  const body = Buffer.from(JSON.stringify({ o: orgId, f: driveFileId, m: mime, e: Date.now() + TTL_MS } satisfies Payload)).toString("base64url");
  return `${SITE}/api/ig-media/${body}.${sign(body)}`;
}

function verify(token: string): Payload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
    return p.e > Date.now() ? p : null;
  } catch { return null; }
}

export async function serveIgMedia(token: string, request: Request): Promise<Response> {
  const p = verify(token);
  if (!p) { console.error("[ig-media] token inválido ou expirado"); return new Response("Not found", { status: 404 }); }
  const { withDriveOrg, getAccessToken } = await import("./drive.functions");
  const range = request.headers.get("range");
  let driveRes: Response;
  try {
    driveRes = await withDriveOrg(p.o, async () => {
      const t = await getAccessToken();
      return fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(p.f)}?alt=media&supportsAllDrives=true`, {
        headers: { Authorization: `Bearer ${t}`, ...(range ? { Range: range } : {}) },
      });
    });
  } catch (e: any) {
    console.error("[ig-media] falha ao ler do Drive:", e?.message);
    return new Response("Bad gateway", { status: 502 });
  }
  if (!driveRes.ok && driveRes.status !== 206) { console.error("[ig-media] Drive respondeu", driveRes.status); return new Response("Not found", { status: 404 }); }
  console.log("[ig-media] servindo", request.method, range ?? "(inteiro)", driveRes.status);
  const headers = new Headers({
    "content-type": p.m || "video/mp4",
    "accept-ranges": "bytes",
    "cache-control": "no-store",
  });
  for (const h of ["content-length", "content-range"]) { const v = driveRes.headers.get(h); if (v) headers.set(h, v); }
  return new Response(request.method === "HEAD" ? null : driveRes.body, { status: driveRes.status, headers });
}
