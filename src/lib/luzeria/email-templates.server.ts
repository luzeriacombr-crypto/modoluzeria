// Server-only: todos os e-mails automáticos que as agências recebem, num
// lugar só — texto padrão de cada um, variáveis aceitas e o visual comum.
// A aba "E-mails" (Configurações, só a plataforma) edita esses textos; o
// que foi editado fica em public.email_templates e sobrepõe o padrão daqui.
// Campo vazio no banco = volta pro padrão.
//
// Visual em tabela/estilo inline de propósito: é o que sobrevive intacto no
// Gmail, Outlook e Apple Mail (nada de CSS externo/flexbox/grid). Toda saída
// vai também em texto puro — e-mail só com HTML pesa contra nos filtros de
// spam.

export const EMAIL_TEMPLATE_KEYS = [
  "welcome", "team_invite", "activation_nudge", "trial_ending",
  "account_paused", "invoice", "password_reset", "footer",
] as const;
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export type EmailTemplateFields = {
  subject: string;
  heading: string;
  body: string;
  /** Caixa verde de destaque abaixo do texto (vazio = sem caixa). */
  highlight: string;
  buttonLabel: string;
};

type TemplateDef = {
  label: string;
  /** Quando/pra quem esse e-mail é mandado — aparece no cartão da aba. */
  when: string;
  defaults: EmailTemplateFields;
  /** Variáveis aceitas nos textos, com um exemplo (usado na prévia). */
  variables: Record<string, string>;
  /** Parte automática que não é editável (lista do que falta, valores da
   * fatura) — só descrita no cartão pra ficar claro o que muda sozinho. */
  automaticPart?: string;
  heroImage?: boolean;
  /** Campos que não fazem sentido nesse e-mail (escondidos na edição). */
  hiddenFields?: (keyof EmailTemplateFields)[];
};

export const WHATSAPP_URL = "https://wa.me/5599991135486";
export const APP_URL = "https://www.modocriador.com.br/auth";

export const EMAIL_TEMPLATES: Record<EmailTemplateKey, TemplateDef> = {
  welcome: {
    label: "Boas-vindas",
    when: "Logo depois que alguém cria uma agência nova (e-mail/senha ou Google).",
    heroImage: true,
    variables: { nome: "Maria" },
    defaults: {
      subject: "Bem-vindo(a) ao Modo Criador 🎉",
      heading: "Bem-vindo(a), {nome}! 🎉",
      body: "Sua agência já está pronta no Modo Criador. Agora é só montar seu fluxo, chamar seu time e começar a organizar o conteúdo dos seus clientes num lugar só.",
      highlight: "**✨ Migrar seus clientes ficou muito mais fácil**\n\nJá organizava seus clientes no Trello, ClickUp, Notion, mLabs ou até numa planilha? Não precisa digitar tudo de novo na mão. Manda um arquivo, uma planilha ou até um print de tela: a IA lê e organiza tudo pra você revisar antes de importar.",
      buttonLabel: "Entrar no Modo Criador",
    },
  },
  team_invite: {
    label: "Convite de equipe",
    when: "Quando o dono de uma agência adiciona alguém na equipe.",
    variables: { nome: "Carlos", convidou: "Maria", agencia: "Agência Exemplo", email: "carlos@exemplo.com" },
    defaults: {
      subject: "{convidou} te convidou pro Modo Criador",
      heading: "Você foi convidado(a)! 🎉",
      body: "Oi, {nome}! {convidou}, da agência {agencia}, acabou de te dar acesso ao Modo Criador, a plataforma que o time usa pra organizar o conteúdo dos clientes, do planejamento à publicação.",
      highlight: "Seu login é **{email}**. Se ainda não tem a senha de acesso, peça pra {convidou}.",
      buttonLabel: "Entrar no Modo Criador",
    },
  },
  activation_nudge: {
    label: "Lembrete: já cadastrou algum cliente?",
    when: "No 2º e no 4º dia depois do cadastro, se a agência ainda não cadastrou nenhum cliente.",
    variables: { nome: "Maria" },
    automaticPart: "Lista do que ainda falta fazer (ex.: cadastrar clientes), logo abaixo do texto.",
    defaults: {
      subject: "{nome}, já cadastrou algum cliente?",
      heading: "{nome}, falta pouco pra aproveitar tudo",
      body: "Você já criou sua conta, mas ainda falta um passo simples pra tudo funcionar de verdade. Sem isso, o board e a IA de planejamento ficam sem nada pra organizar. Leva só alguns minutos, e depois é só usar.",
      highlight: "**Volte quando quiser:** sua conta continua aberta esperando por você, e o suporte ajuda se travar em qualquer parte.",
      buttonLabel: "Voltar e resolver agora →",
    },
  },
  trial_ending: {
    label: "Teste terminando (5 e 2 dias antes)",
    when: "5 e 2 dias antes do fim do teste, se ainda faltar cliente cadastrado e/ou Google Drive conectado.",
    variables: { nome: "Maria", dias: "5 dias" },
    automaticPart: "Lista do que ainda falta (cadastrar cliente, conectar o Google Drive), logo abaixo do texto.",
    defaults: {
      subject: "{nome}, seu teste no Modo Criador termina em {dias}",
      heading: "{nome}, seu teste termina em {dias}",
      body: "Pra continuar usando o Modo Criador depois do teste, falta completar:",
      highlight: "",
      buttonLabel: "Resolver agora",
    },
  },
  account_paused: {
    label: "Conta pausada",
    when: "Quando o teste termina sem cliente cadastrado ou sem Google Drive conectado, e a conta é pausada.",
    variables: { nome: "Maria" },
    defaults: {
      subject: "{nome}, sua conta no Modo Criador foi pausada",
      heading: "{nome}, sua conta foi pausada",
      body: "Como o período de teste terminou sem esses passos concluídos, sua conta no Modo Criador foi pausada. Nenhum dado foi apagado. É só chamar a gente no WhatsApp que reativamos na hora.",
      highlight: "",
      buttonLabel: "Falar com o suporte",
    },
  },
  invoice: {
    label: "Fatura (reenvio)",
    when: "Quando a agência pede pra receber de novo o link da fatura em aberto (tela Financeiro).",
    variables: { nome: "Maria", agencia: "Agência Exemplo", valor: "R$ 97,00", vencimento: "10/10/2026" },
    automaticPart: "Link do boleto em PDF, quando existir.",
    defaults: {
      subject: "Sua fatura do Modo Criador vence em {vencimento}",
      heading: "Sua fatura do Modo Criador",
      body: "Oi! Aqui está de novo o link da sua fatura em aberto do Modo Criador ({agencia}).",
      highlight: "**Valor:** {valor}\n**Vencimento:** {vencimento}",
      buttonLabel: "Ver fatura e pagar (PIX, boleto ou cartão)",
    },
  },
  password_reset: {
    label: "Redefinição de senha",
    when: "Quando alguém da plataforma manda o link de nova senha pra um usuário.",
    variables: { nome: "Maria" },
    defaults: {
      subject: "Redefinição de senha — Modo Criador",
      heading: "Criar uma nova senha",
      body: "Olá, {nome}! Foi solicitada uma redefinição de senha para sua conta no Modo Criador.\n\nSe você não pediu isso, pode ignorar este e-mail.",
      highlight: "",
      buttonLabel: "Criar uma nova senha",
    },
  },
  footer: {
    label: "Rodapé (todos os e-mails acima)",
    when: "Texto pequeno no fim de todos os e-mails acima. O link do WhatsApp do suporte entra sozinho depois dele.",
    variables: {},
    hiddenFields: ["subject", "heading", "highlight", "buttonLabel"],
    defaults: {
      subject: "",
      heading: "",
      body: "Qualquer dúvida, é só responder esse e-mail, que cai direto pra gente.",
      highlight: "",
      buttonLabel: "",
    },
  },
};

export type EmailOverrides = Partial<Record<EmailTemplateKey, Partial<EmailTemplateFields>>>;

/** Textos editados na aba "E-mails". Nunca lança: se o banco falhar, manda
 * com o texto padrão em vez de não mandar nada. */
export async function loadEmailOverrides(): Promise<EmailOverrides> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any).from("email_templates")
      .select("key, subject, heading, body, highlight, button_label");
    const out: EmailOverrides = {};
    (data ?? []).forEach((r: any) => {
      out[r.key as EmailTemplateKey] = {
        subject: r.subject ?? undefined, heading: r.heading ?? undefined, body: r.body ?? undefined,
        highlight: r.highlight ?? undefined, buttonLabel: r.button_label ?? undefined,
      };
    });
    return out;
  } catch (e: any) {
    console.error("[e-mail] não consegui ler os textos editados, usando o padrão:", e?.message);
    return {};
  }
}

export function resolveFields(key: EmailTemplateKey, overrides: EmailOverrides): EmailTemplateFields {
  const d = EMAIL_TEMPLATES[key].defaults;
  const o = overrides[key] ?? {};
  // Texto vazio conta como "não editado" — exceto o destaque, que pode ser
  // apagado de propósito pra tirar a caixa verde.
  const pick = (f: keyof EmailTemplateFields) => {
    const v = o[f];
    if (v == null) return d[f];
    if (f === "highlight") return v;
    return v.trim() ? v : d[f];
  };
  return { subject: pick("subject"), heading: pick("heading"), body: pick("body"), highlight: pick("highlight"), buttonLabel: pick("buttonLabel") };
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function fillVars(text: string, vars: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

/** Parágrafos separados por linha em branco; quebra simples vira <br>;
 * **texto** vira negrito. */
function paragraphsHtml(text: string, style: string) {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    .map((p, i) => `<p style="${style}${i > 0 ? " margin-top:10px;" : ""}">${esc(p).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Versão texto puro: tira a marcação de negrito. */
const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1");

export type RenderedEmail = { subject: string; html: string; text: string };

/** Monta o e-mail final. `extraHtml`/`extraText` são as partes automáticas
 * (lista do que falta, link do boleto), que entram depois do destaque. */
export function renderEmail(
  key: Exclude<EmailTemplateKey, "footer">,
  opts: {
    vars: Record<string, string>;
    buttonUrl: string;
    overrides: EmailOverrides;
    extraHtml?: string;
    extraText?: string;
  },
): RenderedEmail {
  const def = EMAIL_TEMPLATES[key];
  const f = resolveFields(key, opts.overrides);
  const footer = resolveFields("footer", opts.overrides).body;
  const v = (s: string) => fillVars(s, opts.vars);
  const lime = "#C8D44E";
  const ink = "#16171B";
  const subject = v(f.subject);
  const heading = v(f.heading);
  const body = v(f.body);
  const highlight = v(f.highlight).trim();
  const buttonLabel = v(f.buttonLabel);
  const footerText = v(footer).trim();

  const html = `<!doctype html>
<html lang="pt-BR">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head>
  <body style="margin:0; padding:0; background-color:#F2F2ED; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F2F2ED; padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#FFFFFF; border-radius:16px; overflow:hidden;">
          ${def.heroImage ? `<tr><td style="background-color:#0D0D0D; line-height:0;"><img src="https://www.modocriador.com.br/marketing/welcome-email-hero.jpg" width="480" alt="Modo Criador" style="display:block; width:100%; max-width:480px; height:auto;" /></td></tr>` : ""}
          <tr><td style="padding:${def.heroImage ? "24px" : "28px"} 32px 0 32px;">
            <img src="https://www.modocriador.com.br/icon-512.png" width="32" height="32" alt="" style="border-radius:7px; display:block;" />
            <div style="font-size:12px; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; color:#8A8F7A; margin-top:8px;">MODO CRIADOR</div>
          </td></tr>
          <tr><td style="padding:16px 32px 0 32px;">
            <div style="font-size:22px; font-weight:800; color:${ink}; line-height:1.3;">${esc(heading)}</div>
            <div style="margin-top:12px;">${paragraphsHtml(body, "font-size:14px; line-height:1.6; color:#3C3F33; margin:0;")}</div>
          </td></tr>
          ${highlight ? `<tr><td style="padding:20px 32px 0 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F7E8; border-radius:12px; border:1px solid #E1E8C4;">
              <tr><td style="padding:16px 20px;">${paragraphsHtml(highlight, "font-size:13px; line-height:1.55; color:#3C3F33; margin:0;")}</td></tr>
            </table>
          </td></tr>` : ""}
          ${opts.extraHtml ? `<tr><td style="padding:16px 32px 0 32px;">${opts.extraHtml}</td></tr>` : ""}
          <tr><td style="padding:24px 32px 0 32px;" align="center">
            <a href="${esc(opts.buttonUrl)}" style="display:inline-block; background-color:${lime}; color:${ink}; font-size:14px; font-weight:800; text-decoration:none; padding:13px 28px; border-radius:8px;">${esc(buttonLabel)}</a>
          </td></tr>
          <tr><td style="padding:28px 32px 32px 32px;">
            <p style="font-size:11.5px; line-height:1.6; color:#9AA089; margin:0; text-align:center;">
              ${footerText ? `${esc(footerText)} ` : ""}Se preferir, chama o
              <a href="${WHATSAPP_URL}" style="color:#6B7A2E; font-weight:700; text-decoration:underline;">Júnior, nosso suporte, no WhatsApp</a>.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = [
    heading,
    plain(body),
    plain(highlight),
    opts.extraText ?? "",
    `${buttonLabel}: ${opts.buttonUrl}`,
    `—\n${footerText ? `${footerText} ` : ""}WhatsApp do suporte: ${WHATSAPP_URL}\nModo Criador · modocriador.com.br`,
  ].map((s) => s.trim()).filter(Boolean).join("\n\n");

  return { subject, html, text };
}

/** Lista do que ainda falta (ativação e fim do teste) — parte automática. */
export type ChecklistItem = "client" | "drive" | "instagram";
const CHECKLIST_COPY: Record<ChecklistItem, { title: string; benefit: string }> = {
  client: { title: "Cadastrar seus clientes", benefit: "Leva menos de 2 minutos com o importador, dá pra mandar até um print de tela." },
  drive: { title: "Conectar o Google Drive", benefit: "Cada arquivo do cliente fica organizado sozinho, sem subir nada na mão." },
  instagram: { title: "Conectar o Instagram dos clientes", benefit: "Publica direto pelo Modo Criador e acompanha o que performou melhor." },
};
export function checklistParts(missing: ChecklistItem[]) {
  const items = missing.map((k) => CHECKLIST_COPY[k]);
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px; border:1px solid #E1E8C4; padding:4px 18px;">${items.map((it) => `
    <tr><td style="padding:12px 0;">
      <div style="font-size:13px; font-weight:800; color:#16171B;">☐ ${esc(it.title)}</div>
      <p style="font-size:12.5px; line-height:1.55; color:#3C3F33; margin:4px 0 0 0;">${esc(it.benefit)}</p>
    </td></tr>`).join("")}</table>`;
  const text = items.map((it) => `[ ] ${it.title}: ${it.benefit}`).join("\n");
  return { html, text };
}

export function firstName(name: string | null | undefined) {
  const t = (name ?? "").trim();
  return t.split(" ")[0] || t;
}
