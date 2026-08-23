import { create } from "zustand";

export type Theme = "dark" | "light";

const THEME_KEY = "lz.theme";

function readTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    return window.localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

interface ThemeStore {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

// A classe .light NUNCA vai no <html> — isso vazaria pro site de vendas, pro
// link público de preview e pra qualquer outra página fora do app logado,
// que não foram feitas pra suportar o claro. Em vez disso, App.tsx aplica a
// classe só no elemento raiz do próprio app (ver App.tsx), então o resto do
// site sempre renderiza com a paleta escura de :root, intocada.
export const useTheme = create<ThemeStore>((set, get) => ({
  theme: readTheme(),
  setTheme: (t) => {
    try { window.localStorage.setItem(THEME_KEY, t); } catch { /* noop */ }
    set({ theme: t });
  },
  toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
}));
