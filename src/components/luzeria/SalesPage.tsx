import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useLocation } from "@tanstack/react-router";
import { Check, ChevronDown, Lock } from "lucide-react";
import { getPublicPlans, publicSignup } from "@/lib/luzeria/signup.functions";
import { SALES_FAQ } from "@/lib/luzeria/sales-knowledge";
import { SalesChatWidget } from "./SalesChatWidget";
import { supabase } from "@/integrations/supabase/client";
import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";
import { DemoRequestModal } from "./DemoRequestModal";
import { LIME, BG_BLUE, BG_BLUE_2, BG_WHITE, BG_GRAY, EASE, POP, Reveal, useReveal, staggerStyle } from "./salesPageBlocks";
import { salesLandingQO } from "@/lib/luzeria/queries";
import { DEFAULT_LANDING, type LandingContent } from "@/lib/luzeria/sales-landing-content";
import { SalesHero, SalesNumbers, SalesBeforeAfter, SalesFeatures, SalesAiSpotlight, SalesAiConnectorSpotlight, SalesStickyCta } from "./SalesLanding";
import { InteractiveDashboardDemo } from "./SalesInteractiveDashboard";
import { PasswordInput } from "./PasswordInput";

const PENDING_GOOGLE_SIGNUP_KEY = "modocriador:pending-google-signup";
const DEMO_POPUP_SHOWN_KEY = "modocriador:demo-popup-shown";

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
  const refCode = searchParams.get("refCode") || undefined;

  const plans = useQuery({ queryKey: ["public-plans"], queryFn: () => getPublicPlans() });
  const landing = (useQuery(salesLandingQO()).data ?? DEFAULT_LANDING) as LandingContent;
  const signup = useServerFn(publicSignup);

  const [planId, setPlanId] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [taxId, setTaxId] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null | undefined>(undefined);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [planError, setPlanError] = useState(false);
  // Rolagens feitas pela própria página (ex.: subir até o plano) não contam como "saindo do formulário".
  const suppressDemoUntilRef = useRef(0);

  const plansReveal = useReveal<HTMLDivElement>();
  const selectablePlans = (plans.data ?? []).filter((p) => p.priceCents != null);

  function scrollToForm(id?: string) {
    if (id) { setPlanId(id); setPlanError(false); }
    suppressDemoUntilRef.current = Date.now() + 3000;
    document.getElementById("assinar-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function askForPlan() {
    setPlanError(true);
    setError(null);
    suppressDemoUntilRef.current = Date.now() + 3000;
    document.getElementById("form-plans")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!planId) { askForPlan(); return; }
    if (!consent) { setError("Você precisa aceitar a Política de Privacidade para continuar."); return; }
    setLoading(true);
    setError(null);
    try {
      const r = await signup({
        data: {
          agencyName, name, email, password, planId, taxId: taxId.replace(/\D/g, ""), whatsapp, website,
          promoCode,
          affiliateCode,
          refCode,
        },
      });
      setInvoiceUrl(r.invoiceUrl);
      (window as any).fbq?.("track", "StartTrial", { value: 0.00, currency: "BRL" });
    } catch (err: any) {
      setError(err?.message ?? "Não foi possível concluir seu cadastro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function signUpWithGoogle() {
    if (!agencyName.trim() || !name.trim() || !taxId.trim() || !whatsapp.trim()) {
      setError("Preenche o nome da agência, seu nome, o CNPJ/CPF e o WhatsApp antes de continuar com o Google.");
      return;
    }
    if (!planId) { askForPlan(); return; }
    if (!consent) { setError("Você precisa aceitar a Política de Privacidade para continuar."); return; }
    setError(null);
    setGoogleLoading(true);
    try {
      sessionStorage.setItem(PENDING_GOOGLE_SIGNUP_KEY, JSON.stringify({
        agencyName, name, taxId: taxId.replace(/\D/g, ""), whatsapp, planId,
        promoCode,
        affiliateCode,
        refCode,
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

  // Popup de demo — só interrompe quem já demonstrou interesse (chegou a
  // ver o formulário) e está claramente saindo dele, não quem só entrou na
  // página. Desktop detecta pelo mouse saindo pelo topo (exit-intent
  // clássico); mobile não tem esse evento, então usa "rolou de volta pra
  // cima um bom trecho depois de ter visto o formulário" como proxy.
  const formEngagedRef = useRef(false);
  const maxScrollYRef = useRef(0);
  useEffect(() => {
    const formEl = document.getElementById("assinar-form");
    if (!formEl) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) formEngagedRef.current = true;
    }, { threshold: 0.3 });
    io.observe(formEl);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(DEMO_POPUP_SHOWN_KEY)) return;

    function trigger() {
      if (sessionStorage.getItem(DEMO_POPUP_SHOWN_KEY)) return;
      if (!formEngagedRef.current) return;
      if (Date.now() < suppressDemoUntilRef.current) return;
      if (invoiceUrl !== undefined) return; // já cadastrou — não interrompe
      sessionStorage.setItem(DEMO_POPUP_SHOWN_KEY, "1");
      setShowDemoModal(true);
    }

    function onMouseLeave(e: MouseEvent) {
      if (e.clientY <= 0) trigger();
    }

    function onScroll() {
      const y = window.scrollY;
      if (y > maxScrollYRef.current) maxScrollYRef.current = y;
      else if (formEngagedRef.current && maxScrollYRef.current - y > 150) trigger();
    }

    document.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, [invoiceUrl]);

  const scrolled = useScrolled();
  const scrollProgress = useScrollProgress();

  return (
    <div className="min-h-screen text-foreground" style={{ background: "#0A0E23", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      {/* Barra de progresso de leitura */}
      <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-transparent">
        <div
          className="h-full"
          style={{
            width: `${scrollProgress * 100}%`,
            background: LIME,
            transition: "width 100ms linear",
          }}
        />
      </div>

      {/* Header */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-5 sm:px-10 py-5"
        style={{
          transition: "background-color 300ms var(--ease-premium), backdrop-filter 300ms var(--ease-premium), border-color 300ms var(--ease-premium)",
          backgroundColor: scrolled ? "rgba(10,14,35,0.8)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)" : "1px solid transparent",
        }}
      >
        <div className="flex items-center justify-between max-w-[1100px] mx-auto w-full">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-2.5">
              <img src="/favicon.svg" alt="" aria-hidden="true" className="h-7 w-7 rounded-[9px]" />
              <ModoCriadorLogo variant="brand" className="h-6 w-auto" />
            </span>
            <Link
              to="/blog"
              className="text-[11px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full transition hover:brightness-110"
              style={{ background: "rgba(215,255,63,0.12)", color: LIME }}
            >
              Blog
            </Link>
          </div>
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-foreground/70">
            <a href="#funcoes" className="hover:text-foreground transition">Funções</a>
            <a href="#ia" className="hover:text-foreground transition">IA</a>
            <a href="#planos" className="hover:text-foreground transition">Planos</a>
            <a href="#duvidas" className="hover:text-foreground transition">Dúvidas</a>
          </nav>
          <Link to="/auth" className="text-sm text-foreground/70 hover:text-foreground transition">
            Já tem conta? Entrar →
          </Link>
        </div>
      </header>

      <SalesHero onCta={() => scrollToForm()} content={landing} />
      {landing.sections.order.filter((id) => !landing.sections.hidden.includes(id)).map((id) => {
        switch (id) {
          case "numbers": return <SalesNumbers key={id} content={landing} />;
          case "beforeAfter": return <SalesBeforeAfter key={id} content={landing} />;
          case "features": return <SalesFeatures key={id} content={landing} />;
          case "ai": return <SalesAiSpotlight key={id} onCta={() => scrollToForm()} content={landing} />;
          case "aiConnector": return <SalesAiConnectorSpotlight key={id} onCta={() => scrollToForm()} content={landing} />;
          case "demo": return <InteractiveDashboardDemo key={id} />;
          default: return null;
        }
      })}

      {/* Planos */}
      <section id="planos" style={{ background: BG_BLUE_2 }} className="border-t border-foreground/10">
        <Reveal className="px-5 sm:px-10 max-w-[1100px] mx-auto py-14">
          <div className="flex justify-center mb-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide px-3 py-1.5 rounded-full"
              style={{ background: "rgba(215,255,63,0.12)", color: LIME }}>
              🚀 Oferta de lançamento
            </span>
          </div>
          <h2 className="font-black uppercase text-2xl sm:text-3xl mb-2 text-center">Escolha seu plano</h2>
          <p className="text-foreground/50 text-sm text-center mb-10">
            Preço de estreia — o valor sobe assim que a oferta de lançamento acabar.
          </p>
          {plans.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl p-6 border border-foreground/10 bg-foreground/5 animate-pulse h-[180px]" />
              ))}
            </div>
          ) : (
            <div ref={plansReveal.ref} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {selectablePlans.map((p, i) => {
                const recommended = p.name.trim().toLowerCase() === "pro";
                return (
                  <div key={p.id} className="relative rounded-xl p-6 flex flex-col transition-[transform,box-shadow] duration-300 hover:-translate-y-1.5 hover:shadow-[0_25px_70px_-20px_rgba(215,255,63,0.4)]"
                    style={{
                      background: recommended ? "rgba(215,255,63,0.06)" : "color-mix(in srgb, var(--foreground) 5%, transparent)",
                      border: recommended ? `2px solid ${LIME}` : "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)",
                      ...EASE,
                      ...staggerStyle(plansReveal.visible, i),
                    }}>
                    {recommended && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase tracking-wide px-3 py-1 rounded-full"
                        style={{ background: LIME, color: "#0A0E23" }}>
                        Mais popular
                      </span>
                    )}
                    <div className="font-black text-xl mb-1">{p.name}</div>
                    <div className="text-foreground/40 text-xs mb-0.5">
                      De: <span className="line-through">R$ {(Math.round(p.priceCents! * 1.3) / 100).toFixed(2).replace(".", ",")}</span>
                    </div>
                    <div className="text-3xl font-black mb-1">
                      R$ {(p.priceCents! / 100).toFixed(2).replace(".", ",")}
                      <span className="text-sm font-normal text-foreground/50">/mês</span>
                    </div>
                    <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-full mb-4"
                      style={{ background: "rgba(215,255,63,0.15)", color: LIME }}>
                      🎟️ Preço de estreia · -{Math.round((1 - 1 / 1.3) * 100)}%
                    </div>
                    <div className="text-foreground/50 text-sm mb-6">
                      até {p.maxClients} clientes · até {p.maxCollaborators} colaboradores
                    </div>
                    <button
                      onClick={() => scrollToForm(p.id)}
                      className={`mt-auto font-bold uppercase text-sm px-5 py-3 rounded-full ${POP}`}
                      style={{
                        ...(planId === p.id || recommended
                          ? { background: LIME, color: "#0A0E23" }
                          : { background: "color-mix(in srgb, var(--foreground) 8%, transparent)", color: "#fff" }),
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
        <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-2 text-center">Comece seu teste de 30 dias</h2>
        <p className="text-[#0A0E23]/60 text-sm text-center mb-8">Sem compromisso. Cancele quando quiser antes da cobrança.</p>

        {invoiceUrl !== undefined ? (
          <div className="bg-black/[0.03] rounded-xl p-6 border border-black/10 text-center">
            <div className="mb-3 flex justify-center">
              <span className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: LIME }}>
                <Check size={20} color="#0A0E23" strokeWidth={3} />
              </span>
            </div>
            <div className="font-bold text-lg mb-2">Cadastro criado!</div>
            <p className="text-[#0A0E23]/70 text-sm">Enviamos um e-mail de confirmação — clique no link pra ativar sua conta.</p>
            <p className="text-[#0A0E23]/50 text-xs mt-2">
              Você já pode usar o Modo Criador por 30 dias sem cadastrar pagamento. Quando quiser, é só adicionar a forma de pagamento em Configurações.
            </p>
            <p className="text-[#0A0E23]/50 text-xs mt-6">
              Também mandamos um e-mail de confirmação — confirme antes de tentar entrar em <Link to="/auth" className="underline">/auth</Link>.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div id="form-plans" className="scroll-mt-24">
              <span className="block text-xs uppercase tracking-wide text-[#0A0E23]/60 mb-1.5">Escolha seu plano</span>
              <div role="radiogroup" aria-label="Plano" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, selectablePlans.length)}, minmax(0, 1fr))` }}>
                {plans.isLoading && [0, 1, 2].map((i) => <div key={i} className="h-[76px] rounded-xl bg-black/[0.05] animate-pulse" />)}
                {selectablePlans.map((p) => {
                  const on = planId === p.id;
                  const recommended = p.name.trim().toLowerCase() === "pro";
                  return (
                    <button key={p.id} type="button" role="radio" aria-checked={on}
                      onClick={() => { setPlanId(p.id); setPlanError(false); }}
                      className="relative rounded-xl px-2 py-3 text-center transition"
                      style={{
                        background: on ? LIME : "#fff",
                        color: "#0A0E23",
                        border: on ? "2px solid #0A0E23" : planError ? "2px solid #E5484D" : "2px solid rgba(10,14,35,0.14)",
                      }}>
                      {recommended && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ background: "#0A0E23", color: LIME }}>Mais popular</span>
                      )}
                      <div className="font-black text-[13px] leading-tight">{p.name}</div>
                      <div className="font-black text-[15px] leading-tight mt-1 tabular-nums">R$ {(p.priceCents! / 100).toFixed(2).replace(".", ",")}</div>
                      <div className="text-[10.5px] opacity-60 leading-tight mt-0.5">por mês · {p.maxClients} clientes</div>
                    </button>
                  );
                })}
              </div>
              {planError && <p role="alert" className="text-[13px] font-semibold mt-2" style={{ color: "#C0272D" }}>Escolha um dos planos acima para continuar.</p>}
            </div>
            <Field label="Nome da agência">
              <input required value={agencyName} onChange={(e) => setAgencyName(e.target.value)} className="lz-input-onlight" maxLength={80} />
            </Field>
            <Field label="Seu nome">
              <input required value={name} onChange={(e) => setName(e.target.value)} className="lz-input-onlight" maxLength={80} />
            </Field>
            <Field label="Seu e-mail">
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="lz-input-onlight" />
            </Field>
            <Field label="Seu WhatsApp">
              <input required type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="lz-input-onlight" placeholder="(99) 99999-9999" maxLength={30} />
            </Field>
            <Field label="Crie uma senha">
              <PasswordInput required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                toggleClassName="text-[#0A0E23]/40 hover:text-[#0A0E23]/70" className="lz-input-onlight" />
            </Field>
            <Field label="CNPJ ou CPF da agência">
              <input required value={taxId} onChange={(e) => setTaxId(e.target.value)} className="lz-input-onlight" placeholder="Somente números" maxLength={18} />
            </Field>
            <p className="text-[#0A0E23]/50 text-xs -mt-1">
              Sem cartão, sem PIX, sem nada agora. No último dia do teste avisamos você pra decidir se quer continuar.
            </p>
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
              className="w-full flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold border border-black/15 bg-foreground transition disabled:opacity-50 hover:bg-black/[0.03]"
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
      <section id="duvidas" style={{ background: BG_GRAY }} className="border-t border-foreground/10">
        <div className="px-5 sm:px-10 max-w-[720px] mx-auto py-14">
        <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-8">Dúvidas frequentes</h2>
        <div className="space-y-3">
          {SALES_FAQ.map(([q, a]) => (
            <FaqItem key={q} question={q} answer={a} />
          ))}
        </div>
        </div>
      </section>

      <footer style={{ background: BG_BLUE }} className="px-5 sm:px-10 py-10 pb-24 sm:pb-10 text-center text-foreground/30 text-xs">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mb-4 max-w-2xl mx-auto">
          <Link to="/blog" className="underline hover:text-foreground/50 transition">Blog</Link>
          <Link to="/selecao-de-fotos-para-fotografos" className="underline hover:text-foreground/50 transition">Seleção de Fotos</Link>
          <Link to="/aprovacao-de-conteudo-por-link" className="underline hover:text-foreground/50 transition">Aprovação por Link</Link>
          <Link to="/backup-automatico-drive" className="underline hover:text-foreground/50 transition">Backup no Drive</Link>
          <Link to="/publicacao-automatica-instagram" className="underline hover:text-foreground/50 transition">Publicação no Instagram</Link>
          <Link to="/publicacao-automatica-tiktok" className="underline hover:text-foreground/50 transition">Publicação no TikTok</Link>
          <Link to="/biblioteca-de-referencias" className="underline hover:text-foreground/50 transition">Biblioteca de Referências</Link>
          <Link to="/assinatura-eletronica-de-contratos" className="underline hover:text-foreground/50 transition">Contrato com Assinatura Eletrônica</Link>
        </div>
        Modo <span className="font-criador-serif">Criador</span> — desenvolvido pela Luzeria Estúdio.
        {" · "}
        <Link to="/privacidade" className="underline hover:text-foreground/50 transition">Política de Privacidade</Link>
        {" · "}
        <Link to="/termos" className="underline hover:text-foreground/50 transition">Termos de Uso</Link>
      </footer>

      <SalesStickyCta onCta={() => scrollToForm()} />
      <SalesChatWidget />

      {showDemoModal && <DemoRequestModal onClose={() => setShowDemoModal(false)} />}
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-foreground/5 rounded-lg border border-foreground/10 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left px-4 py-4"
      >
        <span className="font-semibold text-sm">{question}</span>
        <ChevronDown size={16} className="shrink-0 text-foreground/50 transition-transform" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>
      {open && (
        <p className="text-foreground/50 text-sm leading-relaxed px-4 pb-4">{answer}</p>
      )}
    </div>
  );
}

/** Fração (0-1) de quanto já foi rolado da página — vira uma barrinha fina
 * no topo. Detalhe pequeno, mas junto com o resto passa "produto cuidado". */
function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let raf = 0;
    function measure() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    }
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    }
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return progress;
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
