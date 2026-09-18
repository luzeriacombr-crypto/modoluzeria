// Server-only: HTML do e-mail mandado pro membro novo quando um admin o
// adiciona na equipe (adminCreateUser) — disparado best-effort, nunca
// derruba a criação da conta se falhar. Mesmo padrão de tabela/estilo
// inline de welcome-email.server.ts (sobrevive intacto em Gmail/Outlook/
// Apple Mail).

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildTeamInviteEmailHtml(params: { name: string; email: string; inviterName: string; agencyName: string }) {
  const firstName = esc(params.name.trim().split(" ")[0] || params.name.trim());
  const inviterFirstName = esc(params.inviterName.trim().split(" ")[0] || params.inviterName.trim());
  const agencyName = esc(params.agencyName.trim());
  const email = esc(params.email.trim());
  const appUrl = "https://www.modocriador.com.br/auth";
  const lime = "#C8D44E";
  const ink = "#16171B";

  return `
<!doctype html>
<html>
  <body style="margin:0; padding:0; background-color:#F2F2ED; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F2F2ED; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#FFFFFF; border-radius:16px; overflow:hidden;">

            <tr>
              <td style="padding:32px 32px 0 32px;">
                <img src="https://www.modocriador.com.br/icon-512.png" width="32" height="32" alt="" style="border-radius:7px; display:block;" />
                <div style="font-size:12px; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; color:#8A8F7A; margin-top:8px;">MODO CRIADOR</div>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 32px 0 32px;">
                <div style="font-size:24px; font-weight:800; color:${ink}; line-height:1.25;">Você foi convidado(a)! 🎉</div>
                <p style="font-size:14px; line-height:1.6; color:#3C3F33; margin:12px 0 0 0;">
                  Oi, ${firstName}! <strong>${inviterFirstName}</strong>, da agência <strong>${agencyName}</strong>, acabou de te dar acesso ao Modo Criador — a plataforma que o time usa pra organizar o conteúdo dos clientes, do planejamento à publicação.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 32px 0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F7E8; border-radius:12px; border:1px solid #E1E8C4;">
                  <tr>
                    <td style="padding:16px 20px;">
                      <p style="font-size:13px; line-height:1.55; color:#3C3F33; margin:0;">
                        Seu login é <strong>${email}</strong>. Se ainda não tem a senha de acesso, peça pra ${inviterFirstName}.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 32px 0 32px;" align="center">
                <a href="${appUrl}" style="display:inline-block; background-color:${lime}; color:${ink}; font-size:14px; font-weight:800; text-decoration:none; padding:13px 28px; border-radius:8px;">
                  Entrar no Modo Criador
                </a>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 32px 32px 32px;">
                <p style="font-size:11.5px; line-height:1.6; color:#9AA089; margin:0; text-align:center;">
                  Qualquer dúvida, é só responder esse e-mail — cai direto pra gente. Ou então chama o
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
