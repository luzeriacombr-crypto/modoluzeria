import type { Profile } from "@/lib/luzeria/types";

export function Avatar({
  profile, color, name, size = 28, ring = false,
}: {
  profile?: Pick<Profile, "name" | "color" | "icon"> | null;
  color?: string;
  name?: string;
  size?: number;
  ring?: boolean;
}) {
  const c = profile?.color ?? color ?? "#C8D44E";
  const n = profile?.name ?? name ?? "?";
  const initial = profile?.icon || n.trim().charAt(0).toUpperCase() || "?";
  const isWhite = c.toUpperCase() === "#FFFFFF";
  return (
    <div
      className={`rounded-full flex items-center justify-center font-semibold shrink-0 ${ring ? "ring-2 ring-[#1C1C1C]" : ""}`}
      style={{
        width: size, height: size,
        backgroundColor: c,
        color: isWhite ? "#0D0D0D" : "#0D0D0D",
        fontSize: Math.round(size * 0.42),
      }}
      title={n}
    >
      {initial}
    </div>
  );
}

export function AvatarStack({
  profiles, size = 28, max = 3,
}: { profiles: Pick<Profile, "id" | "name" | "color" | "icon">[]; size?: number; max?: number }) {
  const shown = profiles.slice(0, max);
  const extra = profiles.length - shown.length;
  return (
    <div className="flex items-center" title={profiles.map((p) => p.name).join(", ")}>
      {shown.map((p, i) => (
        <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <Avatar profile={p} size={size} ring />
        </div>
      ))}
      {extra > 0 && (
        <div
          className="rounded-full bg-[#252525] text-white/70 ring-2 ring-[#1C1C1C] flex items-center justify-center font-semibold"
          style={{ width: size, height: size, fontSize: Math.round(size * 0.38), marginLeft: -8 }}
        >+{extra}</div>
      )}
    </div>
  );
}