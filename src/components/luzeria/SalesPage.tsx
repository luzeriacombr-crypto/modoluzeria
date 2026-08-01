import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getPublicPlans, publicSignup } from "@/lib/luzeria/signup.functions";
import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";
import heroMockup from "@/assets/hero-mockup.png";

const LIME = "#D7FF3F";
const LIME_ON_LIGHT = "#5B7A00"; // readable lime-family accent for white sections
const BG_BLUE = "#0A0E23";
const BG_BLUE_2 = "#111F5C";
const BG_GREEN = "#0B2A1C";
const BG_WHITE = "#F5F5F0";
const BG_GRAY = "#18181B";

export function SalesPage() {
  const plans = useQuery({ queryKey: ["public-plans"], queryFn: () => getPublicPlans() });
  const signup = useServerFn(publicSignup);

  const [planId, setPlanId] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [taxId, setTaxId] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null | undefined>(undefined);

  const selectablePlans = (plans.data ?? []).filter((p) => p.priceCents != null);

  function scrollToForm(id?: string) {
    if (id) setPlanId(id);
    document.getElementById("assinar-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!planId) { setError("Escolha um plano antes de continuar."); return; }
    setLoading(true);
    setError(null);
    try {
      const r = await signup({
        data: { agencyName, name, email, password, planId, taxId: taxId.replace(/\D/g, ""), website },
      });
      setInvoiceUrl(r.invoiceUrl);
      if (r.invoiceUrl) window.open(r.invoiceUrl, "_blank");
    } catch (err: any) {
      setError(err?.message ?? "Não foi possível concluir seu cadastro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen text-white" style={{ background: "#0A0E23", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-5 sm:px-10 py-5 max-w-[1100px] mx-auto">
        <ModoCriadorLogo variant="brand" className="h-6 w-auto" />
        <Link to="/auth" className="text-sm text-white/70 hover:text-white transition">
          Já tem conta? Entrar →
        </Link>
      </header>

      {/* Hero */}
      <section className="px-5 sm:px-10 max-w-[1200px] mx-auto pt-8 pb-16">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-8 items-center">
          <div className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 border border-white/15 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide mb-6">
              🚀 Gestão de conteúdo pra agência
            </div>
            <h1 className="font-black uppercase leading-[0.95] text-[clamp(2rem,5.5vw,3.75rem)]">
              Pare de perder cliente
              <br />
              por falta de organização.
              <br />
              <span className="font-criador-serif normal-case block" style={{ color: LIME }}>
                Ganhe tempo com o Modo Criador.
              </span>
            </h1>
            <p className="text-white/60 text-base sm:text-lg max-w-[560px] mt-6 leading-relaxed">
              A plataforma que centraliza tudo que um Social Media precisa: produtividade da equipe, calendário de postagens, link aprovação de cliente, organização de arquivos… tudo num só lugar, sem planilha chata ou arquivos perdidos no WhatsApp.
            </p>
            <div className="mt-8">
              <div className="text-white/50 text-sm">A partir de</div>
              <div className="text-4xl font-black">R$ 49,90<span className="text-lg font-normal text-white/50">/mês</span></div>
              <div className="text-white/40 text-xs mt-1">7 dias grátis · Cancele quando quiser</div>
            </div>
            <button
              onClick={() => scrollToForm()}
              className="mt-6 inline-flex items-center gap-2 font-black uppercase text-sm px-7 py-4 rounded-full transition hover:opacity-90"
              style={{ background: LIME, color: "#0A0E23" }}
            >
              Quero começar agora →
            </button>
          </div>
          <div className="order-1 lg:order-2 flex justify-center lg:justify-end">
            <img src={heroMockup} alt="Painel do Modo Criador no computador e no celular" className="w-full max-w-[460px] lg:max-w-none h-auto" />
          </div>
        </div>
      </section>

      {/* Dores */}
      <section style={{ background: BG_GREEN }} className="border-t border-white/10">
        <div className="px-5 sm:px-10 max-w-[820px] mx-auto py-14">
          <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-8">O Modo Criador é para...</h2>
          <ul className="space-y-4">
            {[
              "Você que gerencia vários clientes e cada um vive numa planilha ou pasta diferente",
              "Cliente que demora dias pra aprovar um post porque os arquivos se perdem no WhatsApp",
              "Sua equipe que não sabe quem é responsável por qual entrega e qual o prazo",
              "Você que quer mensurar a produtividade do time",
              "Você que já perdeu prazo porque ninguém viu que faltava aprovar algo",
              "Você que tem vergonha de mostrar sua \"organização interna\" pra um cliente novo",
            ].map((t) => (
              <li key={t} className="flex gap-3 text-white/75 text-base sm:text-lg">
                <span className="text-red-400 font-bold shrink-0">✗</span>{t}
              </li>
            ))}
          </ul>
          <p className="mt-8 font-bold" style={{ color: LIME }}>
            Se você marcou pelo menos um, o Modo Criador foi feito pra você.
          </p>
        </div>
      </section>

      {/* Simples assim */}
      <section style={{ background: BG_WHITE, color: "#0A0E23" }} className="border-t border-black/10">
        <div className="px-5 sm:px-10 max-w-[1000px] mx-auto py-14">
          <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-10 text-center">Simples assim</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { n: "01", i: "📅", t: "Monte o calendário", d: "Organize Posts e Reels de cada cliente num board visual, por mês." },
              { n: "02", i: "👥", t: "Atribua e acompanhe", d: "Sua equipe sabe exatamente quem faz o quê, qual o prazo e você pode fazer comentários." },
              { n: "03", i: "🔗", t: "Cliente aprova pelo link", d: "Manda um link público bonito, o cliente aprova ou comenta alterações, sem login." },
              { n: "04", i: "📁", t: "Arquivos no Drive", d: "Conecte sua própria conta do Google Drive e faça o Backup dos arquivos automaticamente." },
            ].map((s) => (
              <div key={s.n} className="bg-black/[0.04] rounded-xl p-5 border border-black/10">
                <div className="text-black/30 font-black text-sm mb-2">{s.n}</div>
                <div className="text-2xl mb-2">{s.i}</div>
                <div className="font-bold mb-1">{s.t}</div>
                <div className="text-[#0A0E23]/60 text-sm leading-relaxed">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section style={{ background: BG_GRAY }} className="border-t border-white/10">
        <div className="px-5 sm:px-10 max-w-[820px] mx-auto py-14">
          <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-8">Você vai ter...</h2>
          <ul className="space-y-4">
            {[
              "Calendário de conteúdo ilimitado, por cliente e por mês",
              "Link de aprovação pro cliente",
              "Equipe com papéis e responsáveis por tarefa",
              "Google Drive conectado, arquivos organizados automaticamente",
              "Relatórios de produtividade da equipe",
              "Suporte em português, feito pra agência brasileira",
            ].map((t) => (
              <li key={t} className="flex gap-3 text-white/85 text-base sm:text-lg">
                <span className="shrink-0" style={{ color: LIME }}>✅</span>{t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Planos */}
      <section style={{ background: BG_BLUE_2 }} className="border-t border-white/10">
        <div className="px-5 sm:px-10 max-w-[1100px] mx-auto py-14">
          <h2 className="font-black uppercase text-2xl sm:text-3xl mb-10 text-center">Escolha seu plano</h2>
          {plans.isLoading ? (
            <p className="text-center text-white/40">Carregando planos…</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {selectablePlans.map((p) => (
                <div key={p.id} className="bg-white/5 rounded-xl p-6 border border-white/10 flex flex-col">
                  <div className="font-black text-xl mb-1">{p.name}</div>
                  <div className="text-3xl font-black mb-1">
                    R$ {(p.priceCents! / 100).toFixed(2).replace(".", ",")}
                    <span className="text-sm font-normal text-white/50">/mês</span>
                  </div>
                  <div className="text-white/50 text-sm mb-6">
                    até {p.maxClients} clientes · até {p.maxCollaborators} colaboradores
                  </div>
                  <button
                    onClick={() => scrollToForm(p.id)}
                    className="mt-auto font-bold uppercase text-sm px-5 py-3 rounded-full transition"
                    style={
                      planId === p.id
                        ? { background: LIME, color: "#0A0E23" }
                        : { background: "rgba(255,255,255,0.08)", color: "#fff" }
                    }
                  >
                    {planId === p.id ? "Selecionado ✓" : "Escolher plano"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Formulário */}
      <section id="assinar-form" style={{ background: BG_GREEN }} className="border-t border-white/10">
        <div className="px-5 sm:px-10 max-w-[560px] mx-auto py-14">
        <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-2 text-center">Comece seu teste de 7 dias</h2>
        <p className="text-white/50 text-sm text-center mb-8">Sem compromisso. Cancele quando quiser antes da cobrança.</p>

        {invoiceUrl !== undefined ? (
          <div className="bg-white/5 rounded-xl p-6 border border-white/10 text-center">
            <div className="text-2xl mb-3">✅</div>
            <div className="font-bold text-lg mb-2">Cadastro criado!</div>
            {invoiceUrl ? (
              <>
                <p className="text-white/60 text-sm mb-4">
                  Abrimos numa nova aba o link seguro pra você cadastrar o cartão (sem cobrança agora — só depois dos 7 dias de teste).
                </p>
                <a href={invoiceUrl} target="_blank" rel="noreferrer" className="font-bold uppercase text-sm px-5 py-3 rounded-full inline-block" style={{ background: LIME, color: "#0A0E23" }}>
                  Abrir cadastro de pagamento
                </a>
              </>
            ) : (
              <p className="text-white/60 text-sm">Enviamos um e-mail de confirmação — clique no link pra ativar sua conta.</p>
            )}
            <p className="text-white/40 text-xs mt-6">
              Também mandamos um e-mail de confirmação — confirme antes de tentar entrar em <Link to="/auth" className="underline">/auth</Link>.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Nome da agência">
              <input required value={agencyName} onChange={(e) => setAgencyName(e.target.value)} className="lz-input" maxLength={80} />
            </Field>
            <Field label="Seu nome">
              <input required value={name} onChange={(e) => setName(e.target.value)} className="lz-input" maxLength={80} />
            </Field>
            <Field label="Seu e-mail">
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="lz-input" />
            </Field>
            <Field label="Crie uma senha">
              <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="lz-input" />
            </Field>
            <Field label="CNPJ ou CPF da agência">
              <input required value={taxId} onChange={(e) => setTaxId(e.target.value)} className="lz-input" placeholder="Somente números" maxLength={18} />
            </Field>
            {/* Honeypot — invisible to real users, bots tend to fill every field */}
            <input
              type="text" value={website} onChange={(e) => setWebsite(e.target.value)}
              autoComplete="off" tabIndex={-1} aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full font-black uppercase text-sm px-5 py-4 rounded-full transition disabled:opacity-50"
              style={{ background: LIME, color: "#0A0E23" }}
            >
              {loading ? "Criando conta…" : "Começar meu teste grátis →"}
            </button>
          </form>
        )}
        </div>
      </section>

      {/* Fundador */}
      <section style={{ background: BG_WHITE, color: "#0A0E23" }} className="border-t border-black/10 text-center">
        <div className="px-5 sm:px-10 max-w-[720px] mx-auto py-14">
        <div className="text-xs uppercase tracking-wide font-bold mb-3" style={{ color: LIME_ON_LIGHT }}>⚡ Somos a Luzeria Estúdio!</div>
        <p className="text-[#0A0E23]/70 text-sm leading-relaxed">
          Com mais de uma década em comunicação e criação de conteúdo, vivemos na pele a dor de gerenciar vários clientes ao mesmo tempo e foi aí que nasceu o Modo Criador: a ferramenta que a nossa própria agência usa todos os dias e agora queremos compartilhar também com a sua.
        </p>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ background: BG_GRAY }} className="border-t border-white/10">
        <div className="px-5 sm:px-10 max-w-[720px] mx-auto py-14">
        <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-8">Dúvidas frequentes</h2>
        <div className="space-y-3">
          {[
            ["Preciso saber mexer em tecnologia?", "Não. É muito intuitivo usar o Modo Criador. (Bem mais fácil que o ClickUp e Trello.)"],
            ["Estou vindo de outra plataforma, consigo migrar meus clientes?", "Sim, criamos um sistema que você consegue colocar toda a sua operação dentro do Modo Criador com rapidez."],
            ["Meu cliente precisa criar conta pra aprovar o conteúdo?", "Não. Ele recebe um link público, com a sua marca, e aprova direto, sem cadastro."],
            ["Funciona pra qualquer tipo de agência?", "Sim, foi feito pra qualquer agência ou social media que gerencia múltiplos clientes."],
            ["Posso trocar de plano depois?", "Sim, a qualquer momento nas configurações da sua conta."],
            ["O que acontece se eu não cancelar antes do teste acabar?", "A cobrança do plano escolhido começa automaticamente no cartão cadastrado, depois dos 7 dias."],
            ["Meus dados ficam seguros?", "Sim. Seus dados e os dos seus clientes ficam isolados dos de outras agências, com infraestrutura segura."],
          ].map(([q, a]) => (
            <details key={q} className="bg-white/5 rounded-lg p-4 border border-white/10">
              <summary className="cursor-pointer font-semibold text-sm">❓ {q}</summary>
              <p className="text-white/50 text-sm mt-3 leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
        </div>
      </section>

      <footer style={{ background: BG_BLUE }} className="px-5 sm:px-10 py-10 text-center text-white/30 text-xs">
        Modo <span className="font-criador-serif">Criador</span> — desenvolvido pela Luzeria Estúdio.
      </footer>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-white/50 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
