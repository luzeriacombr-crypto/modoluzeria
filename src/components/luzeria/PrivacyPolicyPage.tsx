import { Link } from "@tanstack/react-router";
import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";

const BG_BLUE = "#0A0E23";

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen text-foreground" style={{ background: BG_BLUE, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <header className="flex items-center justify-between px-5 sm:px-10 py-5 border-b border-foreground/10">
        <Link to="/">
          <ModoCriadorLogo variant="brand" className="h-6 w-auto" />
        </Link>
        <Link to="/assinar" className="text-sm text-foreground/70 hover:text-foreground transition">
          ← Voltar
        </Link>
      </header>

      <main className="max-w-[720px] mx-auto px-5 sm:px-10 py-14">
        <h1 className="text-3xl font-black mb-2">Política de Privacidade</h1>
        <p className="text-foreground/50 text-sm mb-10">Última atualização: 30 de agosto de 2026</p>

        <div className="space-y-8 text-foreground/80 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">1. Quem somos</h2>
            <p>
              O Modo Criador é uma plataforma da Luzeria Estúdio para gestão de conteúdo de agências de
              social media e seus clientes. Esta política explica quais dados coletamos, por que, e como
              protegemos essas informações, em conformidade com a Lei Geral de Proteção de Dados (LGPD —
              Lei nº 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">2. Quais dados coletamos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Dados de cadastro: nome, e-mail, senha (armazenada de forma criptografada), nome da agência e CPF/CNPJ.</li>
              <li>Dados de uso: conteúdos, comentários, arquivos e informações que você ou sua equipe inserem na plataforma para gerenciar clientes e postagens.</li>
              <li>Dados de cobrança: processados pelo nosso parceiro de pagamentos; não armazenamos números de cartão de crédito.</li>
              <li>Dados técnicos básicos: endereço IP e informações de acesso, usados para segurança (ex.: prevenir cadastros abusivos).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">3. Por que coletamos</h2>
            <p>
              Usamos esses dados exclusivamente para viabilizar o funcionamento da plataforma: criar e
              autenticar sua conta, gerenciar sua assinatura, permitir a colaboração entre sua equipe e
              seus clientes, e dar suporte quando você precisa de ajuda. Não vendemos nem compartilhamos
              seus dados com terceiros para fins de marketing.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">4. Como protegemos seus dados</h2>
            <p>
              Os dados de cada agência são isolados dos dados de outras agências dentro da plataforma.
              O acesso é protegido por autenticação, e a comunicação com o servidor é sempre criptografada
              (HTTPS). Apenas pessoas autorizadas da sua própria agência têm acesso às informações dos
              seus clientes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">5. Provedores de infraestrutura</h2>
            <p>
              Utilizamos provedores de infraestrutura de confiança para hospedar a plataforma: Supabase,
              Inc. (banco de dados) e Vercel, Inc. (hospedagem da aplicação), ambos com processamento no
              Brasil. Esses provedores têm acesso técnico aos dados armazenados na plataforma na medida
              necessária pra operá-la, e não os utilizam para nenhuma finalidade própria.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">6. Integração com Instagram</h2>
            <p>
              Se sua agência conectar a conta profissional do Instagram de um cliente ao Modo Criador,
              coletamos e armazenamos o nome de usuário, o ID da conta e um token de acesso, usados
              exclusivamente para publicar conteúdo aprovado diretamente nessa conta, a pedido da agência.
              Essa conexão pode ser desfeita a qualquer momento pela agência dentro da plataforma, o que
              exclui imediatamente esses dados armazenados.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">7. Extensão do Chrome</h2>
            <p>
              A extensão "Modo Criador — Salvar referência" fala diretamente com o mesmo banco de dados
              da plataforma, sem servidor próprio. Ela usa seu e-mail e senha para autenticar sua conta —
              essas credenciais são enviadas apenas ao Supabase (nosso provedor de banco de dados) e não
              ficam guardadas na extensão; apenas o token de sessão resultante fica salvo localmente no
              seu navegador, pra você não precisar entrar de novo toda vez. Quando você salva uma
              referência, a extensão lê o título e o link da aba aberta e grava, junto com a observação
              que você escrever, na Biblioteca de Referências do Modo Criador. Ela não lê nem armazena
              nenhum outro conteúdo das páginas que você visita, e não monitora sua navegação.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">8. Seus direitos</h2>
            <p>
              Você pode solicitar, a qualquer momento, a confirmação, correção, exportação ou exclusão dos
              seus dados pessoais, conforme previsto na LGPD. Para isso, entre em contato pelo e-mail
              abaixo.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">9. Contato</h2>
            <p>
              Dúvidas sobre esta política ou solicitações relacionadas aos seus dados podem ser enviadas
              para{" "}
              <a href="mailto:junior.reis@live.com" className="underline">
                junior.reis@live.com
              </a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
