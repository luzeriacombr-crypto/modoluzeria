import { Link } from "@tanstack/react-router";
import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";

const BG_BLUE = "#0A0E23";

export function TermsOfServicePage() {
  return (
    <div className="min-h-screen text-white" style={{ background: BG_BLUE, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <header className="flex items-center justify-between px-5 sm:px-10 py-5 border-b border-white/10">
        <Link to="/">
          <ModoCriadorLogo variant="brand" className="h-6 w-auto" />
        </Link>
        <Link to="/assinar" className="text-sm text-white/70 hover:text-white transition">
          ← Voltar
        </Link>
      </header>

      <main className="max-w-[720px] mx-auto px-5 sm:px-10 py-14">
        <h1 className="text-3xl font-black mb-2">Termos de Serviço</h1>
        <p className="text-white/50 text-sm mb-10">Última atualização: agosto de 2026</p>

        <div className="space-y-8 text-white/80 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-2">1. Sobre o serviço</h2>
            <p>
              O Modo Criador é uma plataforma da Luzeria Estúdio para gestão de conteúdo de agências de
              social media: calendário de postagens, aprovação de clientes, organização de arquivos e
              relatórios de produtividade da equipe. Ao criar uma conta, você concorda com estes termos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">2. Cadastro e responsabilidade da conta</h2>
            <p>
              Você é responsável por manter a confidencialidade da sua senha e por todas as atividades
              realizadas na sua conta e nas contas dos membros da sua equipe que você convidar. Informe-nos
              imediatamente sobre qualquer uso não autorizado.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">3. Assinatura e pagamento</h2>
            <p>
              O acesso à plataforma é feito por assinatura mensal, com um período de teste gratuito de 7
              dias. Os pagamentos são processados pelo nosso parceiro de cobrança (Asaas); não armazenamos
              dados completos de cartão de crédito. A assinatura renova automaticamente a cada ciclo, salvo
              cancelamento antes da próxima cobrança. Você pode cancelar a qualquer momento nas
              Configurações da sua conta.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">4. Seu conteúdo</h2>
            <p>
              Todo conteúdo que você e seus clientes enviam (textos, imagens, vídeos e arquivos) continua
              sendo propriedade sua. Você concede ao Modo Criador apenas a licença necessária para
              armazenar, processar e exibir esse conteúdo dentro da plataforma, para viabilizar o serviço —
              incluindo, quando você conectar sua própria conta do Google Drive ou do Instagram, o envio
              desse conteúdo diretamente a essas contas a seu pedido.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">5. Uso aceitável</h2>
            <p>
              Não é permitido usar a plataforma para publicar conteúdo ilegal, violar direitos de terceiros,
              tentar acessar dados de outras agências, ou de qualquer forma comprometer a segurança do
              serviço. Contas que violarem estas regras podem ser suspensas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">6. Integrações com terceiros (Google Drive, Instagram)</h2>
            <p>
              Ao conectar sua conta do Google Drive ou a conta do Instagram de um cliente, você autoriza o
              Modo Criador a acessar essas contas exclusivamente para as funções descritas na plataforma
              (backup de arquivos, publicação de posts aprovados). Você pode desconectar essas integrações a
              qualquer momento.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">7. Limitação de responsabilidade</h2>
            <p>
              O Modo Criador é fornecido "como está". Fazemos o possível para manter o serviço disponível e
              seus dados seguros, mas não garantimos operação ininterrupta e não nos responsabilizamos por
              perdas indiretas decorrentes do uso da plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">8. Alterações nestes termos</h2>
            <p>
              Podemos atualizar estes termos ocasionalmente. Mudanças relevantes serão comunicadas por
              e-mail ou dentro da própria plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">9. Contato</h2>
            <p>
              Dúvidas sobre estes termos podem ser enviadas para{" "}
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
