// House com várias marcas: qual marca a pessoa está olhando agora
// ("all" = todas as que ela pode ver). Fica salvo no navegador.
import { create } from "zustand";
import { useQuery } from "@tanstack/react-query";
import { brandScopeKey, type BrandInfo } from "./house-brands";
import { clientsQO, useMe } from "./queries";

function read(): string {
  if (typeof window === "undefined") return "all";
  try { return window.localStorage.getItem(brandScopeKey) || "all"; } catch { return "all"; }
}

interface BrandStore {
  scope: string;
  setScope: (s: string) => void;
}

export const useBrandStore = create<BrandStore>((set) => ({
  scope: read(),
  setScope: (s) => {
    try { window.localStorage.setItem(brandScopeKey, s); } catch { /* noop */ }
    set({ scope: s });
  },
}));

/** Marcas que a pessoa enxerga (a RLS de clients já respeita o acesso por
 * marca) e a seleção atual. Com 1 marca só, tudo funciona como antes. */
export function useHouseBrand() {
  const me = useMe().data;
  const { data: clients = [] } = useQuery(clientsQO());
  const stored = useBrandStore((s) => s.scope);
  const setScope = useBrandStore((s) => s.setScope);
  const mainId = (me as any)?.houseClientId ?? null;
  const brands: BrandInfo[] = (clients as any[])
    .filter((c) => !c.archived && c.category !== "Ex-clientes")
    .map((c) => ({ id: c.id as string, name: c.name as string, isMain: c.id === mainId }))
    .sort((a, b) => Number(b.isMain) - Number(a.isMain) || a.name.localeCompare(b.name));
  // Seleção guardada que a pessoa não pode mais ver volta pra "todas".
  const scope = stored !== "all" && brands.some((b) => b.id === stored) ? stored : "all";
  const multi = brands.length > 1;
  // Marca onde registros novos caem quando a visão é "todas".
  const writeBrandId = scope !== "all" ? scope : (brands.find((b) => b.isMain)?.id ?? brands[0]?.id ?? undefined);
  return { brands, scope, setScope, multi, writeBrandId, brandParam: multi && scope !== "all" ? scope : undefined };
}
