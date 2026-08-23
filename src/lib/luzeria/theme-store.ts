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

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("light", theme === "light");
}

interface ThemeStore {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

export const useTheme = create<ThemeStore>((set, get) => ({
  theme: readTheme(),
  setTheme: (t) => {
    try { window.localStorage.setItem(THEME_KEY, t); } catch { /* noop */ }
    applyTheme(t);
    set({ theme: t });
  },
  toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
}));

/** Script inline injetado no <head>, antes da hidratação — lê o tema salvo e
 * já aplica a classe .light síncrono, pra ninguém ver um flash claro/escuro
 * errado antes do React montar. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light")document.documentElement.classList.add("light");}catch(e){}})();`;
