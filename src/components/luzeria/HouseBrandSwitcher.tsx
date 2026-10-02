// Seletor de marca da House (Levive, Doctor Fit…). Só aparece com 2+ marcas
// liberadas pra pessoa; quem só tem uma não vê nada.
import { useHouseBrand } from "@/lib/luzeria/house-brand-store";

export function HouseBrandSwitcher({ className = "" }: { className?: string }) {
  const { brands, scope, setScope, multi } = useHouseBrand();
  if (!multi) return null;
  const chip = (id: string, label: string) => {
    const active = scope === id;
    return (
      <button key={id} type="button" onClick={() => setScope(id)} aria-pressed={active}
        className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors border ${active ? "" : "border-foreground/10 text-foreground/60 hover:text-foreground hover:bg-foreground/[0.04]"}`}
        style={active ? { background: "var(--lz-accent-soft, rgba(125,211,252,0.15))", color: "var(--lz-accent-ink)", borderColor: "var(--lz-accent-ink)" } : undefined}>
        {label}
      </button>
    );
  };
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`} role="group" aria-label="Marca">
      {chip("all", "Todas as marcas")}
      {brands.map((b) => chip(b.id, b.name))}
    </div>
  );
}

/** Escolha da marca num formulário de criação (lead, demanda, projeto…). */
export function HouseBrandSelect({ value, onChange }: { value: string | undefined; onChange: (id: string) => void }) {
  const { brands, multi, writeBrandId } = useHouseBrand();
  if (!multi) return null;
  return (
    <label className="block">
      <span className="text-[11px] uppercase font-bold tracking-wider text-foreground/50">Marca</span>
      <select value={value ?? writeBrandId ?? ""} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl bg-background border border-foreground/10 px-3 py-2 text-sm">
        {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
    </label>
  );
}
