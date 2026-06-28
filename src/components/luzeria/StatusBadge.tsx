import {
  CheckCircle,
  Eye,
  MessageSquare,
  Paintbrush,
  Play,
  type LucideIcon,
} from "lucide-react";
import { STATUS_META, type Status } from "@/lib/luzeria/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Play,
  Paintbrush,
  Eye,
  MessageSquare,
  CheckCircle,
};

interface Props {
  status: Status;
  pulse?: boolean;
  size?: "sm" | "md";
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  showLabel?: boolean;
}

export function StatusBadge({
  status,
  pulse,
  size = "sm",
  onClick,
  className,
  showLabel = true,
}: Props) {
  const meta = STATUS_META[status];
  const Icon = ICONS[meta.icon];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ backgroundColor: meta.bg, color: meta.color }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded font-medium uppercase tracking-wide transition-all duration-150 hover:opacity-80",
        size === "sm" ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs",
        pulse && "lz-pulse",
        !onClick && "cursor-default",
        className
      )}
    >
      <Icon size={size === "sm" ? 11 : 13} strokeWidth={2.4} />
      {showLabel && <span>{meta.label}</span>}
    </button>
  );
}