import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/luzeria/theme-store";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";
  return (
    <button
      onClick={toggleTheme}
      title={isLight ? "Mudar para modo escuro" : "Mudar para modo claro"}
      aria-label={isLight ? "Mudar para modo escuro" : "Mudar para modo claro"}
      className="flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
    >
      {isLight ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
