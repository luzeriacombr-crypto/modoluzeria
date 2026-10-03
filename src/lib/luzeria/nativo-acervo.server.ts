// Nativo · acervo por cliente — rota HTTP chamada pelo site do Nativo (nativo.modocriador.com.br).
// Login: o Nativo manda o token da sessão do Supabase (Authorization: Bearer ...). Quem pode gerar:
// a regra do "Traga sua IA" (chave própria = sem limite e o custo é da pessoa; sem chave = os 2 primeiros
// clientes grátis, e nesses no máximo 3 gerações por cliente, porque o custo é nosso).
import { createClient } from "@supabase/supabase-js";

const ORIGENS = ["https://nativo.modocriador.com.br"];
const GERACOES_GRATIS_POR_CLIENTE = 3;
const MIN_POSTS = 3;
const MIN_SLIDES_CARROSSEL = 2;
const MAX_IMAGENS = 18;
const MAX_BYTES_IMAGEM = 1_800_000;

function cors(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const ok = ORIGENS.includes(origin) || (process.env.NODE_ENV !== "production" && /^http:\/\/localhost:\d+$/.test(origin));
  return {
    ...(ok ? { "access-control-allow-origin": origin, vary: "origin" } : {}),
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-max-age": "600",
  };
}
function json(request: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...cors(request) } });
}
const erro = (request: Request, status: number, message: string, code?: string) => json(request, status, { ok: false, message, code });

type Ctx = { userId: string; token: string; orgId: string; clientId: string; clientName: string };

/** Confere login, agência ativa e acesso ao cliente (pelas regras de acesso do próprio banco, com o token da pessoa). */
async function autenticar(request: Request, clientId: string | null): Promise<Ctx | Response> {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return erro(request, 401, "Entre na sua conta do Modo Criador pra usar isso.", "login");
  if (!clientId || !/^[0-9a-f-]{36}$/i.test(clientId)) return erro(request, 400, "Cliente inválido.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: u, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !u?.user) return erro(request, 401, "Sua sessão expirou. Entre de novo.", "login");
  const db: any = supabaseAdmin;
  const { data: prof } = await db.from("profiles").select("org_id, active").eq("id", u.user.id).maybeSingle();
  if (!prof?.org_id || !prof.active) return erro(request, 403, "Sua conta não está ativa numa agência.");
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return erro(request, 500, "Servidor sem configuração do banco.");
  const asUser = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: c } = await asUser.from("clients").select("id, name, org_id").eq("id", clientId).maybeSingle();
  if (!c || c.org_id !== prof.org_id) return erro(request, 403, "Você não tem acesso a esse cliente.");
  return { userId: u.user.id, token, orgId: prof.org_id, clientId: c.id, clientName: c.name };
}

export async function handleAcervo(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request) });
  try {
    if (request.method === "GET") return await status(request);
    if (request.method === "POST") return await gerar(request);
    return erro(request, 405, "Método não permitido.");
  } catch (e: any) {
    console.error("[nativo-acervo]", e?.message ?? e);
    return erro(request, 500, e?.message ? String(e.message) : "Não deu pra concluir agora. Tente de novo.");
  }
}

/** GET ?clientId=… → como está a IA pra esse cliente (sem gastar nada). */
async function status(request: Request) {
  const clientId = new URL(request.url).searchParams.get("clientId");
  const ctx = await autenticar(request, clientId);
  if (ctx instanceof Response) return ctx;
  const { peekAi } = await import("./ai-access.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db: any = supabaseAdmin;
  const [ai, ac] = await Promise.all([
    peekAi(ctx.orgId, ctx.clientId),
    db.from("nativo_client_acervo").select("generations, last_generated_at").eq("client_id", ctx.clientId).maybeSingle(),
  ]);
  const gens = ac.data?.generations ?? 0;
  const limiteGratis = !ai.own && !ai.house && gens >= GERACOES_GRATIS_POR_CLIENTE;
  return json(request, 200, {
    ok: true,
    ai: { own: ai.own, keyLast4: ai.keyLast4, allowed: ai.allowed && !limiteGratis, freeUsed: ai.freeUsed, freeLimit: ai.freeLimit, reason: !ai.allowed ? "sem_vaga" : limiteGratis ? "limite_gratis" : null },
    generations: gens,
    freeGenerationsLeft: ai.own || ai.house ? null : Math.max(0, GERACOES_GRATIS_POR_CLIENTE - gens),
    lastGeneratedAt: ac.data?.last_generated_at ?? null,
  });
}

/** POST { clientId } → lê as referências já enviadas, gera o acervo e guarda o perfil. */
async function gerar(request: Request) {
  let body: any = null;
  try { body = await request.json(); } catch { /* cai na validação */ }
  const ctx = await autenticar(request, body?.clientId ?? null);
  if (ctx instanceof Response) return ctx;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db: any = supabaseAdmin;

  // Referências (caminhos que a própria pessoa enviou pro bucket da agência dela).
  const { data: row } = await db.from("nativo_client_refs").select("refs").eq("client_id", ctx.clientId).eq("org_id", ctx.orgId).maybeSingle();
  const refs: { path: string; tipo: "post" | "carrossel" }[] = (Array.isArray(row?.refs) ? row.refs : []).filter(
    (r: any) => r && typeof r.path === "string" && (r.tipo === "post" || r.tipo === "carrossel") && r.path.startsWith(`${ctx.orgId}/`) && r.path.includes("/refs/") && !r.path.includes(".."),
  );
  const posts = refs.filter((r) => r.tipo === "post"), slides = refs.filter((r) => r.tipo === "carrossel");
  if (posts.length < MIN_POSTS) return erro(request, 400, `Envie pelo menos ${MIN_POSTS} publicações estáticas do cliente (faltam ${MIN_POSTS - posts.length}).`);
  if (slides.length < MIN_SLIDES_CARROSSEL) return erro(request, 400, `Envie um carrossel do cliente, com pelo menos ${MIN_SLIDES_CARROSSEL} slides.`);
  if (refs.length > MAX_IMAGENS) return erro(request, 400, `São muitas imagens (máximo ${MAX_IMAGENS}). Tire algumas.`);

  // Quem paga: chave da pessoa, ou um dos 2 clientes grátis (e no máximo 3 gerações nele).
  const { resolveAi } = await import("./ai-access.server");
  const { data: ac } = await db.from("nativo_client_acervo").select("generations").eq("client_id", ctx.clientId).maybeSingle();
  const gens = ac?.generations ?? 0;
  let ai: Awaited<ReturnType<typeof resolveAi>>;
  try { ai = await resolveAi(ctx.orgId, ctx.clientId); } catch (e: any) { return erro(request, 402, String(e?.message ?? "Conecte a sua IA pra continuar."), "needs_ai"); }
  const { LUZERIA_ORG_ID } = await import("./api.functions");
  const gratis = !ai.own && ctx.orgId !== LUZERIA_ORG_ID;
  if (gratis && gens >= GERACOES_GRATIS_POR_CLIENTE) {
    return erro(request, 402, `O teste grátis deste cliente já fez ${GERACOES_GRATIS_POR_CLIENTE} acervos. Pra continuar, conecte a sua IA em Configurações → Integrações → Inteligência artificial.`, "needs_ai");
  }

  // Baixa as imagens (só do bucket da agência).
  const imagens = [];
  for (const r of refs) {
    const { data: blob, error } = await supabaseAdmin.storage.from("nativo-media").download(r.path);
    if (error || !blob) return erro(request, 400, "Uma das imagens de referência não abriu. Envie de novo.");
    if (blob.size > MAX_BYTES_IMAGEM) return erro(request, 400, "Uma imagem ficou grande demais. Envie de novo.");
    const type = blob.type === "image/png" || blob.type === "image/webp" ? blob.type : "image/jpeg";
    imagens.push({ tipo: r.tipo, mediaType: type as "image/jpeg" | "image/png" | "image/webp", data: Buffer.from(await blob.arrayBuffer()).toString("base64") });
  }
  const { data: kit } = await db.from("nativo_brand_kits").select("*").eq("client_id", ctx.clientId).eq("org_id", ctx.orgId).maybeSingle();
  const handleKit = kit?.handle ? `@${String(kit.handle).replace(/^@+/, "")}` : undefined;

  const { gerarAcervo } = await import("./nativo-acervo-core.server");
  const out = await gerarAcervo(ai.client, { cliente: ctx.clientName, arroba: handleKit, temLogo: !!kit?.logo_path, imagens });

  // Guarda o perfil e conta a geração (só conta nas feitas com a chave da plataforma).
  const agora = new Date().toISOString();
  await db.from("nativo_client_acervo").upsert({
    client_id: ctx.clientId, org_id: ctx.orgId, perfil: out.acervo.perfil,
    generations: gens + (gratis ? 1 : 0), last_generated_at: agora, updated_at: agora,
  });

  // Completa o kit do cliente com o que a IA entendeu (só o que ainda estiver vazio).
  const p = out.acervo.perfil;
  const hex = (c: string) => /^#[0-9a-f]{6}$/i.test(c);
  const cores = p.paleta.map((x) => x.hex.toUpperCase()).filter(hex).slice(0, 6);
  const arroba = p.arroba.replace(/^@+/, "");
  const arrobaOk = /^[A-Za-z0-9._]{1,60}$/.test(arroba) ? arroba : null;
  if (!kit) {
    await db.from("nativo_brand_kits").insert({ org_id: ctx.orgId, client_id: ctx.clientId, name: ctx.clientName.slice(0, 120), colors: cores, title_font: p.fonte_titulo, body_font: p.fonte_texto, handle: arrobaOk });
  } else {
    const patch: Record<string, unknown> = {};
    if (!Array.isArray(kit.colors) || kit.colors.length === 0) patch.colors = cores;
    if (!kit.title_font) patch.title_font = p.fonte_titulo;
    if (!kit.body_font) patch.body_font = p.fonte_texto;
    if (!kit.handle && arrobaOk) patch.handle = arrobaOk;
    if (Object.keys(patch).length) await db.from("nativo_brand_kits").update(patch).eq("id", kit.id);
  }

  return json(request, 200, { ok: true, acervo: out.acervo, own: ai.own, tokens: { input: out.input, output: out.output } });
}
