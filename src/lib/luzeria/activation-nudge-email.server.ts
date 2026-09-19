// Server-only: HTML do e-mail diário de ativação — lista só o que ainda
// falta (cliente cadastrado / Google Drive / Instagram), com o benefício
// de cada um. Mandado 1x/dia enquanto faltar pelo menos um item e a
// agência ainda estiver dentro do trial (ver runActivationNudges em
// activation.functions.ts). Mesmo padrão visual/inline do welcome-email.

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type ActivationChecklistItem = "client" | "drive" | "instagram";

const ITEM_COPY: Record<ActivationChecklistItem, { title: string; benefit: string }> = {
  client: {
    title: "Cadastre seus clientes",
    benefit: "Sem eles, o board e a IA de planejamento não têm o que organizar. Leva menos de 2 minutos com o nosso importador — manda até um print de tela.",
  },
  drive: {
    title: "Conecte o Google Drive",
    benefit: "Cada arquivo do cliente (roteiro, imagem, entrega) fica organizado sozinho, sem precisar subir nada na mão nem procurar pasta.",
  },
  instagram: {
    title: "Conecte o Instagram dos clientes",
    benefit: "Publica direto pelo Modo Criador, sem abrir o Instagram — e ainda acompanha o que performou melhor, tudo num lugar só.",
  },
};

export function buildActivationNudgeEmailHtml(params: { name: string; missing: ActivationChecklistItem[] }) {
  const firstName = esc(params.name.trim().split(" ")[0] || params.name.trim());
  const appUrl = "https://www.modocriador.com.br/auth";
  const lime = "#C8D44E";
  const ink = "#16171B";
  const blue = "#2563EB";
  const blueBg = "#EEF3FF";
  const isSingle = params.missing.length === 1;

  const items = params.missing
    .map((key) => ITEM_COPY[key])
    .map(
      (it) => `
        <tr>
          <td style="padding:14px 0; border-bottom:1px solid #E1E8C4;">
            <div style="font-size:13px; font-weight:800; color:${ink};">☐ ${esc(it.title)}</div>
            <p style="font-size:12.5px; line-height:1.55; color:#3C3F33; margin:6px 0 0 0;">${esc(it.benefit)}</p>
          </td>
        </tr>`,
    )
    .join("");

  return `
<!doctype html>
<html>
  <body style="margin:0; padding:0; background-color:#F2F2ED; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F2F2ED; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#FFFFFF; border-radius:16px; overflow:hidden;">

            <tr>
              <td style="padding:28px 32px 0 32px;">
                <img src="https://www.modocriador.com.br/icon-512.png" width="32" height="32" alt="" style="border-radius:7px; display:block;" />
                <div style="font-size:12px; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; color:#8A8F7A; margin-top:8px;">MODO CRIADOR</div>
              </td>
            </tr>

            <tr>
              <td style="padding:18px 32px 0 32px;">
                <span style="display:inline-block; background-color:${blueBg}; color:${blue}; font-size:11px; font-weight:800; letter-spacing:0.02em; padding:5px 12px; border-radius:999px;">
                  Sentimos sua falta por aqui
                </span>
              </td>
            </tr>

            <tr>
              <td style="padding:14px 32px 0 32px;">
                <div style="font-size:22px; font-weight:800; color:${ink}; line-height:1.3;">${firstName}, falta pouco pra aproveitar tudo</div>
                <p style="font-size:14px; line-height:1.6; color:#3C3F33; margin:12px 0 0 0;">
                  Você já criou sua conta, mas ${isSingle ? "ainda falta um passo simples" : "ainda faltam alguns passos simples"} pra tudo funcionar de verdade — sem isso, o board e a IA de planejamento ficam sem nada pra organizar. ${isSingle ? "Essa coisa leva" : "Essas coisas levam"} só alguns minutos, e depois é só usar.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 32px 0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F7E8; border-radius:12px; border:1px solid #E1E8C4; padding:4px 18px;">
                  ${items}
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 32px 0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${blueBg}; border-radius:10px; border-left:3px solid ${blue};">
                  <tr>
                    <td style="padding:12px 16px;">
                      <p style="font-size:12.5px; line-height:1.55; color:#1E3A8A; margin:0;">
                        <strong>Volte quando quiser</strong> — sua conta continua aberta esperando por você, e o time de suporte ajuda se travar em qualquer parte.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 32px 0 32px;" align="center">
                <a href="${appUrl}" style="display:inline-block; background-color:${lime}; color:${ink}; font-size:14px; font-weight:800; text-decoration:none; padding:13px 30px; border-radius:8px;">
                  Voltar e resolver agora →
                </a>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 32px 32px 32px;">
                <p style="font-size:11.5px; line-height:1.6; color:#9AA089; margin:0; text-align:center;">
                  Prefere que a gente faça isso junto com você? Chama o
                  <a href="https://wa.me/5599991135486" style="color:#6B7A2E; font-weight:700; text-decoration:underline;">Júnior, nosso suporte, no WhatsApp</a>.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
