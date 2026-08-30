/**
 * Extensão do Modo Criador — salva a página atual na Biblioteca de
 * Referências.
 *
 * Fala direto com o Supabase, igual o app faz. Não existe backend próprio:
 * quem decide o que pode ser lido e gravado são as políticas de RLS do
 * banco, as mesmas que já protegem o app. A chave usada aqui é a
 * publicável (a mesma que vai no site), não dá acesso a nada sozinha.
 */

const SUPABASE_URL = "https://grmayzeeemilvhjeninh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdybWF5emVlZW1pbHZoamVuaW5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyODcxNDYsImV4cCI6MjA5ODg2MzE0Nn0.SITbkkulcQu-Gkr8kNg5nyjMf-6BTiUjzff9M2hS1vg";

const $ = (id) => document.getElementById(id);
const telas = {
  carregando: $("tela-carregando"),
  login: $("tela-login"),
  salvar: $("tela-salvar"),
  ok: $("tela-ok"),
};

function mostrar(nome) {
  for (const [chave, el] of Object.entries(telas)) {
    el.classList.toggle("oculto", chave !== nome);
  }
}

function erro(el, msg) {
  el.textContent = msg;
  el.classList.remove("oculto");
}
function limparErro(el) {
  el.classList.add("oculto");
}

/* ---------------- sessão ---------------- */

async function lerSessao() {
  const { sessao } = await chrome.storage.local.get("sessao");
  return sessao ?? null;
}
async function gravarSessao(s) {
  await chrome.storage.local.set({ sessao: s });
}
async function apagarSessao() {
  await chrome.storage.local.remove(["sessao", "perfil"]);
}

function guardarDaResposta(r) {
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    // Renova um minuto antes de vencer, pra não esbarrar no limite.
    expiraEm: Date.now() + (r.expires_in ?? 3600) * 1000 - 60_000,
    userId: r.user?.id ?? null,
  };
}

async function entrar(email, senha) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ email, password: senha }),
  });
  const corpo = await res.json().catch(() => ({}));
  if (!res.ok) {
    const bruto = corpo.error_description || corpo.msg || corpo.error || "";
    const credenciaisErradas = /invalid login credentials/i.test(bruto);
    const naoConfirmado = /email not confirmed/i.test(bruto);
    throw new Error(
      credenciaisErradas ? "E-mail ou senha incorretos."
        : naoConfirmado ? "Confirme seu e-mail antes de entrar."
        : "Não consegui entrar. Confira sua conexão e tente de novo.",
    );
  }
  const s = guardarDaResposta(corpo);
  await gravarSessao(s);
  return s;
}

async function renovar(sessao) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: sessao.refreshToken }),
  });
  if (!res.ok) throw new Error("sessao-expirada");
  const s = guardarDaResposta(await res.json());
  await gravarSessao(s);
  return s;
}

/** Devolve uma sessão válida, renovando se precisar. */
async function sessaoValida() {
  const s = await lerSessao();
  if (!s) return null;
  if (Date.now() < s.expiraEm) return s;
  try {
    return await renovar(s);
  } catch {
    await apagarSessao();
    return null;
  }
}

/* ---------------- dados ---------------- */

async function api(caminho, sessao, opcoes = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    ...opcoes,
    headers: {
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${sessao.accessToken}`,
      "content-type": "application/json",
      ...(opcoes.headers ?? {}),
    },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Erro ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

/** Perfil da pessoa: precisa do org_id pra gravar, e de active pra saber se
 * a conta já foi aprovada (cadastro novo entra pendente). */
async function carregarPerfil(sessao) {
  const linhas = await api(
    `profiles?id=eq.${sessao.userId}&select=org_id,active,name`,
    sessao,
  );
  return linhas?.[0] ?? null;
}

async function carregarClientes(sessao, orgId) {
  return api(
    `clients?org_id=eq.${orgId}&archived=eq.false&select=id,name,category&order=name.asc`,
    sessao,
  );
}

async function salvarReferencia(sessao, { orgId, clientId, titulo, link, notas }) {
  await api("reference_library_items", sessao, {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({
      org_id: orgId,
      client_id: clientId,
      title: titulo,
      links: [{ label: null, url: link }],
      notes: notas || null,
      tags: [],
      created_by: sessao.userId,
    }),
  });
}

/* ---------------- tela ---------------- */

let estado = { sessao: null, orgId: null };

async function preencherDaAba() {
  try {
    const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!aba) return;
    if (aba.title) $("titulo").value = aba.title.slice(0, 160);
    if (aba.url && /^https?:/.test(aba.url)) $("link").value = aba.url;
  } catch {
    /* sem permissão pra ler a aba — a pessoa preenche na mão */
  }
}

async function abrirTelaSalvar(sessao) {
  const perfil = await carregarPerfil(sessao);
  if (!perfil) throw new Error("Não achei seu perfil no Modo Criador.");
  if (perfil.active !== true) {
    throw new Error("Sua conta ainda está aguardando aprovação de um administrador.");
  }

  estado = { sessao, orgId: perfil.org_id };

  const clientes = await carregarClientes(sessao, perfil.org_id);
  const destino = $("destino");
  destino.innerHTML = "";
  destino.append(new Option("Biblioteca geral da agência", ""));
  for (const c of clientes ?? []) {
    destino.append(new Option(c.category ? `${c.name} — ${c.category}` : c.name, c.id));
  }

  await preencherDaAba();
  mostrar("salvar");
  $("titulo").focus();
}

/* ---------------- eventos ---------------- */

$("tela-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  limparErro($("erro-login"));
  const botao = $("btn-entrar");
  botao.disabled = true;
  botao.textContent = "Entrando...";
  try {
    const sessao = await entrar($("email").value.trim(), $("senha").value);
    await abrirTelaSalvar(sessao);
  } catch (err) {
    erro($("erro-login"), err.message);
  } finally {
    botao.disabled = false;
    botao.textContent = "Entrar";
  }
});

$("tela-salvar").addEventListener("submit", async (e) => {
  e.preventDefault();
  limparErro($("erro-salvar"));
  const botao = $("btn-salvar");
  botao.disabled = true;
  botao.textContent = "Salvando...";
  try {
    const destino = $("destino");
    await salvarReferencia(estado.sessao, {
      orgId: estado.orgId,
      clientId: destino.value || null,
      titulo: $("titulo").value.trim(),
      link: $("link").value.trim(),
      notas: $("notas").value.trim(),
    });
    $("ok-destino").textContent =
      destino.value ? `Em ${destino.selectedOptions[0].textContent}` : "Na biblioteca geral";
    mostrar("ok");
  } catch (err) {
    erro($("erro-salvar"), "Não consegui salvar. Confira sua conexão e tente de novo.");
    console.error(err);
  } finally {
    botao.disabled = false;
    botao.textContent = "Salvar na biblioteca";
  }
});

$("btn-outro").addEventListener("click", async () => {
  $("notas").value = "";
  limparErro($("erro-salvar"));
  await preencherDaAba();
  mostrar("salvar");
  $("titulo").focus();
});

$("btn-sair").addEventListener("click", async () => {
  await apagarSessao();
  $("senha").value = "";
  limparErro($("erro-login"));
  mostrar("login");
  $("email").focus();
});

/* ---------------- início ---------------- */

(async function iniciar() {
  const sessao = await sessaoValida();
  if (!sessao) {
    mostrar("login");
    $("email").focus();
    return;
  }
  try {
    await abrirTelaSalvar(sessao);
  } catch (err) {
    await apagarSessao();
    mostrar("login");
    erro($("erro-login"), err.message);
  }
})();
