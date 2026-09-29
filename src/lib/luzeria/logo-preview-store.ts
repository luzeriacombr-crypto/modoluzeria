// Prévia ao vivo do ajuste manual de tamanho/posição da logo (Configurações
// → Marca da agência): em vez de uma caixinha de prévia separada, o Junior
// pediu pra ver a mudança direto na sidebar de verdade enquanto arrasta a
// régua. Como a Sidebar é um componente diferente (sempre montado no layout,
// fora da rota de Configurações), a única forma limpa de "avisar" ela em
// tempo real, sem salvar no banco a cada tick da régua, é por uma store
// compartilhada — puramente em memória, nunca persiste (sair da tela de
// Configurações limpa a prévia e a sidebar volta a mostrar o valor salvo).
import { create } from "zustand";

interface LogoPreview {
  /** null = não tem prévia ativa, a Sidebar usa o valor salvo (me.orgLogo*AdjustPx). */
  sizeAdjustPx: number | null;
  positionAdjustPx: number | null;
  setLogoPreview: (sizeAdjustPx: number, positionAdjustPx: number) => void;
  clearLogoPreview: () => void;
}

export const useLogoPreview = create<LogoPreview>((set) => ({
  sizeAdjustPx: null,
  positionAdjustPx: null,
  setLogoPreview: (sizeAdjustPx, positionAdjustPx) => set({ sizeAdjustPx, positionAdjustPx }),
  clearLogoPreview: () => set({ sizeAdjustPx: null, positionAdjustPx: null }),
}));
