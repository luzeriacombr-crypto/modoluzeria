import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ImagePlus, Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { PasswordInput } from "@/components/luzeria/PasswordInput";
import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";
import { getHouseInvite, createHouseFromInvite } from "@/lib/luzeria/house.functions";

// Cadastro da House por convite. Só abre com um código válido (?c=...),
// gerado pela Luzeria em Configurações → Plataforma. Página simples de
// propósito — quem chega aqui já conversou com a gente, não precisa de venda.
export const Route = createFileRoute("/house/criar")({
  component: CreateHousePage,
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ c: typeof s.c === "string" ? s.c : "" }),
  head: () => ({
    meta: [
      { title: "Criar House — Modo Criador" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const inputCls = "w-full rounded-md px-3 py-2.5 text-sm text-white bg-white/[0.06] border border-white/10 outline-none focus:border-white/40 placeholder:text-white/30";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function CreateHousePage() {
  const { c: code } = Route.useSearch();
  const checkInvite = useServerFn(getHouseInvite);
  const create = useServerFn(createHouseFromInvite);
  const [invite, setInvite] = useState<{ state: "loading" | "valid" | "invalid"; planName?: string; freeMonths?: number; discountPct?: number }>({ state: "loading" });

  const [companyName, setCompanyName] = useState("");
  const [segment, setSegment] = useState("");
  const [instagram, setInstagram] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [logo, setLogo] = useState<{ dataUrl: string; name: string } | null>(null);
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!code) { setInvite({ state: "invalid" }); return; }
    checkInvite({ data: { code } })
      .then((r) => setInvite(r.valid ? { state: "valid", planName: r.planName, freeMonths: r.freeMonths, discountPct: r.discountPct } : { state: "invalid" }))
      .catch(() => setInvite({ state: "invalid" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function pickLogo(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast.error("Use uma imagem PNG, JPG ou WEBP."); return; }
    if (file.size > LOGO_MAX_BYTES) { toast.error("A logo precisa ter até 2 MB."); return; }
    setLogo({ dataUrl: await readAsDataUrl(file), name: file.name });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("A senha precisa ter pelo menos 8 caracteres."); return; }
    setSubmitting(true);
    try {
      await create({ data: {
        code, companyName: companyName.trim(), segment: segment.trim() || undefined, instagram: instagram.trim() || undefined,
        ownerName: ownerName.trim(), email: email.trim(), password, logoDataUrl: logo?.dataUrl ?? null, website,
      } });
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) {
        toast.success("House criada! Entre com seu e-mail e senha.");
        window.location.href = "/auth";
        return;
      }
      window.location.href = "/minhas-tarefas";
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível criar a House.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: "linear-gradient(to bottom left, #090E24, #111F5C)" }}>
      <Toaster theme="dark" position="bottom-right" />
      <div className="w-full max-w-md rounded-2xl p-7 md:p-8 shadow-2xl" style={{ background: "#16215C" }}>
        <div className="flex justify-center mb-5"><ModoCriadorLogo variant="brand" className="h-12 w-auto" /></div>

        {invite.state === "loading" && (
          <div className="flex justify-center py-10 text-white/60"><Loader2 className="animate-spin" size={22} /></div>
        )}

        {invite.state === "invalid" && (
          <div className="text-center py-4">
            <h1 className="text-white text-lg font-bold mb-2">Convite inválido</h1>
            <p className="text-white/60 text-sm">Esse link não é válido, já foi usado ou venceu. Peça um novo pra quem te enviou.</p>
          </div>
        )}

        {invite.state === "valid" && (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <h1 className="text-white text-xl font-bold">Criar sua House</h1>
              <p className="text-white/55 text-sm mt-1">
                Plano {invite.planName} · 7 dias de teste
                {invite.freeMonths ? ` + ${invite.freeMonths} ${invite.freeMonths === 1 ? "mês grátis" : "meses grátis"}` : ""}
                {invite.discountPct ? ` · ${invite.discountPct}% de desconto` : ""}.
              </p>
            </div>

            <fieldset className="space-y-2.5">
              <legend className="text-[10px] uppercase tracking-wider font-bold text-white/40 mb-1">Empresa</legend>
              <input required minLength={2} maxLength={80} value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Nome da empresa" className={inputCls} />
              <input maxLength={80} value={segment} onChange={(e) => setSegment(e.target.value)}
                placeholder="Segmento (ex: clínica odontológica)" className={inputCls} />
              <input maxLength={120} value={instagram} onChange={(e) => setInstagram(e.target.value)}
                placeholder="@ do Instagram" className={inputCls} autoCapitalize="none" autoCorrect="off" />
              <label className="flex items-center gap-3 rounded-md px-3 py-2.5 border border-dashed border-white/15 cursor-pointer hover:border-white/35 transition">
                {logo ? (
                  <img src={logo.dataUrl} alt="" className="h-9 w-9 rounded object-contain bg-white/10" />
                ) : (
                  <span className="h-9 w-9 rounded bg-white/10 flex items-center justify-center text-white/50"><ImagePlus size={16} /></span>
                )}
                <span className="text-sm text-white/70 truncate">{logo ? logo.name : "Logo (opcional)"}</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pickLogo(e.target.files?.[0])} />
              </label>
            </fieldset>

            <fieldset className="space-y-2.5">
              <legend className="text-[10px] uppercase tracking-wider font-bold text-white/40 mb-1">Responsável</legend>
              <input required minLength={2} maxLength={80} value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Seu nome" className={inputCls} autoComplete="name" />
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail" className={inputCls} autoComplete="email" />
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha (mínimo 8 caracteres)" autoComplete="new-password" required minLength={8} className={inputCls} />
            </fieldset>

            <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)}
              className="hidden" aria-hidden="true" />

            <button type="submit" disabled={submitting}
              className="w-full rounded-md py-3 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}>
              {submitting ? "Criando…" : "Criar House"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
