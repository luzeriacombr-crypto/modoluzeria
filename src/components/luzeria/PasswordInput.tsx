import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Campo de senha com botão de "mostrar senha" — todo lugar que pede pra
 * criar/redefinir senha usa esse componente em vez de <input type="password">
 * direto, pra pessoa conseguir conferir o que digitou antes de enviar. */
export function PasswordInput({
  className,
  wrapperClassName = "relative",
  toggleClassName = "text-foreground/40 hover:text-foreground/70",
  ...inputProps
}: React.InputHTMLAttributes<HTMLInputElement> & { wrapperClassName?: string; toggleClassName?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={wrapperClassName}>
      <input
        {...inputProps}
        type={visible ? "text" : "password"}
        className={className ? `${className} pr-9` : "pr-9"}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Esconder senha" : "Mostrar senha"}
        className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors ${toggleClassName}`}
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}
