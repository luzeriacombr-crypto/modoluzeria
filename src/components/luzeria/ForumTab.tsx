import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MessageCircle, Search, Plus, X, Cog, Users, Sparkles, Wallet, LayoutGrid,
  Pin, Trash2, ExternalLink, ChevronDown, Send,
} from "lucide-react";
import { forumCategoriesQO, forumPostsQO, forumPostDetailQO, useApi, useMe } from "@/lib/luzeria/queries";
import { Avatar } from "./Avatar";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import type { ForumCategory, ForumPost, ForumReply } from "@/lib/luzeria/forum.functions";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Cog, Users, Sparkles, Wallet, LayoutGrid, MessageCircle,
};

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function ForumTab() {
  const me = useMe().data;
  const isPlatformAdmin = !!me?.isPlatformAdmin;
  const { data: categories = [] } = useQuery(forumCategoriesQO());
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: posts = [], isLoading } = useQuery(forumPostsQO(categoryId));
  const filtered = search.trim()
    ? posts.filter((p) => p.title.toLowerCase().includes(search.trim().toLowerCase()))
    : posts;
  const pinned = filtered.filter((p) => p.pinned);
  const rest = filtered.filter((p) => !p.pinned);

  const catById = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="grid grid-cols-[200px_1fr] gap-6">
      <aside className="space-y-0.5">
        <CategoryButton
          active={categoryId === null}
          color="#C8D44E"
          name="Todos"
          count={posts.length}
          onClick={() => setCategoryId(null)}
        />
        {categories.map((c) => (
          <CategoryButton
            key={c.id}
            active={categoryId === c.id}
            color={c.color}
            name={c.name}
            icon={c.icon}
            onClick={() => setCategoryId(c.id)}
          />
        ))}
      </aside>

      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-2 flex-1 bg-[#1C1C1C] border border-white/10 rounded-md px-3 py-2 max-w-xs">
            <Search size={13} className="text-white/40 shrink-0" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar no fórum..."
              className="bg-transparent text-xs flex-1 outline-none placeholder:text-white/30 text-white"
            />
          </div>
          <button
            onClick={() => setComposerOpen(true)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-bold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
          >
            <Plus size={13} /> Novo post
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-white/40 text-sm">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-6 bg-white/[0.03] border border-white/10 rounded-2xl">
            <MessageCircle size={22} className="mx-auto text-white/20 mb-2" />
            <p className="text-white/50 text-sm">{search ? "Nenhum post encontrado." : "Nenhum post ainda — seja o primeiro."}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...pinned, ...rest].map((p) => (
              <PostCard key={p.id} post={p} category={catById.get(p.categoryId)} onClick={() => setSelectedPostId(p.id)} />
            ))}
          </div>
        )}
      </div>

      {selectedPostId && (
        <PostDetail
          postId={selectedPostId}
          category={catById.get((posts.find((p) => p.id === selectedPostId) as any)?.categoryId)}
          categories={categories}
          isPlatformAdmin={isPlatformAdmin}
          onClose={() => setSelectedPostId(null)}
        />
      )}

      {composerOpen && (
        <NewPostModal categories={categories} onClose={() => setComposerOpen(false)} onCreated={(id) => { setComposerOpen(false); setSelectedPostId(id); }} />
      )}
    </div>
  );
}

function CategoryButton({ active, color, name, icon, count, onClick }: {
  active: boolean; color: string; name: string; icon?: string; count?: number; onClick: () => void;
}) {
  const Icon = icon ? ICONS[icon] : undefined;
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors relative text-left"
      style={{
        backgroundColor: active ? "rgba(var(--lz-brand-light-rgb),0.12)" : "transparent",
        color: active ? "#FFFFFF" : "rgba(255,255,255,0.7)",
      }}>
      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }} />}
      {Icon ? <Icon size={14} className="shrink-0" /> : <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />}
      <span className="flex-1 truncate">{name}</span>
      {count !== undefined && <span className="text-[10px] text-white/30 font-mono">{count}</span>}
    </button>
  );
}

function PostCard({ post, category, onClick }: { post: ForumPost; category?: ForumCategory; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left bg-[#161616] border border-white/[0.07] rounded-xl p-4 hover:border-white/[0.15] hover:bg-[#1A1A1A] transition-colors">
      <div className="flex items-center gap-2 mb-2">
        {category && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded"
            style={{ backgroundColor: `${category.color}22`, color: category.color }}>
            {post.pinned && <Pin size={9} />} {category.name}
          </span>
        )}
        <span className="ml-auto text-[10.5px] font-mono text-white/30">{relTime(post.createdAt)}</span>
      </div>
      <h3 className="text-[15px] font-semibold text-white mb-1">{post.title}</h3>
      <p className="text-[13px] text-white/60 leading-relaxed mb-2.5" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {post.body}
      </p>
      <div className="flex items-center gap-2">
        <Avatar name={post.authorName} size={20} />
        <span className="text-xs text-white font-medium">{post.authorName}</span>
        <span className="text-xs text-white/30">· {post.orgName}</span>
        <span className="ml-auto text-xs text-white/40 flex items-center gap-1">
          <MessageCircle size={12} /> {post.replyCount}
        </span>
      </div>
    </button>
  );
}

function PostDetail({ postId, category, categories, isPlatformAdmin, onClose }: {
  postId: string; category?: ForumCategory; categories: ForumCategory[]; isPlatformAdmin: boolean; onClose: () => void;
}) {
  const { data, isLoading } = useQuery(forumPostDetailQO(postId));
  const api = useApi();
  const [replyText, setReplyText] = useState("");
  const cat = data ? categories.find((c) => c.id === data.post.categoryId) ?? category : category;

  function sendReply() {
    const body = replyText.trim();
    if (!body) return;
    api.createForumReply.mutate({ data: { postId, body } }, {
      onSuccess: () => setReplyText(""),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao responder"),
    });
  }

  function moderate(action: "pin" | "unpin" | "delete") {
    if (action === "delete") {
      requestConfirm("Apagar este post e todas as respostas?", { danger: true }).then((ok) => {
        if (!ok) return;
        api.moderateForumPost.mutate({ data: { postId, action } }, { onSuccess: onClose });
      });
      return;
    }
    api.moderateForumPost.mutate({ data: { postId, action } });
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed z-50 bg-[#0D0D0D] border-white/10 flex flex-col
          inset-x-0 bottom-0 max-h-[90vh] rounded-t-2xl border-t
          md:rounded-none md:border-t-0 md:border-l md:right-0 md:top-0 md:bottom-0 md:left-auto md:w-[460px] md:max-h-none">
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.08] flex items-start gap-3">
          {cat && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded"
              style={{ backgroundColor: `${cat.color}22`, color: cat.color }}>
              {cat.name}
            </span>
          )}
          {isPlatformAdmin && data && (
            <div className="ml-auto flex items-center gap-1">
              <button onClick={() => moderate(data.post.pinned ? "unpin" : "pin")} title={data.post.pinned ? "Desafixar" : "Fixar"}
                className="p-1.5 rounded text-white/40 hover:text-[rgb(var(--lz-brand-rgb))] hover:bg-white/5">
                <Pin size={14} className={data.post.pinned ? "fill-current" : ""} />
              </button>
              <button onClick={() => moderate("delete")} title="Apagar post"
                className="p-1.5 rounded text-white/40 hover:text-red-400 hover:bg-white/5">
                <Trash2 size={14} />
              </button>
            </div>
          )}
          <button onClick={onClose} className="p-1.5 rounded text-white/40 hover:text-white hover:bg-white/5">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading || !data ? (
            <div className="text-center py-10 text-white/40 text-sm">Carregando…</div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-white leading-tight mb-3">{data.post.title}</h2>
              <div className="flex items-center gap-2.5 mb-4">
                <Avatar name={data.post.authorName} size={30} />
                <div>
                  <div className="text-sm font-semibold text-white">{data.post.authorName}</div>
                  <div className="text-[11.5px] text-white/40">{data.post.orgName} · {relTime(data.post.createdAt)}</div>
                </div>
              </div>
              <p className="text-[13.5px] text-white/70 leading-relaxed whitespace-pre-line">{data.post.body}</p>
              {data.post.linkUrl && (
                <a href={data.post.linkUrl} target="_blank" rel="noreferrer"
                  className="mt-3 flex items-center gap-2 bg-[#161616] border border-white/10 rounded-md px-3 py-2 text-xs text-[rgb(var(--lz-brand-rgb))] hover:underline">
                  <ExternalLink size={13} /> {data.post.linkUrl}
                </a>
              )}

              <div className="text-[10.5px] font-bold uppercase tracking-wide text-white/30 mt-6 mb-2">
                {data.replies.length} resposta{data.replies.length === 1 ? "" : "s"}
              </div>
              {data.replies.map((r: ForumReply) => (
                <div key={r.id} className="flex gap-2.5 py-2.5 border-t border-white/[0.06]">
                  <Avatar name={r.authorName} size={22} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-semibold text-white">{r.authorName}</span>
                      <span className="text-[10.5px] text-white/30">{r.orgName}</span>
                      <span className="ml-auto text-[10px] font-mono text-white/30">{relTime(r.createdAt)}</span>
                      {isPlatformAdmin && (
                        <button onClick={() => api.moderateForumReply.mutate({ data: { replyId: r.id } })}
                          className="p-0.5 rounded text-white/30 hover:text-red-400"><Trash2 size={11} /></button>
                      )}
                    </div>
                    <p className="text-[12.5px] text-white/70 leading-relaxed mt-0.5">{r.body}</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="border-t border-white/[0.08] px-5 py-3 flex gap-2 items-end">
          <textarea
            value={replyText} onChange={(e) => setReplyText(e.target.value)}
            placeholder="Escreva uma resposta..."
            rows={1}
            className="flex-1 resize-none bg-[#1C1C1C] border border-white/10 rounded-md px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
          />
          <button onClick={sendReply} disabled={!replyText.trim() || api.createForumReply.isPending}
            className="shrink-0 h-[34px] w-[34px] inline-flex items-center justify-center rounded-md disabled:opacity-40"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
            <Send size={14} />
          </button>
        </div>
      </div>
    </>
  );
}

function NewPostModal({ categories, onClose, onCreated }: {
  categories: ForumCategory[]; onClose: () => void; onCreated: (postId: string) => void;
}) {
  const api = useApi();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  function submit() {
    if (!categoryId || !title.trim() || !body.trim()) {
      toast.error("Preenche categoria, título e o texto do post.");
      return;
    }
    api.createForumPost.mutate({ data: { categoryId, title: title.trim(), body: body.trim(), linkUrl: linkUrl.trim() || null } }, {
      onSuccess: (r) => { toast.success("Post publicado!"); onCreated(r.id); },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao publicar"),
    });
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#161616] border border-white/10 rounded-xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Novo post</h3>
          <button onClick={onClose} className="p-1 rounded text-white/40 hover:text-white hover:bg-white/5"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div className="relative">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              className="w-full appearance-none bg-[#1C1C1C] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título"
            maxLength={200}
            className="w-full bg-[#1C1C1C] border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escreva sua dúvida, ideia ou case..."
            rows={5} maxLength={8000}
            className="w-full resize-none bg-[#1C1C1C] border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="Link (opcional)"
            className="w-full bg-[#1C1C1C] border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
        </div>
        <button onClick={submit} disabled={api.createForumPost.isPending}
          className="w-full mt-4 rounded-md py-2.5 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
          {api.createForumPost.isPending ? "Publicando…" : "Publicar"}
        </button>
      </div>
    </div>
  );
}
