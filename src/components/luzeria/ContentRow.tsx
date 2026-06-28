import { useState, useRef, useEffect } from "react";
import { ExternalLink, MessageCircle } from "lucide-react";
import type { ContentItem } from "@/lib/luzeria/types";
import { STATUS_ORDER } from "@/lib/luzeria/types";
import { useLuzeria } from "@/lib/luzeria/store";
import { StatusBadge } from "./StatusBadge";
import { Avatar } from "./Avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Props {
  clientId: string;
  monthKey: string;
  item: ContentItem;
  onOpen: () => void;
}

export function ContentRow({ clientId, monthKey, item, onOpen }: Props) {
  const updateItem = useLuzeria((s) => s.updateItem);
  const setStatus = useLuzeria((s) => s.setStatus);
  const recentlyUpdated = useLuzeria((s) => s.recentlyUpdated);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [pulse, setPulse] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setTitle(item.title), [item.title]);

  const highlight = recentlyUpdated === item.id;

  function commitTitle() {
    setEditing(false);
    const trimmed = title.trim();
    if (trimmed && trimmed !== item.title) {
      updateItem(clientId, monthKey, item.id, { title: trimmed });
    } else {
      setTitle(item.title);
    }
  }

  const hasDrive = item.driveLink.trim().length > 0;
  const commentCount = item.comments.filter((c) => !c.system).length;

  return (
    <div
      onClick={onOpen}
      className={cn(
        "group flex cursor-pointer items-center gap-4 rounded px-4 py-3.5 transition-colors duration-150 hover:bg-white/[0.03]",
        highlight && "lz-highlight"
      )}
    >
      <span className="w-7 shrink-0 text-xs tabular-nums text-muted-foreground">
        {String(item.index).padStart(2, "0")}
      </span>

      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            ref={inputRef}
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
              if (e.key === "Escape") {
                setTitle(item.title);
                setEditing(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded bg-white/5 px-2 py-1 text-sm text-white outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            className="block w-full truncate text-left text-sm text-white"
          >
            {item.title}
          </button>
        )}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <div onClick={(e) => e.stopPropagation()}>
            <StatusBadge
              status={item.status}
              pulse={pulse}
              onClick={() => {}}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-auto p-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-0.5">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                onClick={() => {
                  if (s !== item.status) {
                    setStatus(clientId, monthKey, item.id, s);
                    setPulse(true);
                    setTimeout(() => setPulse(false), 300);
                  }
                }}
                className="rounded px-1 py-0.5 text-left transition hover:bg-white/5"
              >
                <StatusBadge status={s} />
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <div className="w-8 shrink-0">
        {item.assignee ? (
          <Avatar name={item.assignee} size={22} />
        ) : (
          <div className="h-[22px] w-[22px] rounded-full border border-dashed border-white/15" />
        )}
      </div>

      <div className="flex w-16 shrink-0 items-center justify-end gap-3">
        <span
          title={hasDrive ? "Abrir no Drive" : "Sem link"}
          onClick={(e) => {
            e.stopPropagation();
            if (hasDrive) window.open(item.driveLink, "_blank");
          }}
          className={cn(
            "transition",
            hasDrive
              ? "text-primary hover:opacity-80"
              : "cursor-default text-white/30"
          )}
        >
          <ExternalLink size={14} />
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <MessageCircle size={14} />
          <span className="text-[11px] tabular-nums">{commentCount}</span>
        </span>
      </div>
    </div>
  );
}