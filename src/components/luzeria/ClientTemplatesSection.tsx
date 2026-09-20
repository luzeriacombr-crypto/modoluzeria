import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, Wand2 } from "lucide-react";
import {
  clientTemplatesQO,
  clientCategoriesQO,
  profilesQO,
  useApi,
  useMe,
} from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import type { ClientTemplate } from "@/lib/luzeria/client-templates.functions";

// Mesmas categorias fixas da barra lateral (ver CATEGORY_ORDER em
// Sidebar.tsx) — as customizadas da agência entram depois delas.
const CATEGORIAS_FIXAS = ["Social Media", "Pack Digital", "Avulsos"] as const;

/**
 * "Modelo de cliente": o que o sistema cria sozinho quando a agência abre
 * um cliente novo daquela categoria. Sem modelo configurado, vale o padrão
 * histórico (6 posts + 6 reels, e Avulsos nasce vazio).
 */
export function ClientTemplatesSection() {
  const me = useMe().data;
  const podeEditar = me?.role === "master" || me?.role === "setor";
  const { data: templates = [] } = useQuery(clientTemplatesQO());
  const { data: categoriasDaAgencia = [] } = useQuery(clientCategoriesQO());
  const { data: profiles = [] } = useQuery(profilesQO());
  const { upsertClientTemplate, deleteClientTemplate } = useApi();
  const [editando, setEditando] = useState<string | null>(null);

  const categorias = [
    ...CATEGORIAS_FIXAS,
    ...categoriasDaAgencia
      .map((c: any) => c.name)
      .filter((n: string) => !CATEGORIAS_FIXAS.includes(n as any)),
  ];

  function descrever(categoria: string, t: ClientTemplate | undefined) {
    if (!t) {
      return categoria === "Avulsos"
        ? "Padrão: nasce sem nenhum item"
        : "Padrão: 6 posts + 6 reels";
    }
    const partes = [
      `${t.postsCount} post${t.postsCount === 1 ? "" : "s"}`,
      `${t.reelsCount} reel${t.reelsCount === 1 ? "" : "s"}`,
    ];
    if (t.welcomeMessage) partes.push("mensagem de boas-vindas");
    const responsavel = profiles.find((p: any) => p.id === t.defaultAssigneeId)?.name;
    if (responsavel) partes.push(`responsável: ${responsavel}`);
    return partes.join(" · ");
  }

  return (
    <div>
      <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-1.5 flex items-center gap-1.5">
        <Wand2 size={12} /> Modelos de cliente
      </h2>
      <p className="text-[11px] text-foreground/40 mb-3 leading-relaxed">
        O que o sistema cria sozinho quando você abre um cliente novo de cada categoria.
      </p>
      <div className="bg-card rounded-lg overflow-hidden">
        {categorias.map((categoria) => {
          const t = templates.find((x) => x.category === categoria);
          if (editando === categoria) {
            return (
              <ModeloForm
                key={categoria}
                categoria={categoria}
                inicial={t}
                profiles={profiles}
                onCancel={() => setEditando(null)}
                onSubmit={(payload) => {
                  upsertClientTemplate
                    .mutateAsync({ data: { category: categoria, ...payload } })
                    .then(() => {
                      setEditando(null);
                      toast.success("Modelo salvo.");
                    })
                    .catch((e: any) => toast.error(e?.message ?? "Erro ao salvar o modelo"));
                }}
              />
            );
          }
          return (
            <div
              key={categoria}
              className="flex items-center gap-3 px-5 py-3.5 border-b border-foreground/5 last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-foreground/85 font-semibold">{categoria}</div>
                <div
                  className={`text-[11px] mt-0.5 ${t ? "text-foreground/50" : "text-foreground/30"}`}
                >
                  {descrever(categoria, t)}
                </div>
              </div>
              {podeEditar && (
                <>
                  <button
                    onClick={() => setEditando(categoria)}
                    className="p-1.5 rounded text-foreground/40 hover:text-foreground hover:bg-foreground/5 shrink-0"
                  >
                    <Pencil size={13} />
                  </button>
                  {t && (
                    <button
                      onClick={async () => {
                        if (
                          await requestConfirm(`Voltar "${categoria}" pro padrão do sistema?`, {
                            danger: true,
                          })
                        ) {
                          deleteClientTemplate.mutate({ data: { id: t.id } });
                        }
                      }}
                      className="p-1.5 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5 shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ModeloPayload = {
  postsCount: number;
  reelsCount: number;
  welcomeMessage: string | null;
  defaultAssigneeId: string | null;
};

function ModeloForm({
  categoria,
  inicial,
  profiles,
  onCancel,
  onSubmit,
}: {
  categoria: string;
  inicial: ClientTemplate | undefined;
  profiles: any[];
  onCancel: () => void;
  onSubmit: (payload: ModeloPayload) => void;
}) {
  const [posts, setPosts] = useState(
    String(inicial?.postsCount ?? (categoria === "Avulsos" ? 0 : 6)),
  );
  const [reels, setReels] = useState(
    String(inicial?.reelsCount ?? (categoria === "Avulsos" ? 0 : 6)),
  );
  const [mensagem, setMensagem] = useState(inicial?.welcomeMessage ?? "");
  const [responsavel, setResponsavel] = useState(inicial?.defaultAssigneeId ?? "");

  const num = (v: string) => Math.max(0, Math.min(60, Number(v) || 0));

  return (
    <div className="px-5 py-4 border-b border-foreground/5 last:border-b-0 space-y-3">
      <div className="text-sm font-semibold text-foreground">{categoria}</div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] uppercase font-bold tracking-wider text-foreground/50">
            Posts por mês
          </span>
          <input
            type="number"
            min={0}
            max={60}
            value={posts}
            onChange={(e) => setPosts(e.target.value)}
            className="lz-input mt-1.5"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase font-bold tracking-wider text-foreground/50">
            Reels por mês
          </span>
          <input
            type="number"
            min={0}
            max={60}
            value={reels}
            onChange={(e) => setReels(e.target.value)}
            className="lz-input mt-1.5"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-[10px] uppercase font-bold tracking-wider text-foreground/50">
          Mensagem de boas-vindas (opcional) — use {"{cliente}"} pro nome
        </span>
        <textarea
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          rows={3}
          placeholder="Oi! Bem-vindo(a), {cliente}. Já preparei tudo por aqui…"
          className="lz-input mt-1.5 resize-y"
        />
        <span className="text-[10px] text-foreground/35 mt-1 block">
          Chega como notificação pra você, pronta pra copiar e mandar — o sistema não envia nada
          sozinho.
        </span>
      </label>
      <label className="block">
        <span className="text-[10px] uppercase font-bold tracking-wider text-foreground/50">
          Responsável padrão dos itens
        </span>
        <select
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value)}
          className="lz-input mt-1.5"
        >
          <option value="">Ninguém</option>
          {profiles.map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() =>
            onSubmit({
              postsCount: num(posts),
              reelsCount: num(reels),
              welcomeMessage: mensagem.trim() || null,
              defaultAssigneeId: responsavel || null,
            })
          }
          className="lz-btn-primary text-xs px-4 py-2 rounded-md"
        >
          Salvar modelo
        </button>
        <button onClick={onCancel} className="lz-btn-ghost text-xs px-4 py-2 rounded-md">
          Cancelar
        </button>
      </div>
    </div>
  );
}
