import { create } from "zustand";

// Idiomas do app. O texto do app é escrito em português; os outros idiomas
// são traduzidos automaticamente pelo tradutor do Google (ver
// AutoTranslate.tsx). Pra adicionar um idioma (ex.: inglês), basta incluir
// aqui — o código é o mesmo que o Google Tradutor usa ("en", "es"...).
export const LANGUAGES = [
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "es", label: "Español", flag: "🇲🇽" },
] as const;

export type Language = (typeof LANGUAGES)[number]["code"];

export const SOURCE_LANGUAGE: Language = "pt";

const LANG_KEY = "lz.lang";

function isLanguage(v: unknown): v is Language {
  return LANGUAGES.some((l) => l.code === v);
}

function readLanguage(): Language {
  if (typeof window === "undefined") return SOURCE_LANGUAGE;
  try {
    const v = window.localStorage.getItem(LANG_KEY);
    return isLanguage(v) ? v : SOURCE_LANGUAGE;
  } catch {
    return SOURCE_LANGUAGE;
  }
}

// O tradutor do Google decide o idioma pelo cookie "googtrans" ("/pt/es").
// Ele mesmo grava esse cookie às vezes no domínio pai (".modocriador.com"),
// então pra voltar ao português é preciso apagar em todos os níveis.
function clearGoogTransCookie() {
  const parts = window.location.hostname.split(".");
  const domains: (string | null)[] = [null];
  for (let i = 0; i < parts.length - 1; i++) {
    const d = parts.slice(i).join(".");
    domains.push(d, `.${d}`);
  }
  for (const d of domains) {
    document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d ? `; domain=${d}` : ""}`;
  }
}

export function syncGoogTransCookie(lang: Language) {
  if (typeof document === "undefined") return;
  clearGoogTransCookie();
  if (lang !== SOURCE_LANGUAGE) {
    document.cookie = `googtrans=/${SOURCE_LANGUAGE}/${lang}; path=/; max-age=31536000; SameSite=Lax`;
  }
}

interface LanguageStore {
  language: Language;
  setLanguage: (l: Language) => void;
}

export const useLanguage = create<LanguageStore>((set, get) => ({
  language: readLanguage(),
  setLanguage: (l) => {
    if (l === get().language) return;
    try { window.localStorage.setItem(LANG_KEY, l); } catch { /* noop */ }
    syncGoogTransCookie(l);
    set({ language: l });
    // Trocar o idioma com a página já traduzida deixa pedaços misturados —
    // recarregar é o jeito confiável de o tradutor começar do zero.
    window.location.reload();
  },
}));
