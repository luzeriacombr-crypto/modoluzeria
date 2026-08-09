import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useLocation } from "@tanstack/react-router";
import { Check, ChevronDown, Lock } from "lucide-react";
import { getPublicPlans, publicSignup } from "@/lib/luzeria/signup.functions";
import { salesPageBlocksQO } from "@/lib/luzeria/queries";
import { supabase } from "@/integrations/supabase/client";
import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";
import { LIME, BG_BLUE, BG_BLUE_2, BG_WHITE, BG_GRAY, EASE, POP, LIFT, Reveal, SalesPageBody } from "./salesPageBlocks";

const PENDING_GOOGLE_SIGNUP_KEY = "modocriador:pending-google-signup";

function GoogleMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className="shrink-0">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.5 0-14 4.2-17.7 10.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5C29.5 34.9 26.9 36 24 36c-5.3 0-9.7-3.1-11.3-8l-6.5 5C9.9 39.7 16.4 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l6.5 5.5C39.9 37.4 44 31.5 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

export function SalesPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const promoCode = searchParams.get("promoCode") || undefined;
  const affiliateCode = searchParams.get("affiliateCode") || undefined;

  const plans = useQuery({ queryKey: ["public-plans"], queryFn: () => getPublicPlans() });
  const { data: blocks = [] } = useQuery(salesPageBlocksQO());
  const signup = useServerFn(publicSignup);

  const [planId, setPlanId] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [taxId, setTaxId] = useState("");
  const [billingType, setBillingType] = useState<"CREDIT_CARD" | "UNDEFINED">("CREDIT_CARD");
  const [website, setWebsite] = useState(""); // honeypot
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null | undefined>(undefined);

  const selectablePlans = (plans.data ?? []).filter((p) => p.priceCents != null);
  const hero = blocks.find((b) => b.type === "hero");
  const restBlocks = blocks.filter((b) => b.type !== "hero");

  function scrollToForm(id?: string) {
    if (id) setPlanId(id);
    document.getElementById("assinar-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!planId) { setError("Escolha um plano antes de continuar."); return; }
    if (!consent) { setError("Você precisa aceitar a Política de Privacidade para continuar."); return; }
    setLoading(true);
    setError(null);
    try {
      const r = await signup({
        data: {
          agencyName, name, email, password, planId, taxId: taxId.replace(/\D/g, ""), website,
          promoCode,
          affiliateCode,
          billingType,
        },
      });
      setInvoiceUrl(r.invoiceUrl);
      if (r.invoiceUrl) window.open(r.invoiceUrl, "_blank");
    } catch (err: any) {
      setError(err?.message ?? "Não foi possível concluir seu cadastro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function signUpWithGoogle() {
    if (!agencyName.trim() || !name.trim() || !taxId.trim()) {
      setError("Preenche o nome da agência, seu nome e o CNPJ/CPF antes de continuar com o Google.");
      return;
    }
    if (!planId) { setError("Escolha um plano antes de continuar."); return; }
    if (!consent) { setError("Você precisa aceitar a Política de Privacidade para continuar."); return; }
    setError(null);
    setGoogleLoading(true);
    try {
      sessionStorage.setItem(PENDING_GOOGLE_SIGNUP_KEY, JSON.stringify({
        agencyName, name, taxId: taxId.replace(/\D/g, ""), planId,
        promoCode,
        affiliateCode,
        billingType,
      }));
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/assinar/completar` },
      });
      if (oauthErr) throw oauthErr;
    } catch (err: any) {
      setError(err?.message ?? "Erro ao continuar com o Google");
      setGoogleLoading(false);
    }
  }

  const scrolled = useScrolled();

  return (
    <div className="min-h-screen text-white" style={{ background: "#0A0E23", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-5 sm:px-10 py-5"
        style={{
          transition: "background-color 300ms var(--ease-premium), backdrop-filter 300ms var(--ease-premium), border-color 300ms var(--ease-premium)",
          backgroundColor: scrolled ? "rgba(10,14,35,0.8)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
        }}
      >
        <div className="flex items-center justify-between max-w-[1100px] mx-auto w-full">
          <ModoCriadorLogo variant="brand" className="h-6 w-auto" />
          <Link to="/auth" className="text-sm text-white/70 hover:text-white transition">
            Já tem conta? Entrar →
          </Link>
        </div>
      </header>

      {/* Hero + blocos de conteúdo, editáveis em Configurações > Site */}
      <SalesPageBody hero={hero} blocks={restBlocks} onCtaClick={() => scrollToForm()} />

      {/* Planos */}
      <section style={{ background: BG_BLUE_2 }} className="border-t border-white/10">
        <Reveal className="px-5 sm:px-10 max-w-[1100px] mx-auto py-14">
          <div className="flex justify-center mb-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide px-3 py-1.5 rounded-full"
              style={{ background: "rgba(215,255,63,0.12)", color: LIME }}>
              🚀 Oferta de lançamento
            </span>
          </div>
          <h2 className="font-black uppercase text-2xl sm:text-3xl mb-2 text-center">Escolha seu plano</h2>
          <p className="text-white/50 text-sm text-center mb-10">
            Preço de estreia — o valor sobe assim que a oferta de lançamento acabar.
          </p>
          {plans.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl p-6 border border-white/10 bg-white/5 animate-pulse h-[180px]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {selectablePlans.map((p) => {
                const recommended = p.name.trim().toLowerCase() === "pro";
                return (
                  <div key={p.id} className={`relative rounded-xl p-6 flex flex-col ${LIFT}`}
                    style={{
                      background: recommended ? "rgba(215,255,63,0.06)" : "rgba(255,255,255,0.05)",
                      border: recommended ? `2px solid ${LIME}` : "1px solid rgba(255,255,255,0.1)",
                      ...EASE,
                    }}>
                    {recommended && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase tracking-wide px-3 py-1 rounded-full"
                        style={{ background: LIME, color: "#0A0E23" }}>
                        Mais popular
                      </span>
                    )}
                    <div className="font-black text-xl mb-1">{p.name}</div>
                    <div className="text-white/40 text-xs mb-0.5">
                      De: <span className="line-through">R$ {(Math.round(p.priceCents! * 1.3) / 100).toFixed(2).replace(".", ",")}</span>
                    </div>
                    <div className="text-3xl font-black mb-1">
                      R$ {(p.priceCents! / 100).toFixed(2).replace(".", ",")}
                      <span className="text-sm font-normal text-white/50">/mês</span>
                    </div>
                    <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-full mb-4"
                      style={{ background: "rgba(215,255,63,0.15)", color: LIME }}>
                      🎟️ Cupom de estreia aplicado · -30%
                    </div>
                    <div className="text-white/50 text-sm mb-6">
                      até {p.maxClients} clientes · até {p.maxCollaborators} colaboradores
                    </div>
                    <button
                      onClick={() => scrollToForm(p.id)}
                      className={`mt-auto font-bold uppercase text-sm px-5 py-3 rounded-full ${POP}`}
                      style={{
                        ...(planId === p.id || recommended
                          ? { background: LIME, color: "#0A0E23" }
                          : { background: "rgba(255,255,255,0.08)", color: "#fff" }),
                        ...EASE,
                      }}
                    >
                      {planId === p.id ? "Selecionado ✓" : "Escolher plano"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Reveal>
      </section>

      {/* Formulário */}
      <section id="assinar-form" style={{ background: BG_WHITE, color: "#0A0E23" }} className="border-t border-black/10">
        <div className="px-5 sm:px-10 max-w-[560px] mx-auto py-14">
        <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-2 text-center">Comece seu teste de 7 dias</h2>
        <p className="text-[#0A0E23]/60 text-sm text-center mb-8">Sem compromisso. Cancele quando quiser antes da cobrança.</p>

        {invoiceUrl !== undefined ? (
          <div className="bg-black/[0.03] rounded-xl p-6 border border-black/10 text-center">
            <div className="mb-3 flex justify-center">
              <span className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: LIME }}>
                <Check size={20} color="#0A0E23" strokeWidth={3} />
              </span>
            </div>
            <div className="font-bold text-lg mb-2">Cadastro criado!</div>
            {invoiceUrl ? (
              <>
                <p className="text-[#0A0E23]/70 text-sm mb-4">
                  {billingType === "UNDEFINED"
                    ? "Abrimos numa nova aba o link seguro com sua primeira fatura, onde dá pra escolher PIX, boleto ou cartão (sem cobrança agora — só depois dos 7 dias de teste)."
                    : "Abrimos numa nova aba o link seguro pra você cadastrar o cartão (sem cobrança agora — só depois dos 7 dias de teste)."}
                </p>
                <a href={invoiceUrl} target="_blank" rel="noreferrer" className="font-bold uppercase text-sm px-5 py-3 rounded-full inline-block" style={{ background: LIME, color: "#0A0E23" }}>
                  Abrir cadastro de pagamento
                </a>
              </>
            ) : (
              <p className="text-[#0A0E23]/70 text-sm">Enviamos um e-mail de confirmação — clique no link pra ativar sua conta.</p>
            )}
            <p className="text-[#0A0E23]/50 text-xs mt-6">
              Também mandamos um e-mail de confirmação — confirme antes de tentar entrar em <Link to="/auth" className="underline">/auth</Link>.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Nome da agência">
              <input required value={agencyName} onChange={(e) => setAgencyName(e.target.value)} className="lz-input-onlight" maxLength={80} />
            </Field>
            <Field label="Seu nome">
              <input required value={name} onChange={(e) => setName(e.target.value)} className="lz-input-onlight" maxLength={80} />
            </Field>
            <Field label="Seu e-mail">
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="lz-input-onlight" />
            </Field>
            <Field label="Crie uma senha">
              <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="lz-input-onlight" />
            </Field>
            <Field label="CNPJ ou CPF da agência">
              <input required value={taxId} onChange={(e) => setTaxId(e.target.value)} className="lz-input-onlight" placeholder="Somente números" maxLength={18} />
            </Field>
            <Field label="Forma de pagamento">
              <div className="flex gap-2">
                {([
                  { id: "CREDIT_CARD" as const, label: "Cartão de crédito" },
                  { id: "UNDEFINED" as const, label: "PIX ou Boleto" },
                ]).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setBillingType(opt.id)}
                    className="flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold border transition"
                    style={{
                      borderColor: billingType === opt.id ? "#0A0E23" : "rgba(10,14,35,0.15)",
                      background: billingType === opt.id ? "#0A0E23" : "transparent",
                      color: billingType === opt.id ? "#fff" : "#0A0E23",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>
            {/* Honeypot — invisible to real users, bots tend to fill every field */}
            <input
              type="text" value={website} onChange={(e) => setWebsite(e.target.value)}
              autoComplete="off" tabIndex={-1} aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
            />
            <label className="flex items-start gap-2 text-xs text-[#0A0E23]/70 cursor-pointer">
              <input
                type="checkbox" required checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Li e aceito a{" "}
                <Link to="/privacidade" target="_blank" className="underline font-semibold">
                  Política de Privacidade
                </Link>, e autorizo o uso dos meus dados conforme descrito nela.
              </span>
            </label>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit" disabled={loading || !consent}
              className="w-full font-black uppercase text-sm px-5 py-4 rounded-full transition disabled:opacity-50"
              style={{ background: LIME, color: "#0A0E23" }}
            >
              {loading ? "Criando conta…" : "Começar meu teste grátis →"}
            </button>

            <div className="flex items-center gap-3 pt-1">
              <div className="h-px flex-1 bg-black/10" />
              <span className="text-[#0A0E23]/30 text-[10px] uppercase tracking-wider">ou</span>
              <div className="h-px flex-1 bg-black/10" />
            </div>

            <button
              type="button" onClick={signUpWithGoogle} disabled={googleLoading}
              className="w-full flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold border border-black/15 bg-white transition disabled:opacity-50 hover:bg-black/[0.03]"
            >
              <GoogleMark size={16} />
              {googleLoading ? "..." : "Continuar com Google"}
            </button>

            <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#0A0E23]/45 pt-1">
              <Lock size={11} /> Ambiente seguro · Seus dados ficam protegidos
            </p>
          </form>
        )}
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
            <FaqItem key={q} question={q} answer={a} />
          ))}
        </div>
        </div>
      </section>

      <footer style={{ background: BG_BLUE }} className="px-5 sm:px-10 py-10 text-center text-white/30 text-xs">
        Modo <span className="font-criador-serif">Criador</span> — desenvolvido pela Luzeria Estúdio.
        {" · "}
        <Link to="/privacidade" className="underline hover:text-white/50 transition">Política de Privacidade</Link>
      </footer>

      <a
        href="https://wa.me/5599991135486?text=Oi!%20Fiquei%20com%20uma%20d%C3%BAvida%20sobre%20o%20Modo%20Criador."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 pl-3 pr-4 py-3 rounded-full shadow-2xl transition hover:opacity-90"
        style={{ background: "#25D366", color: "#0A0E23" }}
      >
        <svg viewBox="0 0 32 32" width="22" height="22" fill="currentColor" aria-hidden="true">
          <path d="M16.004 2.667C8.64 2.667 2.667 8.64 2.667 16.004c0 2.45.66 4.847 1.914 6.947L2.667 29.333l6.55-1.883a13.29 13.29 0 0 0 6.787 1.85h.006c7.363 0 13.336-5.973 13.336-13.337 0-3.563-1.388-6.913-3.907-9.43a13.253 13.253 0 0 0-9.435-3.866Zm0 24.4h-.005a11.06 11.06 0 0 1-5.638-1.543l-.404-.24-4.19 1.204 1.12-4.087-.264-.42a11.05 11.05 0 0 1-1.696-5.977c0-6.116 4.978-11.093 11.096-11.093a11.04 11.04 0 0 1 7.851 3.25 11.03 11.03 0 0 1 3.245 7.85c0 6.117-4.978 11.056-11.115 11.056Zm6.086-8.284c-.334-.167-1.97-.972-2.275-1.083-.305-.111-.527-.167-.75.167-.222.334-.86 1.083-1.054 1.306-.194.223-.389.25-.723.083-.334-.167-1.409-.52-2.684-1.657-.992-.885-1.663-1.978-1.858-2.312-.194-.334-.02-.514.147-.68.15-.15.334-.39.5-.585.167-.195.223-.334.334-.556.111-.223.056-.417-.028-.584-.083-.167-.75-1.806-1.027-2.474-.27-.65-.545-.562-.75-.573l-.638-.012c-.222 0-.583.083-.888.417-.305.334-1.166 1.14-1.166 2.778 0 1.639 1.194 3.222 1.361 3.444.167.223 2.352 3.59 5.696 5.035.796.344 1.417.55 1.901.703.799.254 1.526.218 2.101.132.641-.096 1.97-.805 2.248-1.583.278-.778.278-1.445.194-1.584-.083-.139-.305-.222-.639-.389Z"/>
        </svg>
        <span className="text-sm font-bold">Falar no WhatsApp</span>
      </a>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left px-4 py-4"
      >
        <span className="font-semibold text-sm">{question}</span>
        <ChevronDown size={16} className="shrink-0 text-white/50 transition-transform" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>
      {open && (
        <p className="text-white/50 text-sm leading-relaxed px-4 pb-4">{answer}</p>
      )}
    </div>
  );
}

function useScrolled(threshold = 30) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-[#0A0E23]/60 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
