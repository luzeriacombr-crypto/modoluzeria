import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Trash2, Pencil, Package, FileText, Download, ArrowLeft, Upload, X, ChevronDown, ChevronUp,
} from "lucide-react";
import { budgetProductsQO, budgetsQO, useApi, useMe } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { supabase } from "@/integrations/supabase/client";
import type { BudgetProduct, BudgetProductPlan, Budget, BudgetItem, BudgetFront } from "@/lib/luzeria/budgets.functions";

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function parseAmount(raw: string): number | null {
  const n = parseFloat(raw.replace(/\./g, "").replace(",", "."));
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}
const inp = "w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]";
const label = "block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5";

type View = { name: "lista" } | { name: "catalogo" } | { name: "construtor"; budgetId: string | null };

/** Orçamentos (Financeiro): catálogo de produtos/serviços da agência +
 * orçamentos gerados a partir dele, exportados em PDF (Simples ou
 * Completo). Plano aprovado: claude.ai/artifact/41X9c5BsGyRCCDYvMckid1. */
export function OrcamentosPanel() {
  const [view, setView] = useState<View>({ name: "lista" });

  if (view.name === "catalogo") return <ProductCatalog onBack={() => setView({ name: "lista" })} />;
  if (view.name === "construtor") {
    return <BudgetBuilder budgetId={view.budgetId} onDone={() => setView({ name: "lista" })} />;
  }
  return (
    <BudgetsList
      onNew={() => setView({ name: "construtor", budgetId: null })}
      onEdit={(id) => setView({ name: "construtor", budgetId: id })}
      onCatalog={() => setView({ name: "catalogo" })}
    />
  );
}

// ---------------------------------------------------------------------------
// Lista de orçamentos
// ---------------------------------------------------------------------------

function BudgetsList({ onNew, onEdit, onCatalog }: { onNew: () => void; onEdit: (id: string) => void; onCatalog: () => void }) {
  const { data: budgets = [], isLoading } = useQuery(budgetsQO());
  const { removeBudget, exportBudgetPdf } = useApi();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  function downloadPdf(b: Budget) {
    setDownloadingId(b.id);
    exportBudgetPdf.mutate({ data: { id: b.id } }, {
      onSuccess: (r: any) => {
        const bytes = Uint8Array.from(atob(r.pdfBase64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Orcamento - ${b.clientName}.pdf`.replace(/[^\w .-]+/g, "-");
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        toast.success("PDF gerado!");
      },
      onSettled: () => setDownloadingId(null),
    });
  }

  async function remove(b: Budget) {
    if (await requestConfirm(`Excluir o orçamento de "${b.clientName}"?`, { danger: true })) {
      removeBudget.mutate({ data: { id: b.id } });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-foreground">Orçamentos</div>
          <p className="text-[11px] text-foreground/35">Catálogo de produtos + propostas em PDF pra mandar pro cliente.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onCatalog} className="lz-btn-ghost text-xs px-3.5 py-2 rounded-md inline-flex items-center gap-1.5">
            <Package size={13} /> Catálogo de produtos
          </button>
          <button onClick={onNew} className="lz-btn-primary text-xs px-4 py-2 rounded-md inline-flex items-center gap-1.5">
            <Plus size={13} /> Novo orçamento
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-xs text-foreground/40 py-8 text-center">Carregando…</div>
      ) : budgets.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-foreground/10 rounded-xl">
          <FileText size={26} className="mx-auto mb-3 text-foreground/20" />
          <p className="text-sm text-foreground/50">Nenhum orçamento ainda.</p>
          <p className="text-xs text-foreground/35 mt-1">Cadastre alguns produtos no catálogo e crie o primeiro.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {budgets.map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-lg border border-foreground/8 bg-card px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground truncate">{b.clientName}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                    style={{ background: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "color-mix(in srgb, var(--foreground) 55%, transparent)" }}>
                    {b.version}
                  </span>
                </div>
                <div className="text-[11px] text-foreground/40 mt-0.5">
                  {b.clientSegment ? `${b.clientSegment} · ` : ""}{new Date(b.createdAt).toLocaleDateString("pt-BR")}
                </div>
              </div>
              <div className="text-sm font-extrabold text-foreground shrink-0">{money(b.totalCents)}</div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => downloadPdf(b)} disabled={downloadingId === b.id}
                  title="Baixar PDF" className="p-2 rounded text-foreground/40 hover:text-[var(--lz-accent-ink)] hover:bg-foreground/5 transition disabled:opacity-40">
                  <Download size={15} />
                </button>
                <button onClick={() => onEdit(b.id)} title="Editar" className="p-2 rounded text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition">
                  <Pencil size={15} />
                </button>
                <button onClick={() => remove(b)} title="Excluir" className="p-2 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5 transition">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Catálogo de produtos
// ---------------------------------------------------------------------------

function ProductCatalog({ onBack }: { onBack: () => void }) {
  const { data: products = [], isLoading } = useQuery(budgetProductsQO());
  const { removeBudgetProduct } = useApi();
  const [editing, setEditing] = useState<BudgetProduct | "new" | null>(null);

  async function remove(p: BudgetProduct) {
    if (await requestConfirm(`Excluir "${p.name}" do catálogo?`, { danger: true })) {
      removeBudgetProduct.mutate({ data: { id: p.id } });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded text-foreground/50 hover:text-foreground hover:bg-foreground/5 transition"><ArrowLeft size={16} /></button>
        <div>
          <div className="text-sm font-bold text-foreground">Catálogo de produtos</div>
          <p className="text-[11px] text-foreground/35">Cadastre uma vez, use em quantos orçamentos quiser.</p>
        </div>
        <button onClick={() => setEditing("new")} className="lz-btn-primary text-xs px-4 py-2 rounded-md inline-flex items-center gap-1.5 ml-auto">
          <Plus size={13} /> Novo produto
        </button>
      </div>

      {editing && <ProductForm product={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}

      {isLoading ? (
        <div className="text-xs text-foreground/40 py-8 text-center">Carregando…</div>
      ) : products.length === 0 && !editing ? (
        <div className="text-center py-16 border border-dashed border-foreground/10 rounded-xl">
          <Package size={26} className="mx-auto mb-3 text-foreground/20" />
          <p className="text-sm text-foreground/50">Nenhum produto cadastrado ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {products.map((p) => (
            <div key={p.id} className="group flex items-start gap-3 rounded-lg border border-foreground/8 bg-card px-3.5 py-3">
              {p.photoUrl ? (
                <img src={p.photoUrl} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="h-10 w-10 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ background: "rgba(var(--lz-brand-rgb),0.12)" }}>
                  {p.icon || "📦"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-foreground truncate">{p.name}</div>
                {p.description && <div className="text-[11px] text-foreground/45 line-clamp-2 mt-0.5">{p.description}</div>}
                <div className="text-[12.5px] font-bold text-foreground mt-1">{money(p.priceCents)}</div>
                {p.plans.length > 0 && (
                  <div className="text-[10.5px] text-foreground/40 mt-0.5">+{p.plans.length} variaç{p.plans.length === 1 ? "ão" : "ões"}</div>
                )}
              </div>
              <div className="hidden group-hover:flex flex-col gap-1 shrink-0">
                <button onClick={() => setEditing(p)} className="text-foreground/30 hover:text-[var(--lz-accent-ink)] transition p-0.5"><Pencil size={13} /></button>
                <button onClick={() => remove(p)} className="text-foreground/30 hover:text-red-400 transition p-0.5"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductForm({ product, onClose }: { product: BudgetProduct | null; onClose: () => void }) {
  const { addBudgetProduct, updateBudgetProduct } = useApi();
  const me = useMe().data;
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? (product.priceCents / 100).toFixed(2).replace(".", ",") : "");
  const [icon, setIcon] = useState(product?.icon ?? "");
  const [photoPath, setPhotoPath] = useState<string | null>(product?.photoPath ?? null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(product?.photoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [plans, setPlans] = useState<BudgetProductPlan[]>(product?.plans ?? []);

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Escolha uma imagem."); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `budget-products/${me?.orgId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      setPhotoPath(path);
      setPhotoUrl(URL.createObjectURL(file));
    } catch { toast.error("Erro ao enviar a foto."); }
    finally { setUploading(false); }
  }

  function addPlan() { setPlans((p) => [...p, { label: "", priceCents: 0, description: null }]); }
  function updatePlan(i: number, patch: Partial<BudgetProductPlan>) {
    setPlans((p) => p.map((pl, idx) => (idx === i ? { ...pl, ...patch } : pl)));
  }
  function removePlan(i: number) { setPlans((p) => p.filter((_, idx) => idx !== i)); }

  function save() {
    const cents = parseAmount(price);
    if (!name.trim() || cents == null) { toast.error("Preencha o nome e o valor."); return; }
    const cleanPlans = plans.filter((p) => p.label.trim()).map((p) => ({ ...p, label: p.label.trim() }));
    const payload = { name: name.trim(), description: description.trim() || null, priceCents: cents, icon: icon.trim() || null, photoPath, plans: cleanPlans };
    if (product) {
      updateBudgetProduct.mutate({ data: { id: product.id, ...payload } }, { onSuccess: onClose });
    } else {
      addBudgetProduct.mutate({ data: payload }, { onSuccess: onClose });
    }
  }

  return (
    <div className="rounded-lg p-4 space-y-3" style={{ background: "color-mix(in srgb, var(--foreground) 3%, transparent)", border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)" }}>
      <div className="flex gap-3">
        <div className="shrink-0">
          <label className="h-16 w-16 rounded-lg flex items-center justify-center text-2xl cursor-pointer overflow-hidden shrink-0 block" style={{ background: "rgba(var(--lz-brand-rgb),0.12)" }}>
            {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : (icon || "📦")}
            <input type="file" accept="image/*" className="hidden" onChange={pickPhoto} disabled={uploading} />
          </label>
        </div>
        <div className="flex-1 space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do produto/serviço" className={inp} />
          <div className="flex gap-2">
            <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Preço (R$)" className={`${inp} flex-1`} />
            <input value={icon} onChange={(e) => setIcon(e.target.value.slice(0, 4))} placeholder="Emoji" className={`${inp} w-20 text-center`} />
          </div>
        </div>
      </div>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição curta do que está incluso" rows={2} className={`${inp} resize-none`} />

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={label}>Planos/variações (opcional)</span>
          <button onClick={addPlan} className="text-[11px] font-semibold text-foreground/50 hover:text-foreground transition inline-flex items-center gap-1"><Plus size={11} /> Adicionar</button>
        </div>
        {plans.length > 0 && (
          <div className="space-y-1.5">
            {plans.map((p, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <input value={p.label} onChange={(e) => updatePlan(i, { label: e.target.value })} placeholder="Ex: Essencial" className={`${inp} flex-1`} />
                <input
                  value={p.priceCents ? (p.priceCents / 100).toFixed(2).replace(".", ",") : ""}
                  onChange={(e) => updatePlan(i, { priceCents: parseAmount(e.target.value) ?? 0 })}
                  placeholder="R$" className={`${inp} w-24`}
                />
                <button onClick={() => removePlan(i)} className="text-foreground/30 hover:text-red-400 transition p-1 shrink-0"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="text-xs text-foreground/50 hover:text-foreground px-3 py-2">Cancelar</button>
        <button onClick={save} disabled={uploading} className="lz-btn-primary text-xs px-4 py-2 rounded-md disabled:opacity-50">Salvar</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Construtor de orçamento
// ---------------------------------------------------------------------------

function BudgetBuilder({ budgetId, onDone }: { budgetId: string | null; onDone: () => void }) {
  const me = useMe().data;
  const { data: products = [] } = useQuery(budgetProductsQO());
  const { data: budgets = [] } = useQuery(budgetsQO());
  const { saveBudget, exportBudgetPdf } = useApi();
  const existing = budgetId ? budgets.find((b) => b.id === budgetId) ?? null : null;

  const [clientName, setClientName] = useState(existing?.clientName ?? "");
  const [clientSegment, setClientSegment] = useState(existing?.clientSegment ?? "");
  const [version, setVersion] = useState<"simples" | "completo">(existing?.version ?? "simples");
  const [items, setItems] = useState<BudgetItem[]>(existing?.items ?? []);
  const [logoVariant, setLogoVariant] = useState<"light" | "dark">(existing?.logoVariant ?? "dark");
  const [headerImagePath, setHeaderImagePath] = useState<string | null>(existing?.headerImagePath ?? null);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(existing?.headerImageUrl ?? null);
  const [coverImagePath, setCoverImagePath] = useState<string | null>(existing?.coverImagePath ?? null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(existing?.coverImageUrl ?? null);
  const [backCoverImagePath, setBackCoverImagePath] = useState<string | null>(existing?.backCoverImagePath ?? null);
  const [backCoverImageUrl, setBackCoverImageUrl] = useState<string | null>(existing?.backCoverImageUrl ?? null);
  const [uploadingCover, setUploadingCover] = useState<"cover" | "back" | null>(null);
  const [footerText, setFooterText] = useState(existing?.footerText ?? "");
  const [coverPhrase, setCoverPhrase] = useState(existing?.coverPhrase ?? "");
  const [introTitle, setIntroTitle] = useState(existing?.introTitle ?? "Por que esse projeto existe");
  const [introText, setIntroText] = useState(existing?.introText ?? "");
  const [fronts, setFronts] = useState<BudgetFront[]>(existing?.fronts ?? []);
  const [paymentTerms, setPaymentTerms] = useState(existing?.paymentTerms ?? "");
  const [cronograma, setCronograma] = useState(existing?.cronograma ?? "");
  const [notIncluded, setNotIncluded] = useState(existing?.notIncluded ?? "");
  const [afterApproval, setAfterApproval] = useState(existing?.afterApproval ?? "");
  const [backPhrase, setBackPhrase] = useState(existing?.backPhrase ?? "");
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const [saving, setSaving] = useState<"save" | "pdf" | null>(null);

  const totalCents = items.reduce((s, i) => s + i.priceCents, 0);

  function addCatalogItem(p: BudgetProduct, plan?: BudgetProductPlan) {
    setItems((it) => [...it, {
      label: plan ? `${p.name} — ${plan.label}` : p.name,
      description: (plan?.description ?? p.description) ?? null,
      priceCents: plan ? plan.priceCents : p.priceCents,
    }]);
  }
  function addCustomItem() { setItems((it) => [...it, { label: "", description: null, priceCents: 0 }]); }
  function updateItem(i: number, patch: Partial<BudgetItem>) {
    setItems((it) => it.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  }
  function removeItem(i: number) { setItems((it) => it.filter((_, idx) => idx !== i)); }

  function addFront() { setFronts((f) => [...f, { title: "", items: [] }]); }
  function updateFront(i: number, patch: Partial<BudgetFront>) {
    setFronts((f) => f.map((fr, idx) => (idx === i ? { ...fr, ...patch } : fr)));
  }
  function removeFront(i: number) { setFronts((f) => f.filter((_, idx) => idx !== i)); }
  function addFrontItem(fi: number) {
    setFronts((f) => f.map((fr, idx) => (idx === fi ? { ...fr, items: [...fr.items, { title: "", description: null }] } : fr)));
  }
  function updateFrontItem(fi: number, ii: number, patch: { title?: string; description?: string | null }) {
    setFronts((f) => f.map((fr, idx) => idx === fi
      ? { ...fr, items: fr.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) }
      : fr));
  }
  function removeFrontItem(fi: number, ii: number) {
    setFronts((f) => f.map((fr, idx) => idx === fi ? { ...fr, items: fr.items.filter((_, j) => j !== ii) } : fr));
  }

  async function pickHeader(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Escolha uma imagem."); return; }
    setUploadingHeader(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `budgets/${me?.orgId}/header-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      setHeaderImagePath(path);
      setHeaderImageUrl(URL.createObjectURL(file));
    } catch { toast.error("Erro ao enviar a imagem de cabeçalho."); }
    finally { setUploadingHeader(false); }
  }

  async function pickCoverImage(kind: "cover" | "back", e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Escolha uma imagem."); return; }
    setUploadingCover(kind);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `budgets/${me?.orgId}/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      const url = URL.createObjectURL(file);
      if (kind === "cover") { setCoverImagePath(path); setCoverImageUrl(url); }
      else { setBackCoverImagePath(path); setBackCoverImageUrl(url); }
    } catch { toast.error("Erro ao enviar a imagem."); }
    finally { setUploadingCover(null); }
  }

  function buildPayload() {
    return {
      id: existing?.id, clientName: clientName.trim(), clientSegment: clientSegment.trim() || null,
      version, items, logoVariant, headerImagePath, coverImagePath, backCoverImagePath, footerText: footerText.trim() || null,
      coverPhrase: coverPhrase.trim() || null, introTitle: introTitle.trim() || null, introText: introText.trim() || null,
      fronts: fronts.filter((f) => f.title.trim()), paymentTerms: paymentTerms.trim() || null,
      cronograma: cronograma.trim() || null, notIncluded: notIncluded.trim() || null,
      afterApproval: afterApproval.trim() || null, backPhrase: backPhrase.trim() || null,
    };
  }

  function validate(): boolean {
    if (!clientName.trim()) { toast.error("Preencha o nome do cliente."); return false; }
    if (items.length === 0) { toast.error("Adicione ao menos um item."); return false; }
    if (items.some((i) => !i.label.trim())) { toast.error("Todo item precisa de um nome."); return false; }
    return true;
  }

  function handleSave() {
    if (!validate()) return;
    setSaving("save");
    saveBudget.mutate({ data: buildPayload() }, {
      onSuccess: () => { toast.success("Orçamento salvo."); onDone(); },
      onSettled: () => setSaving(null),
    });
  }

  function handleSaveAndDownload() {
    if (!validate()) return;
    setSaving("pdf");
    saveBudget.mutate({ data: buildPayload() }, {
      onSuccess: (r: any) => {
        exportBudgetPdf.mutate({ data: { id: r.id } }, {
          onSuccess: (pdf: any) => {
            const bytes = Uint8Array.from(atob(pdf.pdfBase64), (c) => c.charCodeAt(0));
            const blob = new Blob([bytes], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Orcamento - ${clientName}.pdf`.replace(/[^\w .-]+/g, "-");
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            toast.success("PDF gerado!");
            onDone();
          },
          onSettled: () => setSaving(null),
        });
      },
      onError: () => setSaving(null),
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button onClick={onDone} className="p-1.5 rounded text-foreground/50 hover:text-foreground hover:bg-foreground/5 transition"><ArrowLeft size={16} /></button>
        <div className="text-sm font-bold text-foreground">{existing ? "Editar orçamento" : "Novo orçamento"}</div>
      </div>

      {/* Versão */}
      <div className="flex gap-2">
        {(["simples", "completo"] as const).map((v) => (
          <button key={v} onClick={() => setVersion(v)}
            className="flex-1 text-xs font-bold py-2.5 rounded-md transition capitalize"
            style={version === v
              ? { background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }
              : { background: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}>
            {v}
          </button>
        ))}
      </div>

      {/* Cliente */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block"><span className={label}>Cliente</span><input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome do cliente/prospect" className={inp} /></label>
        <label className="block"><span className={label}>Segmento (opcional)</span><input value={clientSegment} onChange={(e) => setClientSegment(e.target.value)} placeholder="Ex: Assistência técnica" className={inp} /></label>
      </div>

      {/* Itens */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className={label}>Itens do orçamento</span>
          <div className="flex items-center gap-2">
            {products.length > 0 && <ProductPicker products={products} onPick={addCatalogItem} />}
            <button onClick={addCustomItem} className="text-[11px] font-semibold text-foreground/50 hover:text-foreground transition inline-flex items-center gap-1"><Plus size={11} /> Linha avulsa</button>
          </div>
        </div>
        {items.length === 0 ? (
          <div className="text-[11px] text-foreground/35 py-3 text-center border border-dashed border-foreground/10 rounded-lg">Nenhum item ainda — adicione do catálogo ou uma linha avulsa.</div>
        ) : (
          <div className="space-y-1.5">
            {items.map((it, i) => (
              <div key={i} className="rounded-lg p-2.5" style={{ background: "color-mix(in srgb, var(--foreground) 2.5%, transparent)" }}>
                <div className="flex gap-1.5 items-center">
                  <input value={it.label} onChange={(e) => updateItem(i, { label: e.target.value })} placeholder="Descrição do item" className={`${inp} flex-1`} />
                  <input
                    value={it.priceCents ? (it.priceCents / 100).toFixed(2).replace(".", ",") : ""}
                    onChange={(e) => updateItem(i, { priceCents: parseAmount(e.target.value) ?? 0 })}
                    placeholder="R$" className={`${inp} w-28`}
                  />
                  <button onClick={() => removeItem(i)} className="text-foreground/30 hover:text-red-400 transition p-1 shrink-0"><X size={14} /></button>
                </div>
                <input
                  value={it.description ?? ""} onChange={(e) => updateItem(i, { description: e.target.value || null })}
                  placeholder="Detalhe (opcional)" className={`${inp} mt-1.5 text-xs`}
                />
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-xs text-foreground/50">Total</span>
          <span className="text-base font-extrabold text-foreground">{money(totalCents)}</span>
        </div>
      </div>

      {/* Marca */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <span className={label}>Logo</span>
          <div className="flex gap-2">
            {(["dark", "light"] as const).map((v) => (
              <button key={v} onClick={() => setLogoVariant(v)}
                className="flex-1 text-xs font-semibold py-2 rounded-md transition"
                style={logoVariant === v
                  ? { background: "rgba(var(--lz-brand-rgb),0.15)", border: "1px solid rgb(var(--lz-brand-rgb))", color: "var(--lz-accent-ink)" }
                  : { background: "color-mix(in srgb, var(--foreground) 6%, transparent)", border: "1px solid transparent", color: "color-mix(in srgb, var(--foreground) 55%, transparent)" }}>
                {v === "dark" ? "Escura" : "Clara"}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className={label}>Cabeçalho (imagem, opcional)</span>
          <div className="flex items-center gap-2">
            <label className="lz-btn-ghost text-xs px-3 py-2 rounded-md cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50">
              <Upload size={12} /> {uploadingHeader ? "Enviando…" : headerImageUrl ? "Trocar" : "Enviar"}
              <input type="file" accept="image/*" className="hidden" onChange={pickHeader} disabled={uploadingHeader} />
            </label>
            {headerImageUrl && <button onClick={() => { setHeaderImagePath(null); setHeaderImageUrl(null); }} className="text-[11px] text-foreground/50 hover:text-foreground transition">Remover</button>}
          </div>
        </label>
      </div>

      <label className="block"><span className={label}>Rodapé (opcional)</span><input value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="Ex: Sua Agência · contato@suaagencia.com.br" className={inp} /></label>

      {version === "completo" && (
        <div className="space-y-4 pt-2 border-t border-foreground/10">
          <div className="text-xs font-bold text-foreground/60 uppercase tracking-wide">Proposta completa</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className={label}>Capa (imagem de fundo)</span>
              <p className="text-[10.5px] text-foreground/35 mb-1.5 -mt-1">Deixe espaço em branco — o Modo Criador escreve o título, o cliente e a data por cima.</p>
              <div className="flex items-center gap-2">
                <label className="lz-btn-ghost text-xs px-3 py-2 rounded-md cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50">
                  <Upload size={12} /> {uploadingCover === "cover" ? "Enviando…" : coverImageUrl ? "Trocar" : "Enviar"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => pickCoverImage("cover", e)} disabled={uploadingCover !== null} />
                </label>
                {coverImageUrl && <button onClick={() => { setCoverImagePath(null); setCoverImageUrl(null); }} className="text-[11px] text-foreground/50 hover:text-foreground transition">Remover</button>}
              </div>
              {coverImageUrl && <img src={coverImageUrl} alt="" className="mt-2 h-24 rounded-md object-cover border border-foreground/10" />}
            </div>
            <div>
              <span className={label}>Contracapa (imagem completa)</span>
              <p className="text-[10.5px] text-foreground/35 mb-1.5 -mt-1">Já vem pronta — nada é escrito em cima.</p>
              <div className="flex items-center gap-2">
                <label className="lz-btn-ghost text-xs px-3 py-2 rounded-md cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50">
                  <Upload size={12} /> {uploadingCover === "back" ? "Enviando…" : backCoverImageUrl ? "Trocar" : "Enviar"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => pickCoverImage("back", e)} disabled={uploadingCover !== null} />
                </label>
                {backCoverImageUrl && <button onClick={() => { setBackCoverImagePath(null); setBackCoverImageUrl(null); }} className="text-[11px] text-foreground/50 hover:text-foreground transition">Remover</button>}
              </div>
              {backCoverImageUrl && <img src={backCoverImageUrl} alt="" className="mt-2 h-24 rounded-md object-cover border border-foreground/10" />}
            </div>
          </div>

          <label className="block"><span className={label}>Título/serviço na capa</span><input value={coverPhrase} onChange={(e) => setCoverPhrase(e.target.value)} placeholder="Ex: Planejamento Estratégico de Marketing" className={inp} /></label>
          <label className="block"><span className={label}>Título da introdução</span><input value={introTitle} onChange={(e) => setIntroTitle(e.target.value)} className={inp} /></label>
          <label className="block"><span className={label}>Texto da introdução</span><textarea value={introText} onChange={(e) => setIntroText(e.target.value)} rows={4} placeholder="Por que esse projeto existe, o contexto do cliente…" className={`${inp} resize-none`} /></label>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className={label}>Entregas por frente</span>
              <button onClick={addFront} className="text-[11px] font-semibold text-foreground/50 hover:text-foreground transition inline-flex items-center gap-1"><Plus size={11} /> Frente</button>
            </div>
            <div className="space-y-2.5">
              {fronts.map((front, fi) => (
                <div key={fi} className="rounded-lg p-3 space-y-2" style={{ background: "color-mix(in srgb, var(--foreground) 2.5%, transparent)" }}>
                  <div className="flex gap-1.5">
                    <input value={front.title} onChange={(e) => updateFront(fi, { title: e.target.value })} placeholder="Ex: Estratégia e Produção" className={`${inp} flex-1`} />
                    <button onClick={() => removeFront(fi)} className="text-foreground/30 hover:text-red-400 transition p-1 shrink-0"><X size={14} /></button>
                  </div>
                  {front.items.map((it, ii) => (
                    <div key={ii} className="flex gap-1.5 pl-3 border-l-2 border-foreground/10">
                      <div className="flex-1 space-y-1">
                        <input value={it.title} onChange={(e) => updateFrontItem(fi, ii, { title: e.target.value })} placeholder="Título da entrega" className={`${inp} text-xs`} />
                        <input value={it.description ?? ""} onChange={(e) => updateFrontItem(fi, ii, { description: e.target.value || null })} placeholder="Detalhe" className={`${inp} text-xs`} />
                      </div>
                      <button onClick={() => removeFrontItem(fi, ii)} className="text-foreground/30 hover:text-red-400 transition p-1 shrink-0"><X size={13} /></button>
                    </div>
                  ))}
                  <button onClick={() => addFrontItem(fi)} className="text-[10.5px] font-semibold text-foreground/40 hover:text-foreground transition pl-3 inline-flex items-center gap-1"><Plus size={10} /> Entrega</button>
                </div>
              ))}
            </div>
          </div>

          <label className="block"><span className={label}>Forma de pagamento</span><textarea value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} rows={2} placeholder="Ex: 40% na assinatura, 30% na entrega parcial, 30% na entrega final" className={`${inp} resize-none`} /></label>
          <label className="block"><span className={label}>Cronograma</span><textarea value={cronograma} onChange={(e) => setCronograma(e.target.value)} rows={2} className={`${inp} resize-none`} /></label>
          <label className="block"><span className={label}>O que não está incluso</span><textarea value={notIncluded} onChange={(e) => setNotIncluded(e.target.value)} rows={2} className={`${inp} resize-none`} /></label>
          <label className="block"><span className={label}>Após a aprovação</span><textarea value={afterApproval} onChange={(e) => setAfterApproval(e.target.value)} rows={2} className={`${inp} resize-none`} /></label>
          {!backCoverImageUrl && (
            <label className="block"><span className={label}>Frase da contracapa</span><input value={backPhrase} onChange={(e) => setBackPhrase(e.target.value)} placeholder="Ex: Vamos criar juntos." className={inp} /></label>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-foreground/10">
        <button onClick={onDone} className="text-xs text-foreground/50 hover:text-foreground px-3 py-2">Cancelar</button>
        <button onClick={handleSave} disabled={saving !== null} className="lz-btn-ghost text-xs px-4 py-2.5 rounded-md disabled:opacity-50">
          {saving === "save" ? "Salvando…" : "Salvar"}
        </button>
        <button onClick={handleSaveAndDownload} disabled={saving !== null} className="lz-btn-primary text-xs px-4 py-2.5 rounded-md disabled:opacity-50 inline-flex items-center gap-1.5">
          <Download size={13} /> {saving === "pdf" ? "Gerando…" : "Salvar e baixar PDF"}
        </button>
      </div>
    </div>
  );
}

function ProductPicker({ products, onPick }: { products: BudgetProduct[]; onPick: (p: BudgetProduct, plan?: BudgetProductPlan) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="text-[11px] font-semibold text-foreground/50 hover:text-foreground transition inline-flex items-center gap-1">
        <Plus size={11} /> Do catálogo {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-64 max-h-64 overflow-y-auto rounded-lg bg-[#1C1C1C] border border-white/10 shadow-2xl py-1">
          {products.map((p) => (
            <div key={p.id}>
              <button
                onClick={() => { onPick(p); if (p.plans.length === 0) setOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-white/85 hover:bg-white/5 transition-colors flex items-center justify-between gap-2"
              >
                <span className="truncate">{p.icon ? `${p.icon} ` : ""}{p.name}</span>
                <span className="text-white/40 shrink-0">{money(p.priceCents)}</span>
              </button>
              {p.plans.map((plan, i) => (
                <button
                  key={i}
                  onClick={() => { onPick(p, plan); setOpen(false); }}
                  className="w-full text-left pl-6 pr-3 py-1.5 text-[11px] text-white/60 hover:bg-white/5 hover:text-white/85 transition-colors flex items-center justify-between gap-2"
                >
                  <span className="truncate">{plan.label}</span>
                  <span className="text-white/35 shrink-0">{money(plan.priceCents)}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
