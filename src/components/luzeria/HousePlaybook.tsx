// House (Fase 3) — Playbook da função: menu lateral por seções, páginas com
// texto formatado, exemplos e mini checklist, "marcar como lida", edição
// pelo gestor e progresso de leitura da equipe. Com scope="modelo", a
// Luzeria edita o playbook modelo que é copiado pra cada House nova.
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowDown, ArrowLeft, ArrowUp, BarChart3, BookOpen, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight,
  Clapperboard, Eye, Heading2, ImagePlus, Layers, Lightbulb, Link2, List, ListOrdered, Loader2, Megaphone,
  MessageCircle, PartyPopper, Pencil, Plus, Radio, Smartphone, Sparkles, Trash2, Users, X, Bold,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { requestConfirm, requestPrompt } from "@/lib/luzeria/confirm-store";
import { useMe, contentStatusesQO } from "@/lib/luzeria/queries";
import { CUSTOMIZABLE_BUILTIN_STATUS_KEYS, statusLabel } from "@/lib/luzeria/types";
import {
  getPlaybook, savePlaybookSection, deletePlaybookSection, savePlaybookPage, deletePlaybookPage,
  movePlaybookItem, setPlaybookRead, getPlaybookProgress,
  type PlaybookPage, type PlaybookSection,
} from "@/lib/luzeria/playbook.functions";
import { PlaybookMarkdown } from "./PlaybookMarkdown";
import { Avatar } from "./Avatar";

type Scope = "org" | "modelo";

const ICONS: Record<string, typeof BookOpen> = {
  BookOpen, Layers, CalendarDays, Smartphone, Clapperboard, MessageCircle, Megaphone, PartyPopper, Radio, BarChart3, Users, Lightbulb, Sparkles,
};
const ICON_CHOICES = Object.keys(ICONS);

function SectionIcon({ name, size = 15 }: { name: string; size?: number }) {
  const I = ICONS[name] ?? BookOpen;
  return <I size={size} />;
}

export function HousePlaybook({ scope, pageId, onSelectPage }: {
  scope: Scope; pageId?: string; onSelectPage: (id: string | undefined) => void;
}) {
  const me = useMe().data;
  const qc = useQueryClient();
  const fetchPlaybook = useServerFn(getPlaybook);
  const queryKey = ["playbook", scope];
  const { data, isLoading, error } = useQuery({ queryKey, queryFn: () => fetchPlaybook({ data: { scope } }) });
  const canEdit = scope === "modelo" || me?.role === "master";
  const [tab, setTab] = useState<"conteudo" | "progresso">("conteudo");
  const [editing, setEditing] = useState<PlaybookPage | { sectionId: string } | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey });

  const sections = data?.sections ?? [];
  const allPages = useMemo(() => sections.flatMap((s) => s.pages), [sections]);
  const reads = data?.reads ?? {};
  const current = allPages.find((p) => p.id === pageId) ?? null;
  const readCount = allPages.filter((p) => reads[p.id]?.readAt).length;

  // Sem página na URL, no computador abre direto a primeira (no celular
  // mostra a lista de seções primeiro).
  useEffect(() => {
    if (!pageId && allPages.length && typeof window !== "undefined" && window.innerWidth >= 1024) onSelectPage(allPages[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, allPages.length]);

  if (isLoading) return <div className="px-6 py-10 text-sm text-foreground/40">Carregando o playbook…</div>;
  if (error) return <div className="px-6 py-10 text-sm" style={{ color: "#E76F51" }}>{(error as any).message ?? "Não consegui carregar o playbook."}</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8 pb-28">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <div className="text-[11px] uppercase font-bold tracking-wider text-foreground/40">
            {scope === "modelo" ? "Luzeria · modelo copiado pra cada House nova" : "Manual da função"}
          </div>
          <h1 className="text-[28px] md:text-[32px] font-bold text-foreground tracking-tight mt-0.5">
            {scope === "modelo" ? "Playbook modelo" : "Playbook"}
          </h1>
        </div>
        {scope === "org" && me?.role === "master" && (
          <div className="inline-flex items-center gap-1 bg-card rounded-full p-1 border border-foreground/[0.06]">
            {(["conteudo", "progresso"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${tab === t ? "bg-[rgb(var(--lz-brand-rgb))] text-black" : "text-foreground/55 hover:text-foreground"}`}>
                {t === "conteudo" ? "Conteúdo" : "Progresso da equipe"}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "progresso" ? (
        <ProgressPanel sections={sections} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[290px_minmax(0,1fr)] gap-6 items-start">
          <aside className={`min-w-0 ${current || editing ? "hidden lg:block" : ""} lg:sticky lg:top-4`}>
            {scope === "org" && allPages.length > 0 && (
              <div className="bg-card rounded-2xl p-4 border border-foreground/[0.06] mb-3">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-foreground/70">Seu progresso</span>
                  <span className="tabular-nums text-foreground/50">{readCount} de {allPages.length} páginas</span>
                </div>
                <div className="h-2 rounded-full bg-foreground/[0.08] overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((readCount / allPages.length) * 100)}%`, background: "rgb(var(--lz-brand-rgb))" }} />
                </div>
              </div>
            )}
            <SectionNav sections={sections} reads={reads} currentId={current?.id} scope={scope} canEdit={canEdit}
              onSelect={(id) => { setEditing(null); onSelectPage(id); }}
              onAddPage={(sectionId) => setEditing({ sectionId })}
              onChanged={invalidate} />
          </aside>

          <main className={`min-w-0 ${current || editing ? "" : "hidden lg:block"}`}>
            {editing ? (
              <PageEditor scope={scope} sections={sections} initial={editing}
                onCancel={() => setEditing(null)}
                onSaved={(id) => { setEditing(null); invalidate(); onSelectPage(id); }}
                onDeleted={() => { setEditing(null); invalidate(); onSelectPage(undefined); }} />
            ) : current ? (
              <PageView page={current} section={sections.find((s) => s.id === current.sectionId)!} allPages={allPages}
                read={reads[current.id]} scope={scope} canEdit={canEdit}
                onEdit={() => setEditing(current)} onSelect={onSelectPage} onBack={() => onSelectPage(undefined)}
                onReadChanged={invalidate} />
            ) : (
              <div className="bg-card rounded-2xl p-10 text-center text-sm text-foreground/45 border border-foreground/[0.06]">
                {allPages.length === 0 ? "O playbook ainda está vazio." : "Escolha uma página ao lado."}
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

/* ============== Menu lateral ============== */

function SectionNav({ sections, reads, currentId, scope, canEdit, onSelect, onAddPage, onChanged }: {
  sections: PlaybookSection[]; reads: Record<string, { readAt: string | null }>; currentId?: string; scope: Scope; canEdit: boolean;
  onSelect: (id: string) => void; onAddPage: (sectionId: string) => void; onChanged: () => void;
}) {
  const saveSection = useServerFn(savePlaybookSection);
  const removeSection = useServerFn(deletePlaybookSection);
  const move = useServerFn(movePlaybookItem);
  const [open, setOpen] = useState<Set<string>>(() => new Set(sections.map((s) => s.id)));
  const run = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: onChanged,
    onError: (e: any) => toastFriendlyError(e, "Não consegui salvar"),
  });

  async function addSection() {
    const title = await requestPrompt("Nome da nova seção:");
    if (title?.trim()) run.mutate(() => saveSection({ data: { scope, title: title.trim() } }));
  }
  async function renameSection(s: PlaybookSection) {
    const title = await requestPrompt("Novo nome da seção:", s.title);
    if (title?.trim()) run.mutate(() => saveSection({ data: { scope, id: s.id, title: title.trim() } }));
  }
  async function changeIcon(s: PlaybookSection) {
    const idx = ICON_CHOICES.indexOf(s.icon);
    const next = ICON_CHOICES[(idx + 1) % ICON_CHOICES.length];
    run.mutate(() => saveSection({ data: { scope, id: s.id, title: s.title, icon: next } }));
  }
  async function removeSec(s: PlaybookSection) {
    if (await requestConfirm(`Apagar a seção "${s.title}" e as ${s.pages.length} página(s) dela?`, { danger: true })) {
      run.mutate(() => removeSection({ data: { scope, id: s.id } }));
    }
  }

  return (
    <nav className="bg-card rounded-2xl p-2 border border-foreground/[0.06]">
      {sections.map((s, si) => {
        const readInSec = s.pages.filter((p) => reads[p.id]?.readAt).length;
        const isOpen = open.has(s.id);
        const done = scope === "org" && s.pages.length > 0 && readInSec === s.pages.length;
        return (
          <div key={s.id} className="group/sec">
            <div className="flex items-center gap-1">
              <button onClick={() => setOpen((prev) => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })}
                className="flex-1 flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-left hover:bg-foreground/[0.04] transition min-w-0">
                <span className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: done ? "rgb(var(--lz-brand-rgb))" : "rgba(var(--lz-brand-rgb),0.12)", color: done ? "#0D0D0D" : "var(--lz-accent-ink)" }}>
                  {done ? <Check size={14} strokeWidth={3} /> : <SectionIcon name={s.icon} size={14} />}
                </span>
                <span className="flex-1 min-w-0 text-sm font-semibold text-foreground truncate">{s.title}</span>
                {scope === "org" && s.pages.length > 0 && <span className="text-[10px] tabular-nums text-foreground/40">{readInSec}/{s.pages.length}</span>}
              </button>
              {canEdit && (
                <div className="hidden group-hover/sec:flex items-center shrink-0">
                  <MiniBtn title="Trocar ícone" onClick={() => changeIcon(s)}><SectionIcon name={s.icon} size={12} /></MiniBtn>
                  <MiniBtn title="Renomear" onClick={() => renameSection(s)}><Pencil size={12} /></MiniBtn>
                  {si > 0 && <MiniBtn title="Subir" onClick={() => run.mutate(() => move({ data: { scope, kind: "section", id: s.id, dir: "up" } }))}><ArrowUp size={12} /></MiniBtn>}
                  {si < sections.length - 1 && <MiniBtn title="Descer" onClick={() => run.mutate(() => move({ data: { scope, kind: "section", id: s.id, dir: "down" } }))}><ArrowDown size={12} /></MiniBtn>}
                  <MiniBtn title="Apagar seção" danger onClick={() => removeSec(s)}><Trash2 size={12} /></MiniBtn>
                </div>
              )}
            </div>
            {isOpen && (
              <ul className="ml-[22px] pl-3 border-l border-foreground/10 mb-1.5">
                {s.pages.map((p) => {
                  const active = p.id === currentId;
                  const read = !!reads[p.id]?.readAt;
                  return (
                    <li key={p.id}>
                      <button onClick={() => onSelect(p.id)}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-[13px] transition"
                        style={{ backgroundColor: active ? "rgba(var(--lz-brand-rgb),0.12)" : undefined, color: active ? "var(--foreground)" : "color-mix(in srgb, var(--foreground) 65%, transparent)" }}>
                        <span className="flex-1 min-w-0 truncate">{p.title}</span>
                        {scope === "org" && read && <CheckCircle2 size={13} className="shrink-0" style={{ color: "var(--lz-accent-ink)" }} />}
                      </button>
                    </li>
                  );
                })}
                {canEdit && (
                  <li>
                    <button onClick={() => onAddPage(s.id)} className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-foreground/40 hover:text-foreground">
                      <Plus size={12} /> Nova página
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        );
      })}
      {canEdit && (
        <button onClick={addSection} className="w-full flex items-center gap-2 px-3 py-2.5 mt-1 rounded-lg text-sm font-semibold text-foreground/50 hover:text-foreground hover:bg-foreground/[0.04]">
          <Plus size={14} /> Nova seção
        </button>
      )}
    </nav>
  );
}

function MiniBtn({ title, onClick, children, danger }: { title: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button title={title} onClick={onClick}
      className={`p-1.5 rounded text-foreground/40 transition ${danger ? "hover:text-red-400 hover:bg-red-500/10" : "hover:text-foreground hover:bg-foreground/5"}`}>
      {children}
    </button>
  );
}

/* ============== Leitura ============== */

function PageView({ page, section, allPages, read, scope, canEdit, onEdit, onSelect, onBack, onReadChanged }: {
  page: PlaybookPage; section: PlaybookSection; allPages: PlaybookPage[]; read?: { readAt: string | null; checked: number[] };
  scope: Scope; canEdit: boolean; onEdit: () => void; onSelect: (id: string) => void; onBack: () => void; onReadChanged: () => void;
}) {
  const qc = useQueryClient();
  const setRead = useServerFn(setPlaybookRead);
  const idx = allPages.findIndex((p) => p.id === page.id);
  const prev = allPages[idx - 1];
  const next = allPages[idx + 1];
  const checked = new Set(read?.checked ?? []);
  const isRead = !!read?.readAt;
  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => { topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }, [page.id]);

  const save = useMutation({
    mutationFn: (v: { read?: boolean; checked?: number[] }) => setRead({ data: { pageId: page.id, ...v } }),
    onMutate: async (v) => {
      const key = ["playbook", scope];
      await qc.cancelQueries({ queryKey: key });
      const prevData = qc.getQueryData<any>(key);
      if (prevData) {
        const cur = prevData.reads[page.id] ?? { readAt: null, checked: [] };
        qc.setQueryData(key, { ...prevData, reads: { ...prevData.reads, [page.id]: {
          readAt: v.read === undefined ? cur.readAt : v.read ? (cur.readAt ?? new Date().toISOString()) : null,
          checked: v.checked ?? cur.checked,
        } } });
      }
      return { prevData };
    },
    onError: (e: any, _v, ctx) => { if (ctx?.prevData) qc.setQueryData(["playbook", scope], ctx.prevData); toastFriendlyError(e, "Não consegui salvar"); },
    onSettled: onReadChanged,
  });

  function toggleCheck(i: number) {
    const n = new Set(checked);
    n.has(i) ? n.delete(i) : n.add(i);
    save.mutate({ checked: [...n].sort((a, b) => a - b) });
  }

  return (
    <article ref={topRef} className="bg-card rounded-2xl border border-foreground/[0.06] overflow-hidden scroll-mt-4">
      <div className="px-5 sm:px-8 pt-6 sm:pt-8 pb-6 border-b border-foreground/[0.06]"
        style={{ background: "linear-gradient(135deg, rgba(var(--lz-brand-rgb),0.08), transparent 60%)" }}>
        <button onClick={onBack} className="lg:hidden inline-flex items-center gap-1 text-xs text-foreground/50 mb-3"><ArrowLeft size={13} /> Seções</button>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] uppercase font-bold tracking-wider" style={{ color: "var(--lz-accent-ink)" }}>
              <SectionIcon name={section.icon} size={12} /> {section.title}
            </div>
            <h2 className="text-2xl sm:text-[28px] font-bold text-foreground tracking-tight leading-tight mt-1.5">{page.title}</h2>
            {page.summary && <p className="text-[15px] text-foreground/55 mt-2">{page.summary}</p>}
          </div>
          {canEdit && (
            <button onClick={onEdit} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold border border-foreground/15 text-foreground/75 hover:text-foreground hover:bg-foreground/5">
              <Pencil size={13} /> Editar
            </button>
          )}
        </div>
      </div>

      <div className="px-5 sm:px-8 py-7 max-w-3xl">
        <PlaybookMarkdown content={page.content} />

        {page.checklist.length > 0 && (
          <div className="mt-8 rounded-2xl p-5" style={{ background: "color-mix(in srgb, var(--foreground) 3.5%, transparent)", border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)" }}>
            <div className="text-xs uppercase font-bold tracking-wider text-foreground/55 mb-3">Checklist</div>
            <ul className="space-y-1">
              {page.checklist.map((c, i) => {
                const on = checked.has(i);
                return (
                  <li key={i}>
                    <button disabled={scope !== "org"} onClick={() => toggleCheck(i)}
                      className="w-full flex items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-foreground/[0.04] disabled:hover:bg-transparent">
                      <span className="mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors"
                        style={on ? { backgroundColor: "rgb(var(--lz-brand-rgb))", borderColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" } : { borderColor: "color-mix(in srgb, var(--foreground) 25%, transparent)" }}>
                        {on && <Check size={13} strokeWidth={3} />}
                      </span>
                      <span className={`text-[14.5px] ${on ? "text-foreground/45 line-through" : "text-foreground/85"}`}>{c}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {scope === "org" && (
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button onClick={() => save.mutate({ read: !isRead })}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-md text-sm font-bold transition"
              style={isRead
                ? { backgroundColor: "rgba(var(--lz-brand-rgb),0.12)", color: "var(--lz-accent-ink)" }
                : { backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
              <CheckCircle2 size={16} /> {isRead ? "Lida" : "Marcar como lida"}
            </button>
            {isRead && read?.readAt && <span className="text-xs text-foreground/40">em {new Date(read.readAt).toLocaleDateString("pt-BR")}</span>}
          </div>
        )}
      </div>

      <div className="px-5 sm:px-8 py-4 border-t border-foreground/[0.06] flex items-center justify-between gap-3">
        {prev ? (
          <button onClick={() => onSelect(prev.id)} className="inline-flex items-center gap-1.5 text-sm text-foreground/60 hover:text-foreground min-w-0">
            <ChevronLeft size={15} className="shrink-0" /><span className="truncate">{prev.title}</span>
          </button>
        ) : <span />}
        {next && (
          <button onClick={() => onSelect(next.id)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:opacity-80 min-w-0">
            <span className="truncate">{next.title}</span><ChevronRight size={15} className="shrink-0" />
          </button>
        )}
      </div>
    </article>
  );
}

/* ============== Edição (gestor / Luzeria) ============== */

function PageEditor({ scope, sections, initial, onCancel, onSaved, onDeleted }: {
  scope: Scope; sections: PlaybookSection[]; initial: PlaybookPage | { sectionId: string };
  onCancel: () => void; onSaved: (id: string) => void; onDeleted: () => void;
}) {
  const me = useMe().data;
  const existing = "id" in initial ? initial : null;
  const saveFn = useServerFn(savePlaybookPage);
  const deleteFn = useServerFn(deletePlaybookPage);
  const moveFn = useServerFn(movePlaybookItem);
  const { data: contentStatuses = [] } = useQuery(contentStatusesQO());
  const labelOverrides = new Map(contentStatuses.map((r) => [r.key, r.label]));
  const [sectionId, setSectionId] = useState(initial.sectionId);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [summary, setSummary] = useState(existing?.summary ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [checklist, setChecklist] = useState<string[]>(existing?.checklist ?? []);
  const [stepKeys, setStepKeys] = useState<string[]>(existing?.stepKeys ?? []);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = useMutation({
    mutationFn: () => saveFn({ data: {
      scope, id: existing?.id, sectionId, title: title.trim(), summary: summary.trim() || null, content,
      checklist: checklist.map((c) => c.trim()).filter(Boolean), stepKeys,
    } }),
    onSuccess: (r) => { toast.success("Página salva."); onSaved(r.id); },
    onError: (e: any) => toastFriendlyError(e, "Não consegui salvar a página"),
  });
  const remove = useMutation({
    mutationFn: () => deleteFn({ data: { scope, id: existing!.id } }),
    onSuccess: onDeleted,
    onError: (e: any) => toastFriendlyError(e, "Não consegui apagar"),
  });
  const move = useMutation({
    mutationFn: (dir: "up" | "down") => moveFn({ data: { scope, kind: "page", id: existing!.id, dir } }),
    onSuccess: () => { toast.success("Ordem atualizada."); onSaved(existing!.id); },
    onError: (e: any) => toastFriendlyError(e, "Não consegui mover"),
  });

  /** Envolve a seleção (ou insere no cursor) — mantém o foco no texto. */
  function insert(before: string, after = "", placeholder = "") {
    const el = ta.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = content.slice(s, e) || placeholder;
    const next = content.slice(0, s) + before + sel + after + content.slice(e);
    setContent(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + sel.length); });
  }
  function insertLine(prefix: string, placeholder: string) {
    const el = ta.current;
    const s = el?.selectionStart ?? content.length;
    const atLineStart = s === 0 || content[s - 1] === "\n";
    insert(`${atLineStart ? "" : "\n"}${prefix}`, "", placeholder);
  }

  async function uploadImage(file: File) {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) { toast.error("Use PNG, JPG, WEBP ou GIF."); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Imagem maior que 8 MB."); return; }
    setUploading(true);
    try {
      const folder = scope === "modelo" ? "modelo" : me!.orgId!;
      const ext = file.type.split("/")[1].replace("jpeg", "jpg");
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("playbook-assets").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
      if (error) throw error;
      const url = supabase.storage.from("playbook-assets").getPublicUrl(path).data.publicUrl;
      insertLine(`![`, `Descrição da imagem](${url})\n`);
    } catch (e: any) {
      toastFriendlyError(e, "Não consegui subir a imagem");
    } finally {
      setUploading(false);
    }
  }

  const siblings = existing ? sections.find((s) => s.id === existing.sectionId)?.pages ?? [] : [];
  const pos = existing ? siblings.findIndex((p) => p.id === existing.id) : -1;

  return (
    <div className="bg-card rounded-2xl border border-foreground/[0.06] p-5 sm:p-7 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">{existing ? "Editar página" : "Nova página"}</h2>
        <button onClick={onCancel} className="p-1.5 rounded text-foreground/50 hover:text-foreground"><X size={18} /></button>
      </div>

      <div className="grid sm:grid-cols-[1fr_220px] gap-3">
        <Field label="Título">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} className="lz-input w-full" placeholder="ex: Rotina diária de stories" />
        </Field>
        <Field label="Seção">
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="lz-input w-full">
            {sections.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Resumo (uma linha, opcional)">
        <input value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={300} className="lz-input w-full" placeholder="Aparece embaixo do título" />
      </Field>

      <div>
        <div className="flex flex-wrap items-center gap-1 mb-2">
          <ToolBtn title="Subtítulo" onClick={() => insertLine("## ", "Subtítulo")}><Heading2 size={14} /></ToolBtn>
          <ToolBtn title="Negrito" onClick={() => insert("**", "**", "texto")}><Bold size={14} /></ToolBtn>
          <ToolBtn title="Lista" onClick={() => insertLine("- ", "item")}><List size={14} /></ToolBtn>
          <ToolBtn title="Lista numerada" onClick={() => insertLine("1. ", "passo")}><ListOrdered size={14} /></ToolBtn>
          <ToolBtn title="Dica" onClick={() => insertLine("> **Dica:** ", "escreva a dica")}><Lightbulb size={14} /></ToolBtn>
          <ToolBtn title="Exemplo" onClick={() => insertLine("> **Exemplo:** ", "escreva o exemplo")}><Sparkles size={14} /></ToolBtn>
          <ToolBtn title="Link" onClick={() => insert("[", "](https://)", "texto do link")}><Link2 size={14} /></ToolBtn>
          <ToolBtn title="Imagem" onClick={() => fileRef.current?.click()}>{uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}</ToolBtn>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadImage(f); }} />
          <span className="flex-1" />
          <button onClick={() => setPreview((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${preview ? "bg-[rgb(var(--lz-brand-rgb))] text-black" : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"}`}>
            <Eye size={13} /> {preview ? "Voltar a editar" : "Ver como fica"}
          </button>
        </div>
        {preview ? (
          <div className="rounded-xl border border-foreground/10 px-5 py-5 min-h-[320px]"><PlaybookMarkdown content={content} /></div>
        ) : (
          <textarea ref={ta} value={content} onChange={(e) => setContent(e.target.value)} rows={18}
            className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[14px] leading-relaxed text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] font-mono resize-y"
            placeholder={"Escreva o conteúdo da página.\n\n## Subtítulo\n- item de lista\n> **Dica:** um destaque"} />
        )}
      </div>

      <Field label="Mini checklist no fim da página">
        <div className="space-y-2">
          {checklist.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="h-4 w-4 rounded border border-foreground/25 shrink-0" />
              <input value={c} onChange={(e) => setChecklist((l) => l.map((x, j) => (j === i ? e.target.value : x)))}
                className="lz-input flex-1" maxLength={300} />
              <button onClick={() => setChecklist((l) => l.filter((_, j) => j !== i))} className="p-1.5 rounded text-foreground/40 hover:text-red-400"><X size={14} /></button>
            </div>
          ))}
          <button onClick={() => setChecklist((l) => [...l, ""])} className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/55 hover:text-foreground">
            <Plus size={12} /> Adicionar item
          </button>
        </div>
      </Field>

      <Field label="Link “Como fazer” no fluxo de produção">
        <p className="text-[11px] text-foreground/45 mb-2">Nas etapas marcadas, o item do fluxo mostra um atalho pra esta página.</p>
        <div className="flex flex-wrap gap-1.5">
          {CUSTOMIZABLE_BUILTIN_STATUS_KEYS.map((k) => {
            const on = stepKeys.includes(k);
            return (
              <button key={k} onClick={() => setStepKeys((l) => (on ? l.filter((x) => x !== k) : [...l, k]))}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors"
                style={on
                  ? { backgroundColor: "rgb(var(--lz-brand-rgb))", borderColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }
                  : { borderColor: "color-mix(in srgb, var(--foreground) 15%, transparent)", color: "color-mix(in srgb, var(--foreground) 65%, transparent)" }}>
                {statusLabel(k, false, labelOverrides)}
              </button>
            );
          })}
        </div>
      </Field>

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-foreground/[0.06]">
        <button onClick={() => save.mutate()} disabled={!title.trim() || save.isPending}
          className="px-5 py-2.5 rounded-md text-sm font-bold disabled:opacity-40"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
          {save.isPending ? "Salvando…" : "Salvar página"}
        </button>
        <button onClick={onCancel} className="px-4 py-2.5 text-sm text-foreground/60 hover:text-foreground">Cancelar</button>
        <span className="flex-1" />
        {existing && pos > 0 && <ToolBtn title="Subir na seção" onClick={() => move.mutate("up")}><ArrowUp size={14} /></ToolBtn>}
        {existing && pos >= 0 && pos < siblings.length - 1 && <ToolBtn title="Descer na seção" onClick={() => move.mutate("down")}><ArrowDown size={14} /></ToolBtn>}
        {existing && (
          <button onClick={async () => { if (await requestConfirm(`Apagar a página "${existing.title}"?`, { danger: true })) remove.mutate(); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold text-red-400 hover:bg-red-500/10">
            <Trash2 size={13} /> Apagar
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase font-bold tracking-wider text-foreground/45 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ToolBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className="h-8 w-8 inline-flex items-center justify-center rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/[0.06] transition">
      {children}
    </button>
  );
}

/* ============== Progresso da equipe (gestor) ============== */

function ProgressPanel({ sections }: { sections: PlaybookSection[] }) {
  const fetchProgress = useServerFn(getPlaybookProgress);
  const { data, isLoading } = useQuery({ queryKey: ["playbook-progress"], queryFn: () => fetchProgress() });
  const navigate = useNavigate();
  if (isLoading || !data) return <div className="text-sm text-foreground/40">Carregando…</div>;
  return (
    <div className="space-y-3 max-w-4xl">
      {data.people.map((p) => {
        const pct = data.total ? Math.round((p.read / data.total) * 100) : 0;
        const readSet = new Set(p.readPageIds);
        return (
          <div key={p.id} className="bg-card rounded-2xl p-5 border border-foreground/[0.06]">
            <div className="flex items-center gap-3">
              <Avatar name={p.name} color={p.color} size={34} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">{p.name}</div>
                <div className="text-[11px] text-foreground/45">
                  {p.read} de {data.total} páginas lidas{p.lastReadAt ? ` · última leitura em ${new Date(p.lastReadAt).toLocaleDateString("pt-BR")}` : ""}
                </div>
              </div>
              <span className="text-lg font-extrabold tabular-nums" style={{ color: pct === 100 ? "var(--lz-accent-ink)" : "var(--foreground)" }}>{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-foreground/[0.08] overflow-hidden mt-3">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "rgb(var(--lz-brand-rgb))" }} />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {sections.map((s) => {
                const n = s.pages.filter((pg) => readSet.has(pg.id)).length;
                const full = s.pages.length > 0 && n === s.pages.length;
                return (
                  <span key={s.id} className="inline-flex items-center gap-1 text-[10.5px] px-2 py-1 rounded-full"
                    style={{ backgroundColor: full ? "rgba(var(--lz-brand-rgb),0.14)" : "color-mix(in srgb, var(--foreground) 5%, transparent)", color: full ? "var(--lz-accent-ink)" : "color-mix(in srgb, var(--foreground) 55%, transparent)" }}>
                    <SectionIcon name={s.icon} size={10} /> {s.title} {n}/{s.pages.length}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
      <button onClick={() => navigate({ to: "/configuracoes", search: { tab: "team" } })} className="text-xs text-foreground/45 hover:text-foreground">
        Gerenciar equipe →
      </button>
    </div>
  );
}
