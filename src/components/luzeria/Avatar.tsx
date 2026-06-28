import { cn } from "@/lib/utils";
import { initial } from "@/lib/luzeria/utils";

const COLORS = [
  "#C8D44E",
  "#FF8C42",
  "#4A9EFF",
  "#B794F4",
  "#F472B6",
  "#34D399",
  "#FBBF24",
];

function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

interface Props {
  name?: string | null;
  color?: string;
  size?: number;
  icon?: string;
  className?: string;
}

export function Avatar({ name, color, size = 24, icon, className }: Props) {
  const bg = color ?? (name ? hashColor(name) : "rgba(255,255,255,0.12)");
  const fontSize = Math.max(10, Math.floor(size * 0.42));
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-[#0D0D0D]",
        className
      )}
      style={{ width: size, height: size, backgroundColor: bg, fontSize }}
      title={name ?? undefined}
    >
      {icon ? <span style={{ fontSize: size * 0.55 }}>{icon}</span> : name ? initial(name) : "?"}
    </span>
  );
}