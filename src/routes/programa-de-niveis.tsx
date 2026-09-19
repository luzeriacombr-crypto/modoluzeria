import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";
import { LIME, BG_BLUE, BG_GRAY, Reveal } from "@/components/luzeria/salesPageBlocks";
import { AGENCY_TIER_NAMES, computeAgencyPoints, getAgencyLevel, type AgencyLevelInput } from "@/lib/luzeria/agency-level";
import { TIER_COLOR, TIER_ICON, type AgencyTierName } from "@/components/luzeria/AgencyLevelIcons";

export const Route = createFileRoute("/programa-de-niveis")({
  component: AgencyLevelsPage,
  head: () => ({
    meta: [
      { title: "Programa de Níveis — Modo Criador" },
      { name: "description", content: "Bronze até Lendária: como o Programa de Níveis do Modo Criador pontua sua agência." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const SUB = ["I", "II", "III"] as const;
const TIER_DESC: Record<AgencyTierName, string> = {
  "Bronze": "Toda agência começa aqui — a primeira fagulha.",
  "Prata": "Já rodou o suficiente pra sentir o ritmo.",
  "Ouro": "Operação consistente, entregando de verdade.",
  "Platina": "Equipe grande, carteira cheia, engrenagem rodando.",
  "Diamante": "Referência — poucas agências chegam aqui.",
  "Lendária": "O topo. Sua agência é uma potência.",
};

function TierLadder() {
  const [openTier, setOpenTier] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2.5">
      {AGENCY_TIER_NAMES.map((tier, ti) => {
        const color = TIER_COLOR[tier];
        const Icon = TIER_ICON[tier];
        const isOpen = openTier === tier;
        // Reconstruct this tier's 3 thresholds by probing getAgencyLevel at the exact point values.
        const subPoints = SUB.map((_, si) => {
          // Binary search-free: thresholds are baked into getAgencyLevel via a fixed table,
          // so we scan a coarse range to find where label flips to this tier/sub.
          let found = 0;
          for (let p = 0; p <= 6000; p += 5) {
            const lvl = getAgencyLevel(p);
            if (lvl.tier === tier && lvl.subLevel === SUB[si]) { found = p; break; }
          }
          return found;
        });
        return (
          <div
            key={tier}
            className="rounded-2xl border transition cursor-pointer"
            style={{ background: BG_GRAY, borderColor: isOpen ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)" }}
            onClick={() => setOpenTier(isOpen ? null : tier)}
          >
            <div className="grid items-center gap-4 px-5 py-4" style={{ gridTemplateColumns: "48px 1fr auto" }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`, color }}>
                <Icon size={24} />
              </div>
              <div>
                <div className="font-bold text-[16px]" style={{ letterSpacing: "-0.01em" }}>{tier}</div>
                <div className="text-white/40 text-[12px] mt-0.5">{TIER_DESC[tier]}</div>
              </div>
              <div className="text-white/55 text-[12px] font-bold text-right whitespace-nowrap tabular-nums">
                {subPoints[0]}+ pts
              </div>
            </div>
            {isOpen && (
              <div className="px-5 pb-4">
                {SUB.map((s, si) => (
                  <div key={s} className="flex items-center justify-between text-[12.5px] py-2 border-t border-white/[0.06]">
                    <span className="text-white/60 font-semibold">{tier} {s}</span>
                    <span className="text-white/35 tabular-nums">{subPoints[si]} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const CRITERIA: { icon: string; title: string; pts: string; desc: string }[] = [
  { icon: "clients", title: "Clientes ativos", pts: "15 pts cada (até 20)", desc: "Cada cliente de verdade que você gerencia dentro do Modo Criador." },
  { icon: "delivery", title: "Conteúdo entregue", pts: "1 pt cada (até 2.500)", desc: "Todo post, reel ou story já finalizado — sozinho não chega em Lendária, precisa vir junto com o resto." },
  { icon: "paying", title: "Cliente pagante", pts: "150 pts", desc: "Sua assinatura confirmada — o teste não pontua aqui." },
  { icon: "drive", title: "Google Drive conectado", pts: "25 pts", desc: "Backup automático funcionando pra sua agência." },
  { icon: "instagram", title: "Instagram conectado", pts: "15 pts por cliente", desc: "Cada cliente com publicação automática ativa." },
  { icon: "team", title: "Equipe ativa", pts: "20 pts por pessoa (até 15)", desc: "Cada colaborador além de você, trabalhando junto." },
];

function CritIcon({ icon, size = 17 }: { icon: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (icon) {
    case "clients": return <svg {...common}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case "delivery": return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6v6H9z" /></svg>;
    case "paying": return <svg {...common}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>;
    case "drive": return <svg {...common}><path d="M12 2 2 20h20L12 2Z" /></svg>;
    case "instagram": return <svg {...common}><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>;
    case "team": return <svg {...common}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    default: return null;
  }
}

function Calculator() {
  const [state, setState] = useState<AgencyLevelInput>({
    activeClients: 5, finalizedCount: 60, isPayingCustomer: true, driveConnected: true, instagramConnectedCount: 3, teamSize: 1,
  });
  const points = computeAgencyPoints(state);
  const level = getAgencyLevel(points);
  const color = TIER_COLOR[level.tier as AgencyTierName];
  const Icon = TIER_ICON[level.tier as AgencyTierName];

  const sliders: { key: keyof AgencyLevelInput; label: string; min: number; max: number }[] = [
    { key: "activeClients", label: "Clientes ativos", min: 0, max: 20 },
    { key: "finalizedCount", label: "Posts/reels entregues (total)", min: 0, max: 2500 },
    { key: "instagramConnectedCount", label: "Clientes com Instagram conectado", min: 0, max: 20 },
    { key: "teamSize", label: "Pessoas na equipe (além de você)", min: 0, max: 15 },
  ];

  return (
    <div className="rounded-3xl border p-6 sm:p-7 grid sm:grid-cols-[1fr_280px] gap-7" style={{ background: `linear-gradient(180deg, ${BG_GRAY}, ${BG_BLUE})`, borderColor: "rgba(255,255,255,0.14)" }}>
      <div className="flex flex-col gap-5">
        {sliders.map((s) => (
          <div key={s.key} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-bold text-white/70">{s.label}</span>
              <span className="text-[13px] font-black tabular-nums" style={{ color: LIME }}>{state[s.key] as number}</span>
            </div>
            <input
              type="range" min={s.min} max={s.max} value={state[s.key] as number}
              onChange={(e) => setState((prev) => ({ ...prev, [s.key]: Number(e.target.value) }))}
              className="w-full accent-[#D7FF3F]"
            />
          </div>
        ))}
        {([
          { key: "driveConnected", label: "Google Drive conectado" },
          { key: "isPayingCustomer", label: "É cliente pagante (não teste)" },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setState((prev) => ({ ...prev, [t.key]: !prev[t.key] }))}
            className="flex items-center gap-2.5 text-left"
          >
            <span
              className="relative w-10 h-[22px] rounded-full shrink-0 transition"
              style={{ background: state[t.key] ? LIME : "rgba(255,255,255,0.14)" }}
            >
              <span
                className="absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white transition-transform"
                style={{ left: 2, transform: state[t.key] ? "translateX(18px)" : "translateX(0)", background: state[t.key] ? BG_BLUE : "#fff" }}
              />
            </span>
            <span className="text-[12.5px] font-bold text-white/70">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center justify-center text-center rounded-2xl p-6" style={{ background: BG_BLUE, border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="w-[76px] h-[76px] rounded-[22px] flex items-center justify-center mb-3.5 transition" style={{ backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`, color, boxShadow: `0 0 0 8px color-mix(in srgb, ${color} 10%, transparent)` }}>
          <Icon size={38} />
        </div>
        <div className="text-[19px] font-black mb-1" style={{ color }}>{level.label}</div>
        <div className="text-white/35 text-[12px] tabular-nums mb-3.5">{points} pts</div>
        <div className="w-full h-1.5 rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.1)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${level.progressPct}%`, background: color }} />
        </div>
        <div className="text-white/35 text-[11px]">
          {level.pointsToNext != null ? `${level.pointsToNext} pts pro próximo nível` : "Nível máximo!"}
        </div>
      </div>
    </div>
  );
}

function AgencyLevelsPage() {
  return (
    <div className="min-h-screen text-white" style={{ background: BG_BLUE, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <header className="flex items-center justify-between px-5 sm:px-10 py-5 border-b border-white/10">
        <div className="flex items-center justify-between max-w-[720px] mx-auto w-full">
          <Link to="/"><ModoCriadorLogo variant="brand" className="h-6 w-auto" /></Link>
          <Link to="/minhas-tarefas" className="text-sm text-white/60 hover:text-white transition">← Voltar pro app</Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 -right-24 w-[420px] h-[420px] rounded-full blur-[110px] opacity-[0.14]" style={{ background: "#4A6BFF" }} />
        <div className="pointer-events-none absolute -bottom-32 -left-24 w-[360px] h-[360px] rounded-full blur-[120px] opacity-[0.1]" style={{ background: LIME }} />
        <Reveal className="relative px-5 sm:px-10 max-w-[720px] mx-auto pt-16 pb-14 text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full mb-6" style={{ background: LIME, color: BG_BLUE }}>
            Programa de Níveis
          </span>
          <h1 className="font-criador-serif normal-case text-4xl sm:text-6xl leading-[1.05] mb-5" style={{ textWrap: "balance" as any }}>
            Sua agência tem <span style={{ color: LIME }}>nível</span>.<br />Suba nele.
          </h1>
          <p className="text-white/60 text-base max-w-md mx-auto leading-relaxed">
            Cada cliente que você organiza, cada post que entrega, cada ferramenta que conecta — tudo soma pontos.
            Seis patamares, dezoito degraus, até chegar em <b className="text-white">Lendária</b>.
          </p>
        </Reveal>
      </section>

      <section className="px-5 sm:px-10 max-w-[720px] mx-auto py-14">
        <div className="text-[11px] font-black uppercase tracking-wider text-white/40 mb-3">A escada</div>
        <h2 className="font-criador-serif normal-case text-2xl sm:text-3xl mb-8">Bronze até Lendária</h2>
        <TierLadder />
      </section>

      <section style={{ background: BG_GRAY }} className="border-y border-white/10">
        <div className="px-5 sm:px-10 max-w-[720px] mx-auto py-14">
          <div className="text-[11px] font-black uppercase tracking-wider text-white/40 mb-3">Como pontuar</div>
          <h2 className="font-criador-serif normal-case text-2xl sm:text-3xl mb-8">O que soma pontos</h2>
          <div className="grid sm:grid-cols-3 gap-3.5">
            {CRITERIA.map((c) => (
              <div key={c.title} className="rounded-2xl p-4.5 border" style={{ background: BG_BLUE, borderColor: "rgba(255,255,255,0.08)" }}>
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center mb-3" style={{ background: "rgba(215,255,63,0.12)", color: LIME }}>
                  <CritIcon icon={c.icon} />
                </div>
                <div className="text-[13.5px] font-black mb-1">{c.title}</div>
                <div className="text-[11px] font-bold mb-1.5" style={{ color: LIME }}>{c.pts}</div>
                <div className="text-[12px] text-white/40 leading-relaxed">{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 sm:px-10 max-w-[720px] mx-auto py-14">
        <div className="text-[11px] font-black uppercase tracking-wider text-white/40 mb-3">Calculadora</div>
        <h2 className="font-criador-serif normal-case text-2xl sm:text-3xl mb-8">Onde a sua agência estaria?</h2>
        <Calculator />
      </section>

      <section className="px-5 sm:px-10 max-w-[560px] mx-auto py-4 text-center">
        <p className="text-white/35 text-[12.5px] leading-relaxed">
          Não curtiu a ideia? Sem problema — dá pra sair do Programa de Níveis quando quiser, em{" "}
          <b className="text-white/55">Configurações → Geral → Recursos → Programa de Níveis</b>. O selo some da barra lateral e ninguém mais é avaliado.
        </p>
      </section>

      <footer className="px-5 sm:px-10 py-10 text-center text-white/30 text-xs">
        Modo <span className="font-criador-serif">Criador</span> — o nível é só um jogo pra celebrar o que sua agência já faz de verdade.
      </footer>
    </div>
  );
}
