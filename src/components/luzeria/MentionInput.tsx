import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { membersQO } from "@/lib/luzeria/queries";
import { Avatar } from "./Avatar";

interface Props {
  value: string;
  onChange: (v: string, mentionedIds: string[]) => void;
  placeholder?: string;
  className?: string;
  onSubmit?: () => void;
  rows?: number;
}

export function MentionInput({ value, onChange, placeholder, className, onSubmit, rows = 2 }: Props) {
  const { data: members = [] } = useQuery(membersQO());
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  const matches = open
    ? members
        .filter((m: any) =>
          (m.name ?? "").toLowerCase().includes(query.toLowerCase()) ||
          (m.email ?? "").toLowerCase().includes(query.toLowerCase()))
        .slice(0, 6)
    : [];

  useEffect(() => { setHi(0); }, [query, open]);

  const extractMentions = (text: string): string[] => {
    const ids: string[] = [];
    const re = /@\[([^\]]+)\]\(([0-9a-f-]{36})\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) ids.push(m[2]);
    return Array.from(new Set(ids));
  };

  const handleChange = (text: string) => {
    onChange(text, extractMentions(text));
    const el = ref.current; if (!el) return;
    const cursor = el.selectionStart ?? text.length;
    const upto = text.slice(0, cursor);
    const m = upto.match(/(?:^|\s)@([\w\u00C0-\u017F]{0,30})$/);
    if (m) { setQuery(m[1]); setOpen(true); } else setOpen(false);
  };

  const pickMember = (mem: any) => {
    const el = ref.current; if (!el) return;
    const cursor = el.selectionStart ?? value.length;
    const before = value.slice(0, cursor).replace(/@([\w\u00C0-\u017F]{0,30})$/, `@[${mem.name}](${mem.id}) `);
    const after = value.slice(cursor);
    const next = before + after;
    onChange(next, extractMentions(next));
    setOpen(false);
    setTimeout(() => { el.focus(); el.setSelectionRange(before.length, before.length); }, 0);
  };

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (open && matches.length) {
            if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => (h + 1) % matches.length); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => (h - 1 + matches.length) % matches.length); }
            else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickMember(matches[hi]); }
            else if (e.key === "Escape") setOpen(false);
          } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && onSubmit) {
            e.preventDefault(); onSubmit();
          }
        }}
        placeholder={placeholder ?? "Escreva um comentário... use @ para mencionar"}
        rows={rows}
        className={className ?? "w-full bg-[#0D0D0D] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#C8D44E]/50 resize-none"}
      />
      {open && matches.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-[#1C1C1C] border border-white/10 rounded-lg overflow-hidden shadow-2xl">
          {matches.map((m: any, idx: number) => (
            <button key={m.id} type="button" onMouseDown={(e) => { e.preventDefault(); pickMember(m); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                idx === hi ? "bg-[#C8D44E]/10 text-[#C8D44E]" : "text-white/80 hover:bg-white/5"}`}>
              <Avatar name={m.name} url={m.avatar_url ?? undefined} color={m.avatar_color ?? undefined} size={22} />
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
      : <span key={i} className="text-[#C8D44E] font-semibold">@{p.name}</span>
  );
}