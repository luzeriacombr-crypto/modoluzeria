import { useEffect, useState } from "react";
import {
  ExternalLink,
  Film,
  FolderOpen,
  Grid3x3,
  Image as ImageIcon,
  Send,
  X,
} from "lucide-react";
import { useLuzeria } from "@/lib/luzeria/store";
import { STATUS_ORDER, TEAM } from "@/lib/luzeria/types";
import { StatusBadge } from "./StatusBadge";
import { Avatar } from "./Avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { relativeTime } from "@/lib/luzeria/utils";
import { cn } from "@/lib/utils";

export function DetailPanel() {
  const selectedItemId = useLuzeria((s) => s.selectedItemId);
  const selectedClientId = useLuzeria((s) => s.selectedClientId);
  const selectedMonthKey = useLuzeria((s) => s.selectedMonthKey);
  const clients = useLuzeria((s) => s.clients);
  const closeItem = useLuzeria((s) => s.openItem);
  const updateItem = useLuzeria((s) => s.updateItem);
  const setStatus = useLuzeria((s) => s.setStatus);
  const addComment = useLuzeria((s) => s.addComment);

  const client = clients.find((c) => c.id === selectedClientId) ?? null;
  const month = client?.months[selectedMonthKey] ?? null;
  const item =
    month?.posts.find((i) => i.id === selectedItemId) ??
    month?.reels.find((i) => i.id === selectedItemId) ??
    null;

  const [titleDraft, setTitleDraft] = useState("");
  const [copyDraft, setCopyDraft] = useState("");
  const [linkDraft, setLinkDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");

  useEffect(() => {
    if (item) {
      setTitleDraft(item.title);
      setCopyDraft(item.copy);
      setLinkDraft(item.driveLink);
      setCommentDraft("");
    }
  }, [item?.id]);

  // ESC closes
  useEffect(() => {
    if (!item) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeItem(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, closeItem]);

  if (!item || !client || !month) return null;

  const driveKind = detectDriveKind(item.driveLink);

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40 transition-opacity duration-150"
        onClick={() => closeItem(null)}
      />
      <aside
        className="absolute right-0 top-0 flex h-full w-[420px] flex-col overflow-y-auto border-l border-white/10 bg-card animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {item.type === "post" ? "Post" : "Reels"} ·{" "}
            {String(item.index).padStart(2, "0")}
          </span>
          <button
            onClick={() => closeItem(null)}
            className="rounded p-1 text-muted-foreground transition hover:bg-white/5 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Title */}
        <div className="px-6 pb-4">
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              const t = titleDraft.trim();
              if (t && t !== item.title) {
                updateItem(client.id, month.key, item.id, { title: t });
              } else {
                setTitleDraft(item.title);
              }
            }}
            className="w-full bg-transparent text-lg font-semibold text-white outline-none placeholder:text-muted-foreground focus:outline-none"
            placeholder="Sem título"
          />
        </div>

        {/* Status pills */}
        <Section>
          <Label>Status</Label>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                onClick={() =>
                  s !== item.status && setStatus(client.id, month.key, item.id, s)
                }
                className={cn(
                  "rounded transition",
                  s === item.status ? "ring-1 ring-primary" : "opacity-60 hover:opacity-100"
                )}
              >
                <StatusBadge status={s} />
              </button>
            ))}
          </div>
        </Section>

        {/* Responsável */}
        <Section>
          <Label>Responsável</Label>
          <Select
            value={item.assignee ?? "__none"}
            onValueChange={(v) =>
              updateItem(client.id, month.key, item.id, {
                assignee: v === "__none" ? null : v,
              })
            }
          >
            <SelectTrigger className="h-9 w-full bg-white/5 border-white/10">
              <SelectValue placeholder="Sem responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Sem responsável</SelectItem>
              {TEAM.map((member) => (
                <SelectItem key={member} value={member}>
                  <div className="flex items-center gap-2">
                    <Avatar name={member} size={18} />
                    {member}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Section>

        {/* Copy */}
        <Section>
          <Label>Copy</Label>
          <textarea
            value={copyDraft}
            onChange={(e) => setCopyDraft(e.target.value)}
            onBlur={() =>
              copyDraft !== item.copy &&
              updateItem(client.id, month.key, item.id, { copy: copyDraft })
            }
            placeholder="Escreva o texto do post..."
            rows={5}
            className="w-full resize-none rounded bg-white/[0.03] border border-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </Section>

        {/* Arquivos */}
        <Section>
          <Label>Arquivos</Label>
          <input
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            onBlur={() =>
              linkDraft !== item.driveLink &&
              updateItem(client.id, month.key, item.id, { driveLink: linkDraft })
            }
            placeholder="Cole link do Google Drive..."
            className="w-full rounded bg-white/[0.03] border border-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
          />
          {item.driveLink && (
            <div className="mt-2 flex items-center justify-between rounded bg-white/[0.03] px-3 py-2">
              <div className="flex items-center gap-2 text-sm text-white">
                {driveKind === "video" && <Film size={14} className="text-primary" />}
                {driveKind === "image" && <ImageIcon size={14} className="text-primary" />}
                {driveKind === "carousel" && <Grid3x3 size={14} className="text-primary" />}
                {driveKind === "folder" && <FolderOpen size={14} className="text-primary" />}
                <span className="text-xs">
                  {driveKind === "video" && "Vídeo"}
                  {driveKind === "image" && "Imagem"}
                  {driveKind === "carousel" && "Carrossel"}
                  {driveKind === "folder" && "Pasta"}
                </span>
              </div>
              <a
                href={item.driveLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary transition hover:opacity-80"
              >
                Abrir no Drive
                <ExternalLink size={12} />
              </a>
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Suporta links de pastas, vídeos e carrosséis do Drive
          </p>
        </Section>

        {/* Comentários */}
        <Section last>
          <Label>Comentários</Label>
          <div className="space-y-3 mb-3">
            {item.comments.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum comentário ainda.</p>
            )}
            {item.comments
              .slice()
              .sort((a, b) => a.createdAt - b.createdAt)
              .map((c) => (
                <div key={c.id} className="text-xs">
                  {c.system ? (
                    <p className="italic text-muted-foreground">
                      · {c.text} · {relativeTime(c.createdAt)}
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      <Avatar name={c.author} size={20} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{c.author}</span>
                          <span className="text-muted-foreground">
                            {relativeTime(c.createdAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-white/80">{c.text}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const text = commentDraft.trim();
              if (!text) return;
              addComment(client.id, month.key, item.id, text, "Você");
              setCommentDraft("");
            }}
            className="flex items-center gap-2"
          >
            <input
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Novo comentário..."
              className="flex-1 rounded bg-white/[0.03] border border-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={!commentDraft.trim()}
              className="rounded bg-primary p-2 text-primary-foreground transition hover:opacity-90 disabled:opacity-30"
            >
              <Send size={14} />
            </button>
          </form>
        </Section>
      </aside>
    </div>
  );
}

function Section({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div
      className={cn(
        "px-6 py-4",
        !last && "border-b border-white/[0.06]"
      )}
    >
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

function detectDriveKind(link: string): "video" | "image" | "carousel" | "folder" {
  if (!link) return "folder";
  const l = link.toLowerCase();
  if (l.includes("/folders/")) return "folder";
  if (/(mp4|mov|avi|webm)/.test(l)) return "video";
  if (l.includes("carrossel") || l.includes("carousel")) return "carousel";
  if (/(jpg|jpeg|png|webp|gif)/.test(l)) return "image";
  if (l.includes("video")) return "video";
  return "image";
}