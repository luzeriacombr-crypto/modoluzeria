import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, X, Wand2,
  Copy, ImagePlus, Loader2, ArrowLeft,
} from "lucide-react";
import { blogPostsAdminQO, blogPostAdminQO, useApi } from "@/lib/luzeria/queries";
import { useMarketingAssetUpload } from "@/lib/luzeria/use-marketing-asset-upload";
import { buildAiFormattingPrompt, parseAiFormattedText } from "@/lib/luzeria/blog-ai-format";
import type { BlogBlock } from "@/lib/luzeria/blog-posts";

const BLOCK_TYPE_LABEL: Record<BlogBlock["type"], string> = {
  lead: "Abertura (destaque)",
  p: "Parágrafo",
  h2: "Título de seção",
  h3: "Subtítulo",
  quote: "Fala/citação",
  callout: "Caixa de destaque",
  list: "Lista simples",
  rankedList: "Lista numerada",
};

const FEATURE_PAGES = [
  { href: "/selecao-de-fotos-para-fotografos", label: "Seleção de Fotos pra Fotógrafos" },
  { href: "/aprovacao-de-conteudo-por-link", label: "Aprovação de Conteúdo por Link" },
  { href: "/backup-automatico-drive", label: "Backup Automático no Drive" },
  { href: "/publicacao-automatica-instagram", label: "Publicação Automática no Instagram" },
  { href: "/biblioteca-de-referencias", label: "Biblioteca de Referências" },
  { href: "/revenda", label: "Revenda white label" },
  { href: "/", label: "Home (Conhecer o Modo Criador)" },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function BlogAdminTab() {
  const [editingId, setEditingId] = useState<string | null | "new">(null);
  if (editingId !== null) {
    return <BlogPostEditor id={editingId === "new" ? null : editingId} onClose={() => setEditingId(null)} />;
  }
  return <BlogPostList onEdit={setEditingId} />;
}

function BlogPostList({ onEdit }: { onEdit: (id: string | "new") => void }) {
  const { data: posts, isLoading } = useQuery(blogPostsAdminQO());
  const api = useApi();

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Apagar o artigo "${title}"? Isso não pode ser desfeito.`)) return;
    try {
      await api.deleteBlogPost.mutateAsync({ data: { id } });
      toast.success("Artigo apagado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao apagar.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-foreground/60 max-w-lg">
          Escreva, edite e organize os artigos do blog (modocriador.com.br/blog) — capa, título, corpo do texto e status de publicação.
        </p>
        <button
          onClick={() => onEdit("new")}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wide shrink-0"
          style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          <Plus size={14} /> Novo artigo
        </button>
      </div>

      {isLoading && <div className="text-sm text-foreground/40 py-8 text-center">Carregando…</div>}

      <div className="space-y-2">
        {(posts ?? []).map((post) => (
          <div key={post.id} className="flex items-center gap-4 rounded-lg border border-foreground/10 bg-card p-4">
            {post.coverImageUrl ? (
              <img src={post.coverImageUrl} alt="" className="w-16 h-16 rounded-md object-cover shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-md bg-foreground/5 shrink-0 flex items-center justify-center text-foreground/20">
                <ImagePlus size={20} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{
                    background: post.published ? "rgba(34,197,94,0.14)" : "rgba(148,163,184,0.14)",
                    color: post.published ? "rgb(34,197,94)" : "rgb(148,163,184)",
                  }}
                >
                  {post.published ? <Eye size={10} /> : <EyeOff size={10} />}
                  {post.published ? "Publicado" : "Rascunho"}
                </span>
                <span className="text-[11px] text-foreground/40">{post.date} · /blog/{post.slug}</span>
              </div>
              <div className="font-semibold text-sm truncate">{post.title}</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => onEdit(post.id)} className="p-2 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5" title="Editar">
                <Pencil size={15} />
              </button>
              <button onClick={() => handleDelete(post.id, post.title)} className="p-2 rounded-md text-foreground/40 hover:text-red-400 hover:bg-red-500/5" title="Apagar">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {!isLoading && (posts ?? []).length === 0 && (
          <div className="text-center py-12 text-sm text-foreground/40">Nenhum artigo ainda — clica em "Novo artigo" pra começar.</div>
        )}
      </div>
    </div>
  );
}

function emptyBlock(type: BlogBlock["type"]): BlogBlock {
  if (type === "callout") return { type, title: "", text: "" };
  if (type === "list") return { type, items: [""] };
  if (type === "rankedList") return { type, items: [{ title: "", text: "" }] };
  return { type, text: "" } as BlogBlock;
}

function BlogPostEditor({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: existing, isLoading } = useQuery(blogPostAdminQO(id));
  const api = useApi();
  const { upload, uploading } = useMarketingAssetUpload();

  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [readingMinutes, setReadingMinutes] = useState(4);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverImageAlt, setCoverImageAlt] = useState("");
  const [relatedFeatureHref, setRelatedFeatureHref] = useState<string>("");
  const [published, setPublished] = useState(true);
  const [body, setBody] = useState<BlogBlock[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiRawText, setAiRawText] = useState("");
  const [aiInstructions, setAiInstructions] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");

  useEffect(() => {
    if (!existing) return;
    setSlug(existing.slug);
    setSlugTouched(true);
    setTitle(existing.title);
    setDescription(existing.description);
    setDate(existing.date);
    setReadingMinutes(existing.readingMinutes);
    setCoverImageUrl(existing.coverImageUrl);
    setCoverImageAlt(existing.coverImageAlt);
    setRelatedFeatureHref(existing.relatedFeatureHref ?? "");
    setPublished(existing.published);
    setBody(existing.body);
  }, [existing]);

  function handleTitleChange(v: string) {
    setTitle(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await upload(file);
      if (url) setCoverImageUrl(url);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao enviar imagem.");
    }
  }

  function updateBlock(index: number, next: BlogBlock) {
    setBody((b) => b.map((blk, i) => (i === index ? next : blk)));
  }
  function removeBlock(index: number) {
    setBody((b) => b.filter((_, i) => i !== index));
  }
  function moveBlock(index: number, dir: -1 | 1) {
    setBody((b) => {
      const next = [...b];
      const target = index + dir;
      if (target < 0 || target >= next.length) return b;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  function addBlock(type: BlogBlock["type"]) {
    setBody((b) => [...b, emptyBlock(type)]);
  }

  function handleGeneratePrompt() {
    if (!aiRawText.trim()) { toast.error("Cola o texto bruto antes de gerar o prompt."); return; }
    setAiPrompt(buildAiFormattingPrompt(aiRawText, aiInstructions || undefined));
  }
  async function handleCopyPrompt() {
    await navigator.clipboard.writeText(aiPrompt);
    toast.success("Prompt copiado!");
  }
  function handleConvertResponse() {
    if (!aiResponse.trim()) { toast.error("Cola a resposta da IA antes de converter."); return; }
    const parsed = parseAiFormattedText(aiResponse);
    if (parsed.length === 0) { toast.error("Não consegui identificar nenhum bloco nesse texto."); return; }
    if (body.length > 0 && !confirm("Isso substitui o corpo do artigo atual pelos blocos convertidos. Continuar?")) return;
    setBody(parsed);
    toast.success(`${parsed.length} bloco(s) adicionados — revise antes de salvar.`);
  }

  async function handleSave() {
    if (!title.trim() || !slug.trim()) { toast.error("Título e endereço (slug) são obrigatórios."); return; }
    if (body.length === 0) { toast.error("Adiciona pelo menos um bloco de conteúdo."); return; }
    const feature = FEATURE_PAGES.find((f) => f.href === relatedFeatureHref);
    const payload = {
      slug,
      title,
      description,
      date,
      readingMinutes,
      coverImageUrl,
      coverImageAlt,
      relatedFeatureHref: feature?.href ?? null,
      relatedFeatureLabel: feature?.label ?? null,
      body,
      published,
    };
    try {
      if (id) await api.updateBlogPost.mutateAsync({ data: { id, ...payload } });
      else await api.createBlogPost.mutateAsync({ data: payload });
      toast.success("Artigo salvo!");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar.");
    }
  }

  if (id && isLoading) return <div className="text-sm text-foreground/40 py-8 text-center">Carregando…</div>;

  const saving = api.createBlogPost.isPending || api.updateBlogPost.isPending;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <button onClick={onClose} className="inline-flex items-center gap-1.5 text-sm text-foreground/60 hover:text-foreground">
          <ArrowLeft size={15} /> Voltar pra lista
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wide disabled:opacity-50"
          style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          {saving && <Loader2 size={14} className="animate-spin" />} Salvar artigo
        </button>
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-foreground/50 block mb-1.5">Título</label>
            <input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2.5 text-sm"
              placeholder="Título do artigo"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-foreground/50 block mb-1.5">
              Endereço (slug) — modocriador.com.br/blog/{slug || "..."}
            </label>
            <input
              value={slug}
              onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
              className="w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2.5 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-foreground/50 block mb-1.5">Descrição curta (aparece na lista e no Google)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2.5 text-sm resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-foreground/50 block mb-1.5">Data</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-foreground/50 block mb-1.5">Minutos de leitura</label>
              <input type="number" min={1} max={60} value={readingMinutes} onChange={(e) => setReadingMinutes(Number(e.target.value) || 1)} className="w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-foreground/50 block mb-1.5">Link relacionado (opcional — mostra um CTA no fim do artigo)</label>
            <select value={relatedFeatureHref} onChange={(e) => setRelatedFeatureHref(e.target.value)} className="w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2.5 text-sm">
              <option value="">Nenhum</option>
              {FEATURE_PAGES.map((f) => <option key={f.href} value={f.href}>{f.label}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            Publicado (visível em /blog)
          </label>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide text-foreground/50 block mb-1.5">Capa</label>
          {coverImageUrl ? (
            <div className="relative rounded-lg overflow-hidden mb-2 group">
              <img src={coverImageUrl} alt="" className="w-full h-40 object-cover" />
              <button onClick={() => setCoverImageUrl(null)} className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="w-full h-40 rounded-lg border border-dashed border-foreground/20 flex items-center justify-center mb-2 text-foreground/30">
              <ImagePlus size={24} />
            </div>
          )}
          <label className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-3 py-2 rounded-lg border border-foreground/15 cursor-pointer hover:bg-foreground/5">
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
            {coverImageUrl ? "Trocar imagem" : "Subir imagem"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCoverUpload} disabled={uploading} />
          </label>
          <input
            value={coverImageAlt}
            onChange={(e) => setCoverImageAlt(e.target.value)}
            placeholder="Descrição da imagem (acessibilidade)"
            className="w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-xs mt-2"
          />
        </div>
      </div>

      {/* Ferramenta de formatação por IA */}
      <div className="mt-6 rounded-lg border border-foreground/10 bg-card overflow-hidden">
        <button onClick={() => setAiOpen((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 text-left">
          <span className="inline-flex items-center gap-2 text-sm font-bold"><Wand2 size={15} /> Formatar texto com IA (de graça, na IA que você quiser)</span>
          {aiOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {aiOpen && (
          <div className="p-4 pt-0 space-y-3 border-t border-foreground/10">
            <p className="text-xs text-foreground/50">
              Cola seu texto bruto (rascunho, ideia solta, transcrição), gera o prompt, cola numa IA (Claude, ChatGPT, Gemini...), copia a resposta dela e cola de volta aqui.
            </p>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-foreground/50 block mb-1.5">1. Seu texto bruto</label>
              <textarea value={aiRawText} onChange={(e) => setAiRawText(e.target.value)} rows={5} className="w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2.5 text-sm resize-y" placeholder="Cola aqui as ideias, rascunho ou transcrição..." />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-foreground/50 block mb-1.5">Instrução extra (opcional)</label>
              <input value={aiInstructions} onChange={(e) => setAiInstructions(e.target.value)} className="w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2.5 text-sm" placeholder='Ex: "foca em fotógrafos", "deixa mais curto"' />
            </div>
            <button onClick={handleGeneratePrompt} className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-3 py-2 rounded-lg border border-foreground/15 hover:bg-foreground/5">
              <Wand2 size={13} /> 2. Gerar prompt
            </button>
            {aiPrompt && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wide text-foreground/50">Prompt pronto — copia e cola na sua IA</label>
                  <button onClick={handleCopyPrompt} className="inline-flex items-center gap-1 text-[11px] font-bold uppercase text-foreground/60 hover:text-foreground"><Copy size={12} /> Copiar</button>
                </div>
                <textarea readOnly value={aiPrompt} rows={6} className="w-full rounded-lg border border-foreground/15 bg-foreground/[0.03] px-3 py-2.5 text-xs font-mono resize-y" />
              </div>
            )}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-foreground/50 block mb-1.5">3. Cola aqui a resposta da IA</label>
              <textarea value={aiResponse} onChange={(e) => setAiResponse(e.target.value)} rows={6} className="w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2.5 text-sm resize-y" />
            </div>
            <button onClick={handleConvertResponse} className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-3 py-2 rounded-lg" style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
              4. Converter em blocos do artigo
            </button>
          </div>
        )}
      </div>

      {/* Corpo do artigo, bloco por bloco */}
      <div className="mt-6">
        <label className="text-[11px] font-bold uppercase tracking-wide text-foreground/50 block mb-2">Corpo do artigo</label>
        <div className="space-y-3">
          {body.map((block, i) => (
            <BlockEditor
              key={i}
              block={block}
              onChange={(next) => updateBlock(i, next)}
              onRemove={() => removeBlock(i)}
              onMoveUp={i > 0 ? () => moveBlock(i, -1) : undefined}
              onMoveDown={i < body.length - 1 ? () => moveBlock(i, 1) : undefined}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {(Object.keys(BLOCK_TYPE_LABEL) as BlogBlock["type"][]).map((t) => (
            <button
              key={t}
              onClick={() => addBlock(t)}
              className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-md border border-foreground/15 hover:bg-foreground/5"
            >
              + {BLOCK_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BlockEditor({ block, onChange, onRemove, onMoveUp, onMoveDown }: {
  block: BlogBlock; onChange: (b: BlogBlock) => void; onRemove: () => void; onMoveUp?: () => void; onMoveDown?: () => void;
}) {
  return (
    <div className="rounded-lg border border-foreground/10 bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">{BLOCK_TYPE_LABEL[block.type]}</span>
        <div className="flex items-center gap-0.5">
          <button onClick={onMoveUp} disabled={!onMoveUp} className="p-1 rounded text-foreground/50 hover:text-foreground disabled:opacity-20"><ChevronUp size={14} /></button>
          <button onClick={onMoveDown} disabled={!onMoveDown} className="p-1 rounded text-foreground/50 hover:text-foreground disabled:opacity-20"><ChevronDown size={14} /></button>
          <button onClick={onRemove} className="p-1 rounded text-foreground/40 hover:text-red-400"><Trash2 size={14} /></button>
        </div>
      </div>

      {(block.type === "lead" || block.type === "p" || block.type === "h2" || block.type === "h3" || block.type === "quote") && (
        <textarea
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value } as BlogBlock)}
          rows={block.type === "h2" || block.type === "h3" ? 1 : 3}
          className="w-full rounded-md border border-foreground/15 bg-transparent px-2.5 py-2 text-sm resize-y"
        />
      )}

      {block.type === "callout" && (
        <div className="space-y-2">
          <input
            value={block.title ?? ""}
            onChange={(e) => onChange({ ...block, title: e.target.value })}
            placeholder="Título (opcional)"
            className="w-full rounded-md border border-foreground/15 bg-transparent px-2.5 py-2 text-sm"
          />
          <textarea
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            rows={3}
            className="w-full rounded-md border border-foreground/15 bg-transparent px-2.5 py-2 text-sm resize-y"
          />
        </div>
      )}

      {block.type === "list" && (
        <textarea
          value={block.items.join("\n")}
          onChange={(e) => onChange({ ...block, items: e.target.value.split("\n") })}
          rows={4}
          placeholder="Um item por linha"
          className="w-full rounded-md border border-foreground/15 bg-transparent px-2.5 py-2 text-sm resize-y"
        />
      )}

      {block.type === "rankedList" && (
        <div>
          <textarea
            value={block.items.map((it) => `${it.title} :: ${it.text}`).join("\n")}
            onChange={(e) =>
              onChange({
                ...block,
                items: e.target.value.split("\n").map((line) => {
                  const [t, ...rest] = line.split("::");
                  return { title: (t ?? "").trim(), text: rest.join("::").trim() };
                }),
              })
            }
            rows={5}
            placeholder="Um item por linha, no formato: Título :: Descrição"
            className="w-full rounded-md border border-foreground/15 bg-transparent px-2.5 py-2 text-sm resize-y font-mono"
          />
        </div>
      )}
    </div>
  );
}
