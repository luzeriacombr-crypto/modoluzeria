import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit2, Copy, Loader2, AlertCircle } from "lucide-react";
import { PromotionCode } from "@/lib/luzeria/types";
import {
  listPromotionCodes,
  createPromotionCode,
  updatePromotionCode,
  deletePromotionCode,
} from "@/lib/luzeria/promotion-affiliate.functions";

export function PromotionCodesPanel() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    slug: "",
    discountPercent: 50,
    description: "",
    validUntil: "",
    maxUses: "",
  });

  const { data: codes, isLoading } = useQuery({
    queryKey: ["promotionCodes"],
    queryFn: () => listPromotionCodes(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => createPromotionCode(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotionCodes"] });
      resetForm();
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => updatePromotionCode(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotionCodes"] });
      setEditingId(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePromotionCode({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotionCodes"] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      slug: "",
      discountPercent: 50,
      description: "",
      validUntil: "",
      maxUses: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      name: formData.name,
      code: formData.code.toUpperCase(),
      slug: formData.slug.toLowerCase(),
      discountPercent: Number(formData.discountPercent),
      description: formData.description || undefined,
      validUntil: formData.validUntil ? new Date(formData.validUntil).toISOString() : undefined,
      maxUses: formData.maxUses ? Number(formData.maxUses) : undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(""), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-white/40" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Cupons de Promoção</h2>
        <button
          onClick={() => {
            resetForm();
            setEditingId(null);
            setShowForm(!showForm);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[rgb(var(--lz-brand-rgb))]/20 hover:bg-[rgb(var(--lz-brand-rgb))]/30 text-[rgb(var(--lz-brand-rgb))] rounded-lg font-semibold transition"
        >
          <Plus size={18} />
          Novo Cupom
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white/[0.05] border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">
            {editingId ? "Editar Cupom" : "Criar Novo Cupom"}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Nome (ex: Desconto Orim)"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="px-3 py-2 bg-white/[0.08] border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
                required
              />

              <input
                type="text"
                placeholder="Código (ex: ORIM2026)"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="px-3 py-2 bg-white/[0.08] border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 font-mono"
                required
              />

              <input
                type="text"
                placeholder="Slug URL (ex: orim)"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                className="px-3 py-2 bg-white/[0.08] border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
                required
              />

              <input
                type="number"
                placeholder="Desconto %"
                value={formData.discountPercent}
                onChange={(e) => setFormData({ ...formData, discountPercent: Number(e.target.value) })}
                min="1"
                max="100"
                className="px-3 py-2 bg-white/[0.08] border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
                required
              />

              <input
                type="number"
                placeholder="Limite de usos (opcional)"
                value={formData.maxUses}
                onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                className="px-3 py-2 bg-white/[0.08] border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
              />

              <input
                type="date"
                placeholder="Válido até (opcional)"
                value={formData.validUntil}
                onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                className="px-3 py-2 bg-white/[0.08] border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
              />
            </div>

            <textarea
              placeholder="Descrição (opcional)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-white/[0.08] border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
              rows={2}
            />

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1 px-4 py-2 bg-[rgb(var(--lz-brand-rgb))] hover:opacity-90 disabled:opacity-50 text-white font-bold rounded-lg transition"
              >
                {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  resetForm();
                }}
                className="flex-1 px-4 py-2 bg-white/[0.08] hover:bg-white/[0.12] text-white font-bold rounded-lg transition"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {codes && codes.length > 0 ? (
          codes.map((code: PromotionCode) => (
            <div key={code.id} className="bg-white/[0.05] border border-white/10 rounded-lg p-4 hover:bg-white/[0.08] transition">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-white">{code.name}</h4>
                    <span className="text-xs bg-[rgb(var(--lz-brand-rgb))]/20 text-[rgb(var(--lz-brand-rgb))] px-2 py-1 rounded">
                      {code.discountPercent}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <code className="bg-white/[0.08] px-2 py-1 rounded font-mono">
                      {code.code}
                    </code>
                    <button
                      onClick={() => copyToClipboard(`modocriador.com.br/promo/${code.slug}`)}
                      className="text-white/40 hover:text-white transition"
                      title="Copiar link"
                    >
                      <Copy size={14} />
                    </button>
                    <span className="text-xs">
                      modocriador.com.br/promo/{code.slug}
                    </span>
                  </div>
                  {code.description && (
                    <p className="text-xs text-white/40 mt-2">{code.description}</p>
                  )}
                  <div className="text-xs text-white/40 mt-2 space-y-1">
                    {code.validUntil && (
                      <div>Válido até: {new Date(code.validUntil).toLocaleDateString("pt-BR")}</div>
                    )}
                    {code.maxUses && (
                      <div>Usos: {code.usedCount} / {code.maxUses}</div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingId(code.id);
                      setFormData({
                        name: code.name,
                        code: code.code,
                        slug: code.slug,
                        discountPercent: code.discountPercent,
                        description: code.description || "",
                        validUntil: code.validUntil
                          ? new Date(code.validUntil).toISOString().split("T")[0]
                          : "",
                        maxUses: code.maxUses ? String(code.maxUses) : "",
                      });
                      setShowForm(true);
                    }}
                    className="p-2 text-white/60 hover:text-white hover:bg-white/[0.08] rounded transition"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(code.id)}
                    disabled={deleteMutation.isPending}
                    className="p-2 text-white/60 hover:text-red-400 hover:bg-red-500/10 rounded transition disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-white/40">
            <AlertCircle size={32} className="mx-auto mb-2 opacity-20" />
            <p>Nenhum cupom criado ainda</p>
          </div>
        )}
      </div>
    </div>
  );
}
