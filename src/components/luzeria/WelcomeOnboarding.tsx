import { useState } from "react";
import { toast } from "sonner";
import { Video, Check } from "lucide-react";
import { useApi } from "@/lib/luzeria/queries";
import type { Profile } from "@/lib/luzeria/types";
import { OPTIONAL_FEATURE_KEYS, OPTIONAL_FEATURE_LABEL, type OptionalFeatureKey } from "@/lib/luzeria/types";
import { AvatarEditor, ColorPicker, showAvatarError, uploadAvatar } from "./AvatarEditor";
import { SmartImportStep } from "./SmartImportStep";

// As 4 abas por-cliente (posts/reels/mais/feed) ficam de fora dessa lista —
// são um ajuste fino por cliente (Personalizar abas), não uma decisão do
// dia 1 sobre o app inteiro. O resto é o que de fato vale perguntar aqui:
// "isso combina com a sua agência?".
const ONBOARDING_FEATURE_KEYS = OPTIONAL_FEATURE_KEYS.filter(
  (k) => !["posts", "reels", "mais", "feed"].includes(k),
);

export function WelcomeOnboarding({ me }: { me: Profile }) {
  const { updateMyProfile, updateMyOrg } = useApi();
  const [step, setStep] = useState<"profile" | "features" | "import">("profile");
  // Tudo começa marcado (= ativado) — a pessoa só desmarca o que não usa.
  // Feedback real de usuário: "achei que tinha muita função, queria algo
  // mais clean" — em vez de esperar reclamação, pergunta já no início.
  const [enabledFeatures, setEnabledFeatures] = useState<Set<OptionalFeatureKey>>(
    () => new Set(ONBOARDING_FEATURE_KEYS),
  );
  const [color, setColor] = useState<string>(me.color);
  const [avatarPath, setAvatarPath] = useState<string | null>(me.avatarPath ?? null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(me.avatarUrl ?? null);
  const [uploading, setUploading] = useState(false);

  async function onPickFile(file: File) {
    setUploading(true);
    try {
      const path = await uploadAvatar(file, me.id);
      setAvatarPath(path);
      setAvatarPreview(URL.createObjectURL(file));
    } catch (e) { showAvatarError(e); }
    finally { setUploading(false); }
  }

  function onRemovePhoto() {
    setAvatarPath(null);
    setAvatarPreview(null);
  }

  // Importar clientes do ClickUp/Trello é uma ação de admin (o backend já
  // rejeita pra quem não é master/setor) — membro comum nem deveria ver a
  // tela, então pula direto pra finalizar o onboarding.
  const canImportClients = me.role === "master" || me.role === "setor";

  function goToImportStep(saveCustomization: boolean) {
    const next = canImportClients ? () => setStep("features") : completeOnboarding;
    if (!saveCustomization) { next(); return; }
    updateMyProfile.mutate({ data: { color, avatarPath } }, {
      onSuccess: () => { toast.success("Perfil personalizado."); next(); },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar perfil"),
    });
  }

  function toggleFeature(key: OptionalFeatureKey) {
    setEnabledFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function goToImportOrFinish(saveFeatures: boolean) {
    if (!saveFeatures) { setStep("import"); return; }
    const disabled = ONBOARDING_FEATURE_KEYS.filter((k) => !enabledFeatures.has(k));
    updateMyOrg.mutate({ data: { disabledFeatures: disabled } }, {
      onSuccess: () => setStep("import"),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar preferências"),
    });
  }

  function completeOnboarding() {
    updateMyProfile.mutate({ data: { onboarded: true } }, {
      onError: (e: any) => toast.error(e?.message ?? "Erro ao concluir"),
    });
  }

  const firstName = me.name.split(" ")[0] || me.name;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: "radial-gradient(circle at top, rgba(var(--lz-brand-light-rgb),0.07), transparent 60%), #0D0D0D" }}>
      <div className="w-full max-w-md bg-card rounded-2xl p-7 md:p-9"
        style={{ border: "1px solid rgba(var(--lz-brand-light-rgb),0.18)" }}>
        {step === "profile" ? (
          <>
            <div className="text-[10px] uppercase font-bold tracking-wider mb-2" style={{ color: "var(--lz-accent-ink)" }}>
              Bem-vinda(o)
            </div>
            <h1 className="text-foreground text-[24px] font-bold leading-tight">
              Olá, {firstName}!
            </h1>
            <p className="text-foreground/60 text-sm mt-1.5 mb-6">
              Personalize seu perfil antes de começar.
            </p>

            <AvatarEditor
              me={me}
              draftColor={color}
              draftAvatarUrl={avatarPreview}
              uploading={uploading}
              onPickFile={onPickFile}
              onRemovePhoto={onRemovePhoto}
            />

            <div className="mt-7">
              <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/50 mb-3 text-center">
                {avatarPreview ? "Cor de fallback (sem foto)" : "Escolha a cor do seu avatar"}
              </div>
              <ColorPicker value={color} onChange={setColor} />
            </div>

            <button
              onClick={() => goToImportStep(true)}
              disabled={updateMyProfile.isPending || uploading}
              className="mt-8 w-full rounded-md py-3 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
            >
              {updateMyProfile.isPending ? "Salvando…" : "Salvar e continuar"}
            </button>
            <button
              onClick={() => goToImportStep(false)}
              disabled={updateMyProfile.isPending}
              className="mt-3 w-full text-xs text-foreground/50 hover:text-foreground transition disabled:opacity-40"
            >
              Pular por agora
            </button>
          </>
        ) : step === "features" ? (
          <>
            <div className="text-[10px] uppercase font-bold tracking-wider mb-2" style={{ color: "var(--lz-accent-ink)" }}>
              Personalizar
            </div>
            <h1 className="text-foreground text-[24px] font-bold leading-tight">
              O que sua agência usa?
            </h1>
            <p className="text-foreground/60 text-sm mt-1.5 mb-5">
              Tudo começa ligado. Desmarque o que não faz sentido pra sua agência — dá pra
              mudar isso depois em Configurações.
            </p>

            <div className="max-h-[45vh] overflow-y-auto -mx-1 px-1 space-y-1.5">
              {ONBOARDING_FEATURE_KEYS.map((key) => {
                const meta = OPTIONAL_FEATURE_LABEL[key];
                const on = enabledFeatures.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleFeature(key)}
                    className="w-full flex items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-foreground/[0.04]"
                    style={{ border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)" }}
                  >
                    <span
                      className="mt-0.5 w-[18px] h-[18px] rounded shrink-0 flex items-center justify-center transition-colors"
                      style={on
                        ? { backgroundColor: "rgb(var(--lz-brand-rgb))" }
                        : { border: "1.5px solid color-mix(in srgb, var(--foreground) 25%, transparent)" }}
                    >
                      {on && <Check size={12} strokeWidth={3} color="#0D0D0D" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm text-foreground font-medium">{meta.label}</span>
                      <span className="block text-xs text-foreground/50 mt-0.5">{meta.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => goToImportOrFinish(true)}
              disabled={updateMyOrg.isPending}
              className="mt-6 w-full rounded-md py-3 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
            >
              {updateMyOrg.isPending ? "Salvando…" : "Salvar e continuar"}
            </button>
            <button
              onClick={() => goToImportOrFinish(false)}
              disabled={updateMyOrg.isPending}
              className="mt-3 w-full text-xs text-foreground/50 hover:text-foreground transition disabled:opacity-40"
            >
              Pular por agora
            </button>
          </>
        ) : (
          <>
            <div className="text-[10px] uppercase font-bold tracking-wider mb-2" style={{ color: "var(--lz-accent-ink)" }}>
              Importar clientes
            </div>
            <h1 className="text-foreground text-[24px] font-bold leading-tight mb-6">
              Traga seus clientes
            </h1>
            <SmartImportStep onDone={completeOnboarding} onSkip={completeOnboarding} />
          </>
        )}
      </div>
      {step === "profile" && (
        <a
          href="https://youtu.be/UhX1xvRlMSM?si=in2xsAV4x2xDNxOw"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full bg-foreground/[0.06] hover:bg-foreground/10 text-foreground/70 hover:text-foreground transition-colors"
        >
          <Video size={13} /> Precisa de ajuda? Assista o tutorial!
        </a>
      )}
    </div>
  );
}