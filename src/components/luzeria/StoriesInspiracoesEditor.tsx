import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/luzeria/Modals";
import { storiesInspiracoesQO, useApi } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import type { StoriesInspiracoes } from "@/lib/luzeria/agency-stories.functions";

/** Listas são editadas como texto, uma por linha — é o formato que o dono
 *  da agência entende sem precisar de um editor de campos repetidos. */
const paraTexto = (itens?: string[]) => (itens ?? []).join("\n");
const paraLista = (texto: string) => texto.split("\n").map((l) => l.trim()).filter(Boolean);

const MODELO_VAZIO: StoriesInspiracoes = {
  dias: [{ titulo: "Segunda-feira", subtitulo: "", objetivo: "", ideias: [], nota: "" }],
  essencia: { titulo: "", itens: [] },
  padrao: { titulo: "Padrão dos stories", itens: [], rodape: [] },
  evitar: [],
};

export function StoriesInspiracoesEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: salva } = useQuery({ ...storiesInspiracoesQO(), enabled: open });
  const { setStoriesInspiracoes } = useApi();
  const [rascunho, setRascunho] = useState<StoriesInspiracoes | null>(null);
  const rotina = rascunho ?? salva ?? MODELO_VAZIO;

  function mudar(patch: Partial<StoriesInspiracoes>) {
    setRascunho({ ...rotina, ...patch });
  }
  function mudarDia(i: number, patch: Partial<StoriesInspiracoes["dias"][number]>) {
    mudar({ dias: rotina.dias.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) });
  }

  function salvar() {
    const limpa: StoriesInspiracoes = {
      dias: rotina.dias
        .filter((d) => d.titulo.trim())
        .map((d) => ({
          titulo: d.titulo.trim(),
          subtitulo: d.subtitulo?.trim() || undefined,
          objetivo: d.objetivo?.trim() || undefined,
          ideias: d.ideias,
          nota: d.nota?.trim() || undefined,
        })),
      essencia: rotina.essencia?.itens.length
        ? { titulo: rotina.essencia.titulo?.trim() || undefined, itens: rotina.essencia.itens }
        : undefined,
      padrao: rotina.padrao?.itens.length
        ? { titulo: rotina.padrao.titulo?.trim() || undefined, itens: rotina.padrao.itens, rodape: rotina.padrao.rodape?.length ? rotina.padrao.rodape : undefined }
        : undefined,
      evitar: rotina.evitar?.length ? rotina.evitar : undefined,
    };
    setStoriesInspiracoes.mutate({ data: { rotina: limpa.dias.length ? limpa : null } }, {
      onSuccess: () => { toast.success("Inspirações salvas."); setRascunho(null); onClose(); },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
    });
  }

  if (!open) return null;
  const rotulo = "text-[10px] uppercase font-bold tracking-wider text-foreground/50";

  return (
    <Modal open={open} onClose={onClose} title="Editar inspirações dos Stories" maxWidthClass="max-w-3xl">
      <p className="text-[11px] text-foreground/40 mb-4 leading-relaxed">
        É isso que a pessoa escalada vê no botão "Ver inspirações" no dia dela. Nas listas, escreva um item por linha.
      </p>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {rotina.dias.map((dia, i) => (
          <div key={i} className="rounded-lg border border-foreground/8 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-foreground/60">Dia {i + 1}</span>
              <button
                onClick={async () => {
                  if (await requestConfirm(`Remover "${dia.titulo || "este dia"}" das inspirações?`, { danger: true })) {
                    mudar({ dias: rotina.dias.filter((_, idx) => idx !== i) });
                  }
                }}
                className="p-1 rounded text-foreground/30 hover:text-red-400 hover:bg-foreground/5"
              ><Trash2 size={13} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className={rotulo}>Dia da semana</span>
                <input value={dia.titulo} onChange={(e) => mudarDia(i, { titulo: e.target.value })}
                  placeholder="Segunda-feira" className="lz-input mt-1" />
              </label>
              <label className="block">
                <span className={rotulo}>Tema</span>
                <input value={dia.subtitulo ?? ""} onChange={(e) => mudarDia(i, { subtitulo: e.target.value })}
                  placeholder="Por dentro da agência" className="lz-input mt-1" />
              </label>
            </div>
            <label className="block">
              <span className={rotulo}>Objetivo</span>
              <input value={dia.objetivo ?? ""} onChange={(e) => mudarDia(i, { objetivo: e.target.value })}
                placeholder="Mostrar a rotina e a cultura de trabalho." className="lz-input mt-1" />
            </label>
            <label className="block">
              <span className={rotulo}>Ideias (uma por linha)</span>
              <textarea value={paraTexto(dia.ideias)} onChange={(e) => mudarDia(i, { ideias: paraLista(e.target.value) })}
                rows={5} className="lz-input mt-1 resize-y" placeholder={"Bom dia da equipe.\nAgenda da semana."} />
            </label>
            <label className="block">
              <span className={rotulo}>Observação do dia</span>
              <input value={dia.nota ?? ""} onChange={(e) => mudarDia(i, { nota: e.target.value })}
                placeholder="Tudo em vídeos rápidos." className="lz-input mt-1" />
            </label>
          </div>
        ))}

        <button
          onClick={() => mudar({ dias: [...rotina.dias, { titulo: "", subtitulo: "", objetivo: "", ideias: [], nota: "" }] })}
          className="lz-btn-ghost text-xs px-3 py-2 rounded-md inline-flex items-center gap-1.5"
        ><Plus size={13} /> Adicionar dia</button>

        <div className="rounded-lg border border-foreground/8 p-3.5 space-y-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-foreground/60">A essência</span>
          <label className="block">
            <span className={rotulo}>Frase principal</span>
            <input
              value={rotina.essencia?.titulo ?? ""}
              onChange={(e) => mudar({ essencia: { titulo: e.target.value, itens: rotina.essencia?.itens ?? [] } })}
              placeholder="Cada dia comunica um valor da agência." className="lz-input mt-1" />
          </label>
          <label className="block">
            <span className={rotulo}>Um por linha, no formato <code>Dia: o que ele comunica</code></span>
            <textarea
              value={(rotina.essencia?.itens ?? []).map((it) => `${it.dia}: ${it.texto}`).join("\n")}
              onChange={(e) => mudar({
                essencia: {
                  titulo: rotina.essencia?.titulo,
                  itens: paraLista(e.target.value).map((l) => {
                    const corte = l.indexOf(":");
                    return corte > 0
                      ? { dia: l.slice(0, corte).trim(), texto: l.slice(corte + 1).trim() }
                      : { dia: l.trim(), texto: "" };
                  }).filter((it) => it.dia && it.texto),
                },
              })}
              rows={3} className="lz-input mt-1 resize-y"
              placeholder="Segunda: Somos organizados e apaixonados pelo que fazemos." />
          </label>
        </div>

        <div className="rounded-lg border border-foreground/8 p-3.5 space-y-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-foreground/60">Padrão dos stories</span>
          <label className="block">
            <span className={rotulo}>Regras (uma por linha)</span>
            <textarea
              value={paraTexto(rotina.padrao?.itens)}
              onChange={(e) => mudar({ padrao: { titulo: rotina.padrao?.titulo ?? "Padrão dos stories", itens: paraLista(e.target.value), rodape: rotina.padrao?.rodape } })}
              rows={4} className="lz-input mt-1 resize-y" placeholder={"5 a 8 stories em sequência.\nMostrar pessoas, não apenas telas."} />
          </label>
          <label className="block">
            <span className={rotulo}>Rodapé — fonte, emojis etc. (uma por linha)</span>
            <textarea
              value={paraTexto(rotina.padrao?.rodape)}
              onChange={(e) => mudar({ padrao: { titulo: rotina.padrao?.titulo ?? "Padrão dos stories", itens: rotina.padrao?.itens ?? [], rodape: paraLista(e.target.value) } })}
              rows={2} className="lz-input mt-1 resize-y" placeholder="Fonte principal: Classic." />
          </label>
        </div>

        <div className="rounded-lg border p-3.5 space-y-2.5" style={{ borderColor: "rgba(255,107,107,0.25)" }}>
          <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#FF6B6B" }}>Evitar</span>
          <textarea
            value={paraTexto(rotina.evitar)}
            onChange={(e) => mudar({ evitar: paraLista(e.target.value) })}
            rows={4} className="lz-input resize-y" placeholder={"Stories sem contexto.\nVídeos tremidos ou com áudio ruim."} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-4 mt-1 border-t border-foreground/8">
        <button onClick={() => { setRascunho(null); onClose(); }} className="px-3 py-2 text-sm text-foreground/60 hover:text-foreground">Cancelar</button>
        <button onClick={salvar} disabled={setStoriesInspiracoes.isPending}
          className="lz-btn-primary text-xs px-4 py-2 rounded-md disabled:opacity-50">
          {setStoriesInspiracoes.isPending ? "Salvando…" : "Salvar inspirações"}
        </button>
      </div>
    </Modal>
  );
}
