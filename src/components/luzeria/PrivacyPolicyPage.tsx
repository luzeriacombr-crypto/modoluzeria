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
        <p className="text-foreground/50 text-sm mb-10">Última atualização: 2 de outubro de 2026</p>

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
            <h2 className="text-lg font-bold text-foreground mb-2">7. Integração com TikTok</h2>
            <p>
              Se sua agência conectar a conta do TikTok de um cliente ao Modo Criador, a autorização é feita
              pelo login oficial do TikTok — nós nunca recebemos a senha. Coletamos e armazenamos o
              identificador da conta (open_id), o nome de exibição, a foto do perfil e os tokens de acesso
              fornecidos pelo TikTok. O nome e a foto servem apenas para mostrar qual conta está conectada;
              os tokens são usados exclusivamente para enviar ao TikTok os vídeos que a agência escolher
              publicar, com as opções de privacidade, comentários, Dueto, Stitch e conteúdo comercial
              definidas por ela. Não lemos os vídeos, mensagens, seguidores ou outros dados da conta, e nada
              é publicado sem uma ação da agência. Os tokens ficam guardados apenas no servidor, sem acesso
              pelos usuários da plataforma, e não são compartilhados com terceiros. A agência pode
              desconectar a conta a qualquer momento dentro da plataforma, o que revoga o acesso no TikTok
              e exclui os dados de conexão armazenados; também é possível revogar o acesso pelas
              configurações do próprio TikTok. O uso dos dados do TikTok segue os Termos de Serviço e a
              Política de Privacidade do TikTok.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">8. Integração com Google (Login, Drive e Agenda)</h2>
            <p className="mb-3">
              Todas as conexões com o Google são feitas pelo login oficial do Google — nós nunca recebemos a
              sua senha. Cada conexão é opcional e pode ser desfeita a qualquer momento.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-foreground">Entrar com Google:</strong> recebemos seu nome, e-mail e
                foto de perfil, usados apenas para criar e identificar sua conta no Modo Criador.
              </li>
              <li>
                <strong className="text-foreground">Google Drive (conectado pela agência):</strong> o Modo
                Criador acessa apenas os arquivos e pastas que ele mesmo cria (por exemplo, as pastas
                "Entregas" de cada cliente e os arquivos que a equipe envia pela plataforma) e os que a
                agência escolhe ou vincula. Esses arquivos são usados para organizar as entregas por
                cliente e mês, mostrar miniaturas e prévias dentro da plataforma, publicar nas redes
                sociais que a agência conectou os conteúdos que ela aprovar, montar as seleções e entregas
                de fotos compartilhadas com os clientes dela e, quando a agência usa o planejamento com
                inteligência artificial, enviar os arquivos de marca daquele cliente ao nosso provedor de
                IA apenas para gerar esse planejamento. Guardamos o e-mail da conta conectada e um token de
                acesso, que fica só no servidor, sem acesso pelos usuários da plataforma.
              </li>
              <li>
                <strong className="text-foreground">Google Agenda (conectada por cada usuário):</strong>
                lemos os eventos dos próximos 7 dias da sua agenda principal, apenas para mostrá-los a você
                no painel "Minhas demandas" — ninguém mais da sua equipe vê a sua agenda. Também criamos
                eventos na sua agenda quando você pede (por exemplo, datas de captação de campanhas). Não
                guardamos o conteúdo dos seus eventos; guardamos apenas um token de acesso e o
                identificador dos eventos que o próprio Modo Criador criou, para poder atualizá-los ou
                removê-los.
              </li>
            </ul>
            <p className="mt-3">
              O uso e a transferência, para qualquer outro aplicativo, das informações recebidas das APIs do
              Google pelo Modo Criador seguem a{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Política de Dados do Usuário dos Serviços de API do Google
              </a>
              , incluindo os requisitos de Uso Limitado. Não vendemos esses dados, não os usamos para
              publicidade e não os usamos para treinar modelos de inteligência artificial. Ninguém da nossa
              equipe lê esses dados, exceto com a sua autorização expressa (por exemplo, num atendimento de
              suporte), por motivo de segurança ou quando exigido por lei.
            </p>
            <p className="mt-3">
              Para desconectar, use a opção "Desconectar" dentro da plataforma (em Configurações, para o
              Drive, e no seu Perfil, para a Agenda), o que exclui os dados de conexão armazenados. Você
              também pode revogar o acesso a qualquer momento em{" "}
              <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="underline">
                myaccount.google.com/permissions
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">9. Extensão do Chrome</h2>
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
            <h2 className="text-lg font-bold text-foreground mb-2">10. Nativo (editor de posts)</h2>
            <p>
              O Nativo (nativo.modocriador.com.br) é um editor de posts e stories incluído no Modo Criador,
              que usa a mesma conta. Nele, guardamos:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Seus projetos e modelos (textos, cores, posição dos elementos) e as fotos e imagens que você envia, separados por agência;</li>
              <li>Os dados que você preenche em "Seus dados" (nome, @ do Instagram, profissão e foto), usados só pra personalizar os modelos;</li>
              <li>Os kits de marca dos clientes (cores, fontes, @ e logo). Pra montar o kit, o Nativo lê do Modo Criador o nome, a cor e a foto do cliente e o @ do Instagram conectado. O token de acesso do Instagram nunca é lido pelo Nativo.</li>
            </ul>
            <p className="mt-2">
              O recorte de pessoas e objetos (efeito 3D e adesivo) é feito no seu próprio aparelho: a foto
              não é enviada a nenhum servidor pra isso. O Nativo não usa ferramentas de rastreamento nem
              publicidade; fontes e bibliotecas ficam hospedadas no próprio site, e o navegador guarda só
              preferências de tela (como dicas já vistas). Projetos ficam guardados até você apagá-los.
              Fotos enviadas que não estejam mais em nenhum projeto são apagadas automaticamente depois de
              30 dias. Ao enviar fotos de outras pessoas, a agência é responsável por ter autorização pra
              usar a imagem delas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">11. Seus direitos</h2>
            <p>
              Você pode solicitar, a qualquer momento, a confirmação, correção, exportação ou exclusão dos
              seus dados pessoais, conforme previsto na LGPD. Para isso, entre em contato pelo e-mail
              abaixo.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">12. Contato</h2>
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
