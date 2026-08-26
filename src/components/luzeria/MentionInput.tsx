import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { profilesQO } from "@/lib/luzeria/queries";
import { Avatar } from "./Avatar";
import type { Profile } from "@/lib/luzeria/types";

interface Props {
  value: string;
  onChange: (v: string, mentionedIds: string[]) => void;
  placeholder?: string;
  className?: string;
  onSubmit?: () => void;
  rows?: number;
}

const MENTION_RE = /@\[([^\]]+)\]\(([0-9a-f-]{36})\)/g;

type Segment = { raw: string; display: string; isMention: boolean };

/** Splits the stored `@[Name](uuid)` text into plain/mention runs, pairing
 * each mention's raw form with its friendly `@Name` display form. */
function toSegments(raw: string): Segment[] {
  const segs: Segment[] = [];
  let last = 0;
  const re = new RegExp(MENTION_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) segs.push({ raw: raw.slice(last, m.index), display: raw.slice(last, m.index), isMention: false });
    segs.push({ raw: m[0], display: `@${m[1]}`, isMention: true });
    last = m.index + m[0].length;
  }
  if (last < raw.length) segs.push({ raw: raw.slice(last), display: raw.slice(last), isMention: false });
  return segs;
}

function toDisplay(raw: string): string {
  return toSegments(raw).map((s) => s.display).join("");
}

/** Maps a position in the DISPLAY string back to a RAW offset. `mode`
 * decides which way a position landing inside a mention chip rounds —
 * "start" snaps to before the chip, "end" snaps to after it — so an edit
 * that touches any part of a mention removes the WHOLE chip (id and all)
 * instead of leaving a broken `@[Na` fragment behind. */
function mapDisplayToRaw(segs: Segment[], pos: number, mode: "start" | "end"): number {
  let dPos = 0, rPos = 0;
  for (const seg of segs) {
    const dLen = seg.display.length, rLen = seg.raw.length;
    if (pos <= dPos) return rPos;
    const inside = mode === "start" ? pos < dPos + dLen : pos <= dPos + dLen;
    if (inside) {
      if (seg.isMention) return mode === "start" ? rPos : rPos + rLen;
      return rPos + (pos - dPos);
    }
    dPos += dLen; rPos += rLen;
  }
  return rPos;
}

function extractMentions(raw: string): string[] {
  const ids: string[] = [];
  const re = new RegExp(MENTION_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) ids.push(m[2]);
  return Array.from(new Set(ids));
}

export function MentionInput({ value, onChange, placeholder, className, onSubmit, rows = 2 }: Props) {
  const { data: profiles } = useQuery(profilesQO());
  const members = (profiles ?? []).filter((p: Profile) => p.active);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  // Cursor position (display coords) to restore after a raw-splice update —
  // React resets the DOM cursor whenever the controlled value differs from
  // what the browser transiently showed (e.g. a chip removed atomically).
  const pendingCursor = useRef<number | null>(null);

  const display = toDisplay(value);

  const matches = open
    ? members
        .filter((m) =>
          (m.name ?? "").toLowerCase().includes(query.toLowerCase()) ||
          (m.email ?? "").toLowerCase().includes(query.toLowerCase()))
        .slice(0, 6)
    : [];

  useEffect(() => { setHi(0); }, [query, open]);

  useEffect(() => {
    if (pendingCursor.current !== null && ref.current) {
      const pos = pendingCursor.current;
      ref.current.setSelectionRange(pos, pos);
      pendingCursor.current = null;
    }
  }, [value]);

  function checkTrigger(newDisplay: string, cursor: number) {
    const upto = newDisplay.slice(0, cursor);
    const m = upto.match(/(?:^|\s)@([\w\u00C0-\u017F]{0,30})$/);
    if (m) { setQuery(m[1]); setOpen(true); } else setOpen(false);
  }

  const handleChange = (newDisplay: string, cursor: number) => {
    const oldDisplay = display;
    // Shortest edit between old/new display: common prefix + common suffix.
    let p = 0;
    const minLen = Math.min(oldDisplay.length, newDisplay.length);
    while (p < minLen && oldDisplay[p] === newDisplay[p]) p++;
    let sOld = oldDisplay.length, sNew = newDisplay.length;
    while (sOld > p && sNew > p && oldDisplay[sOld - 1] === newDisplay[sNew - 1]) { sOld--; sNew--; }
    const inserted = newDisplay.slice(p, sNew);

    const segs = toSegments(value);
    const rawStart = mapDisplayToRaw(segs, p, "start");
    const rawEnd = mapDisplayToRaw(segs, sOld, "end");
    const nextRaw = value.slice(0, rawStart) + inserted + value.slice(rawEnd);

    pendingCursor.current = toDisplay(value.slice(0, rawStart)).length + inserted.length;
    onChange(nextRaw, extractMentions(nextRaw));
    checkTrigger(newDisplay, cursor);
  };

  const pickMember = (mem: Profile) => {
    const el = ref.current; if (!el) return;
    const cursor = el.selectionStart ?? display.length;
    const before = display.slice(0, cursor);
    const m = before.match(/@([\w\u00C0-\u017F]{0,30})$/);
    const partialStart = m ? cursor - m[0].length : cursor;

    const segs = toSegments(value);
    const rawStart = mapDisplayToRaw(segs, partialStart, "start");
    const rawEnd = mapDisplayToRaw(segs, cursor, "end");
    const mentionRaw = `@[${mem.name}](${mem.id}) `;
    const nextRaw = value.slice(0, rawStart) + mentionRaw + value.slice(rawEnd);

    pendingCursor.current = toDisplay(value.slice(0, rawStart)).length + `@${mem.name} `.length;
    onChange(nextRaw, extractMentions(nextRaw));
    setOpen(false);
    setTimeout(() => el.focus(), 0);
  };

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={display}
        onChange={(e) => handleChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
        onKeyDown={(e) => {
          if (open && matches.length) {
            if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => (h + 1) % matches.length); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => (h - 1 + matches.length) % matches.length); }
            else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickMember(matches[hi]); }
            else if (e.key === "Escape") setOpen(false);
          } else if (e.key === "Enter" && !e.shiftKey && onSubmit) {
            e.preventDefault(); onSubmit();
          }
        }}
        placeholder={placeholder ?? "Escreva um comentário... use @ para mencionar"}
        rows={rows}
        className={className ?? "lz-input-dark w-full bg-background border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 resize-none"}
      />
      {open && matches.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-card border border-foreground/10 rounded-lg overflow-hidden shadow-2xl">
          {matches.map((m, idx) => (
            <button key={m.id} type="button" onMouseDown={(e) => { e.preventDefault(); pickMember(m); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                idx === hi ? "" : "text-foreground/80 hover:bg-foreground/5"}`}
              style={idx === hi ? { backgroundColor: "rgba(var(--lz-brand-light-rgb), 0.1)", color: "var(--lz-accent-ink)" } : undefined}>
              <Avatar profile={m} size={22} />
              <span className="truncate">{m.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Render @[name](uuid) as styled chips, plain text untouched. */
export function renderMentions(text: string) {
  const parts: (string | { name: string; id: string })[] = [];
  const re = /@\[([^\]]+)\]\(([0-9a-f-]{36})\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ name: m[1], id: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.map((p, i) =>
    typeof p === "string"
      ? <span key={i}>{p}</span>
      : <span key={i} className="text-[var(--lz-accent-ink)] font-semibold">@{p.name}</span>
  );
}
