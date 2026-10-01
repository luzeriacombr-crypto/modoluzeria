import { useEffect } from "react";
import { SOURCE_LANGUAGE, syncGoogTransCookie, useLanguage } from "@/lib/luzeria/language-store";

declare global {
  interface Window {
    google?: any;
    lzGoogleTranslateInit?: () => void;
  }
}

const SCRIPT_ID = "lz-google-translate";
const CONTAINER_ID = "lz-google-translate-element";

// O tradutor troca os textos da página por <font> por baixo do React. Quando
// o React depois tenta remover/inserir um nó que o tradutor já moveu, o
// navegador lança "removeChild/insertBefore: not a child" e a tela quebra.
// Esse remendo (o recomendado na issue do React #11538) ignora essas
// operações em vez de derrubar o app. Só é aplicado com a tradução ligada.
let domPatched = false;
function patchDomForTranslation() {
  if (domPatched || typeof Node !== "function") return;
  domPatched = true;
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return originalRemoveChild.call(this, child) as T;
  };
  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) return newNode;
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

// Liga o tradutor automático do Google no app logado quando a pessoa escolheu
// um idioma diferente do português em Perfil. Não renderiza nada visível: a
// barra do Google é escondida via CSS (ver styles.css, "Google Tradutor").
export function AutoTranslate() {
  const language = useLanguage((s) => s.language);

  useEffect(() => {
    syncGoogTransCookie(language);
    if (language === SOURCE_LANGUAGE) return;
    patchDomForTranslation();
    if (document.getElementById(SCRIPT_ID)) return;

    let container = document.getElementById(CONTAINER_ID);
    if (!container) {
      container = document.createElement("div");
      container.id = CONTAINER_ID;
      container.style.display = "none";
      document.body.appendChild(container);
    }

    window.lzGoogleTranslateInit = () => {
      if (!window.google?.translate?.TranslateElement) return;
      new window.google.translate.TranslateElement(
        { pageLanguage: SOURCE_LANGUAGE, includedLanguages: language, autoDisplay: false },
        CONTAINER_ID,
      );
    };

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = "https://translate.google.com/translate_a/element.js?cb=lzGoogleTranslateInit";
    script.async = true;
    document.body.appendChild(script);
  }, [language]);

  return null;
}
