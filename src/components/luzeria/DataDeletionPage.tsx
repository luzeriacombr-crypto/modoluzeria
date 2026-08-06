import { Link } from "@tanstack/react-router";
import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";

const BG_BLUE = "#0A0E23";

export function DataDeletionPage() {
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
        <h1 className="text-3xl font-black mb-2">Instruções de Exclusão de Dados</h1>
        <p className="text-white/50 text-sm mb-10">Última atualização: agosto de 2026</p>

        <div className="space-y-8 text-white/80 text-sm leading-relaxed">
          <section>
            <p>
              Se você conectou sua conta do Facebook ou Instagram ao Modo Criador (para gerenciar sua
              própria agência, ou porque uma agência que usa o Modo Criador conectou a conta do Instagram
              do seu negócio), você pode solicitar a exclusão dos dados que armazenamos a partir dessa
              conexão a qualquer momento.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">O que fazemos com esses dados</h2>
            <p>
              Quando uma conta do Instagram é conectada, armazenamos apenas o necessário para publicar
              posts aprovados nela: o identificador da conta, o nome de usuário e um token de acesso
              autorizado por você. Não coletamos nem armazenamos publicações, seguidores, mensagens ou
              qualquer outro dado do Instagram além disso.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">Como solicitar a exclusão</h2>
            <p>Você tem duas formas de remover esses dados:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                <strong>Direto na plataforma:</strong> na Ficha do Cliente cujo Instagram foi conectado,
                clique em "Desconectar" na seção Instagram — isso apaga imediatamente o token e os dados
                da conta armazenados.
              </li>
              <li>
                <strong>Por e-mail:</strong> envie uma solicitação para{" "}
                <a href="mailto:junior.reis@live.com" className="underline">
                  junior.reis@live.com
                </a>{" "}
                informando a conta do Instagram ou do Facebook em questão. Processamos a exclusão em até 5
                dias úteis e confirmamos por e-mail quando concluída.
              </li>
            </ul>
          </section>

          <section>
            <p className="text-white/50">
              Esta página também serve como URL de exclusão de dados exigida pela Meta para apps que usam
              Login do Facebook ou Login do Instagram.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
