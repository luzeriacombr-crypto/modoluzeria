import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit2, Copy, Loader2, AlertCircle, Percent, Link2, Calendar, Users, Gift } from "lucide-react";
import { PromotionCode } from "@/lib/luzeria/types";
import {
  listPromotionCodes,
  createPromotionCode,
  updatePromotionCode,
  deletePromotionCode,
  applyPromotionCodeToOrg,
  listOrgsForPromotion,
} from "@/lib/luzeria/promotion-affiliate.functions";

export function PromotionCodesPanel() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const [applyingPromoId, setApplyingPromoId] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    slug: "",
    discountPercent: 50,
    description: "",
    validUntil: "",
    maxUses: "",
  });

  const { data: orgs = [] } = useQuery({
    queryKey: ["orgsForPromotion"],
    queryFn: () => listOrgsForPromotion(),
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

  const applyMutation = useMutation({
    mutationFn: (data: { promotionCodeId: string; orgId: string }) =>
      applyPromotionCodeToOrg(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotionCodes"] });
      setApplyingPromoId(null);
      setSelectedOrgId("");
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
    <div className="space-y-8">
      {/* Create Form Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-white">Cupons de Promoção</h2>
            <p className="text-sm text-white/50 mt-1">Crie descontos e gere links para compartilhar</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setEditingId(null);
              setShowForm(!showForm);
            }}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-[rgb(var(--lz-brand-rgb))] to-[rgba(var(--lz-brand-rgb),0.8)] hover:opacity-90 rounded-xl font-bold text-[#0D0D0D] transition transform hover:scale-105"
          >
            <Plus size={18} />
            Novo Cupom
          </button>
        </div>

        {showForm && (
          <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-white/15 rounded-2xl p-8 backdrop-blur-sm">
            <h3 className="text-xl font-bold text-white mb-6">
              {editingId ? "✏️ Editar Cupom" : "✨ Criar Novo Cupom"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Row 1 */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase text-white/50 mb-2 tracking-wider">Nome</label>
                  <input
                    type="text"
                    placeholder="ex: Desconto Orim"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-white/[0.08] border border-white/15 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[rgb(var(--lz-brand-rgb))] transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-white/50 mb-2 tracking-wider">Código (cupom)</label>
                  <input
                    type="text"
                    placeholder="ex: ORIM2026"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 bg-white/[0.08] border border-white/15 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[rgb(var(--lz-brand-rgb))] font-mono text-lg transition"
                    required
                  />
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase text-white/50 mb-2 tracking-wider">Slug URL</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/40">modocriador.com.br/promo/</span>
                    <input
                      type="text"
                      placeholder="ex: orim"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                      className="flex-1 px-4 py-3 bg-white/[0.08] border border-white/15 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[rgb(var(--lz-brand-rgb))] transition"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-white/50 mb-2 tracking-wider">Desconto %</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={formData.discountPercent}
                      onChange={(e) => setFormData({ ...formData, discountPercent: Number(e.target.value) })}
                      min="1"
                      max="100"
                      className="flex-1 px-4 py-3 bg-white/[0.08] border border-white/15 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[rgb(var(--lz-brand-rgb))] transition"
                      required
                    />
                    <span className="text-2xl font-black text-[rgb(var(--lz-brand-rgb))]">%</span>
                  </div>
                </div>
              </div>

              {/* Row 3 */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase text-white/50 mb-2 tracking-wider">Limite de Usos (opcional)</label>
                  <input
                    type="number"
                    placeholder="ex: 100"
                    value={formData.maxUses}
                    onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                    className="w-full px-4 py-3 bg-white/[0.08] border border-white/15 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[rgb(var(--lz-brand-rgb))] transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-white/50 mb-2 tracking-wider">Válido Até (opcional)</label>
                  <input
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                    className="w-full px-4 py-3 bg-white/[0.08] border border-white/15 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[rgb(var(--lz-brand-rgb))] transition"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase text-white/50 mb-2 tracking-wider">Descrição (opcional)</label>
                <textarea
                  placeholder="Descreva o cupom, benefícios, etc..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-white/[0.08] border border-white/15 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[rgb(var(--lz-brand-rgb))] transition resize-none"
                  rows={3}
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-[rgb(var(--lz-brand-rgb))] to-[rgba(var(--lz-brand-rgb),0.8)] hover:opacity-90 disabled:opacity-50 text-white font-bold rounded-xl transition transform hover:scale-105"
                >
                  {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar Cupom"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    resetForm();
                  }}
                  className="flex-1 px-6 py-3 bg-white/[0.08] hover:bg-white/[0.12] text-white font-bold rounded-xl transition border border-white/10"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* List Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white">
          {codes && codes.length > 0 ? `${codes.length} cupom${codes.length !== 1 ? 's' : ''}` : "Nenhum cupom ainda"}
        </h3>

        {codes && codes.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-4">
            {codes.map((code: PromotionCode) => (
              <div
                key={code.id}
                className="group bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-white/15 rounded-2xl p-6 hover:border-white/30 transition hover:shadow-2xl hover:shadow-[rgb(var(--lz-brand-rgb))]/20"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-black text-white text-lg">{code.name}</h4>
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-[rgb(var(--lz-brand-rgb))]/20 to-[rgba(var(--lz-brand-rgb),0.1)] text-[rgb(var(--lz-brand-rgb))] rounded-lg font-bold text-sm">
                        <Percent size={14} />
                        {code.discountPercent}%
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => setApplyingPromoId(code.id)}
                      className="p-2 text-white/60 hover:text-[rgb(var(--lz-brand-rgb))] hover:bg-[rgb(var(--lz-brand-rgb))]/10 rounded-lg transition"
                      title="Aplicar a agência"
                    >
                      <Gift size={16} />
                    </button>
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
                      className="p-2 text-white/60 hover:text-white hover:bg-white/[0.12] rounded-lg transition"
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(code.id)}
                      disabled={deleteMutation.isPending}
                      className="p-2 text-white/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition disabled:opacity-50"
                      title="Deletar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Code & Link */}
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-white/40 mb-1">Código do Cupom</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-white/[0.08] border border-white/10 rounded-lg font-mono text-white font-bold text-sm">
                        {code.code}
                      </code>
                      <button
                        onClick={() => copyToClipboard(code.code)}
                        className="p-2 text-white/40 hover:text-white hover:bg-white/[0.12] rounded-lg transition"
                        title="Copiar"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase text-white/40 mb-1">Link de Promoção</p>
                    <div className="flex items-center gap-2">
                      <span className="flex-1 px-3 py-2 bg-white/[0.08] border border-white/10 rounded-lg text-white text-xs truncate">
                        modocriador.com.br/promo/{code.slug}
                      </span>
                      <button
                        onClick={() => copyToClipboard(`modocriador.com.br/promo/${code.slug}`)}
                        className="p-2 text-white/40 hover:text-white hover:bg-white/[0.12] rounded-lg transition"
                        title="Copiar link"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {code.description && (
                  <p className="text-sm text-white/60 mt-4 pt-4 border-t border-white/10">{code.description}</p>
                )}

                {/* Metadata */}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/10 text-xs text-white/40">
                  {code.maxUses && (
                    <div className="flex items-center gap-2">
                      <Users size={14} />
                      <span>{code.usedCount}/{code.maxUses} usos</span>
                    </div>
                  )}
                  {code.validUntil && (
                    <div className="flex items-center gap-2">
                      <Calendar size={14} />
                      <span>{new Date(code.validUntil).toLocaleDateString("pt-BR")}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 px-6 bg-white/[0.03] border border-white/10 rounded-2xl">
            <AlertCircle size={48} className="mx-auto mb-4 text-white/20" />
            <p className="text-white/50 text-lg font-medium">Nenhum cupom criado ainda</p>
            <p className="text-white/30 text-sm mt-2">Crie o seu primeiro cupom para começar</p>
          </div>
        )}
      </div>

      {/* Apply Promo Modal */}
      {applyingPromoId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-white/[0.1] to-white/[0.05] border border-white/20 rounded-2xl p-8 max-w-md w-full backdrop-blur-xl">
            <h3 className="text-xl font-bold text-white mb-6">Aplicar Cupom a Agência</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-white/50 mb-2">
                  Selecione a agência
                </label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full px-4 py-3 bg-white/[0.08] border border-white/15 rounded-xl text-white focus:outline-none focus:border-[rgb(var(--lz-brand-rgb))] transition"
                >
                  <option value="">Escolha uma agência...</option>
                  {orgs.map((org: any) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-sm text-white/60">
                O cupom será aplicado à próxima fatura dessa agência.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (selectedOrgId && applyingPromoId) {
                      applyMutation.mutate({
                        promotionCodeId: applyingPromoId,
                        orgId: selectedOrgId,
                      });
                    }
                  }}
                  disabled={!selectedOrgId || applyMutation.isPending}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-[rgb(var(--lz-brand-rgb))] to-[rgba(var(--lz-brand-rgb),0.8)] hover:opacity-90 disabled:opacity-50 text-white font-bold rounded-xl transition"
                >
                  {applyMutation.isPending ? "Aplicando..." : "Aplicar"}
                </button>
                <button
                  onClick={() => {
                    setApplyingPromoId(null);
                    setSelectedOrgId("");
                  }}
                  className="flex-1 px-6 py-3 bg-white/[0.08] hover:bg-white/[0.12] text-white font-bold rounded-xl transition border border-white/10"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
