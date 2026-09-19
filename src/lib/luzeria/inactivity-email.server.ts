// Server-only: e-mails da régua de inatividade — avisa 5 e 2 dias antes do
// fim do teste se ainda faltar cliente cadastrado e/ou Google Drive
// conectado, e avisa quando a conta é de fato desativada. Nunca menciona
// Instagram aqui — só client/drive são obrigatórios pra régua de
// desativação (nem toda agência usa Instagram, ver [[project_modoluzeria]]).
import type { ActivationChecklistItem } from "./activation-nudge-email.server";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const ITEM_LABEL: Record<ActivationChecklistItem, string> = {
  client: "Cadastrar pelo menos 1 cliente",
  drive: "Conectar o Google Drive",
  instagram: "Conectar o Instagram",
};

function missingListHtml(missing: ActivationChecklistItem[]) {
  return missing.map((k) => `<li style="margin:0 0 4px 0;">${esc(ITEM_LABEL[k])}</li>`).join("");
}

/** daysLeft: quantos dias faltam pro fim do teste (usado nos 2 avisos
 * antes da desativação). null = já foi desativada agora (aviso final). */
export function buildInactivityEmailHtml(params: { name: string; missing: ActivationChecklistItem[]; daysLeft: number | null }) {
  const firstName = esc(params.name.trim().split(" ")[0] || params.name.trim());
  const appUrl = "https://www.modocriador.com.br/auth";
  const lime = "#C8D44E";
  const ink = "#16171B";
  const isFinal = params.daysLeft === null;

  const title = isFinal
    ? `${firstName}, sua conta foi pausada`
    : `${firstName}, seu teste termina em ${params.daysLeft} dia${params.daysLeft === 1 ? "" : "s"}`;
  const body = isFinal
    ? `Como o período de teste terminou sem esses passos concluídos, sua conta no Modo Criador foi pausada — nenhum dado foi apagado. É só responder este e-mail ou chamar a gente no WhatsApp que reativamos na hora.`
    : `Pra continuar usando o Modo Criador depois do teste, falta completar:`;

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
              <td style="padding:16px 32px 0 32px;">
                <div style="font-size:22px; font-weight:800; color:${ink}; line-height:1.3;">${title}</div>
                <p style="font-size:14px; line-height:1.6; color:#3C3F33; margin:12px 0 0 0;">${body}</p>
              </td>
            </tr>

            ${!isFinal ? `
            <tr>
              <td style="padding:16px 32px 0 32px;">
                <ul style="margin:0; padding-left:18px; font-size:13.5px; line-height:1.6; color:${ink}; font-weight:700;">
                  ${missingListHtml(params.missing)}
                </ul>
              </td>
            </tr>` : ""}

            <tr>
              <td style="padding:24px 32px 0 32px;" align="center">
                <a href="${appUrl}" style="display:inline-block; background-color:${lime}; color:${ink}; font-size:14px; font-weight:800; text-decoration:none; padding:13px 28px; border-radius:8px;">
                  ${isFinal ? "Falar com o suporte" : "Resolver agora"}
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
