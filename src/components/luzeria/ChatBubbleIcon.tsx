import type { SVGProps } from "react";

/** Ícone próprio do Chat do Modo Criador — um balão de conversa com uma
 * faísca de 4 pontas, no lugar do MessageCircle genérico do lucide-react.
 * Mesma API de um ícone lucide (`size` + props de SVG repassados). */
export function ChatBubbleIcon({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M19 2.2 L19.7 4.3 L21.8 5 L19.7 5.7 L19 7.8 L18.3 5.7 L16.2 5 L18.3 4.3 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
