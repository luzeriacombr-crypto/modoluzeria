import { useQuery } from "@tanstack/react-query";
import { Lightbulb, Check, X, Sparkles } from "lucide-react";
import { Modal } from "@/components/luzeria/Modals";
import { storiesInspiracoesQO } from "@/lib/luzeria/queries";

/**
 * "Ver inspirações" — a rotina de stories da agência, pra quem está
 * escalado no dia não começar do zero. O conteúdo vem da própria agência
 * (orgs.stories_inspirations); sem rotina cadastrada, nada disso aparece.
 */
export function StoriesInspiracoesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: rotina } = useQuery({ ...storiesInspiracoesQO(), enabled: open });

  // Destaca a coluna do dia de hoje quando o título bate com o dia da semana.
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long" });

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Inspirações pros Stories" maxWidthClass="max-w-4xl">
      {!rotina ? (
        <p className="text-sm text-foreground/50 py-6 text-center">
          Sua agência ainda não cadastrou uma rotina de stories.
        </p>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            {rotina.dias.map((dia) => {
              const eHoje = dia.titulo.toLowerCase().startsWith(hoje.split("-")[0].toLowerCase());
              return (
                <div
                  key={dia.titulo}
                  className="rounded-xl border p-3.5"
                  style={{
                    borderColor: eHoje ? "rgba(var(--lz-brand-rgb),0.45)" : "color-mix(in srgb, var(--foreground) 10%, transparent)",
                    backgroundColor: eHoje ? "rgba(var(--lz-brand-rgb),0.06)" : "color-mix(in srgb, var(--foreground) 3%, transparent)",
                  }}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <span className="mt-1 h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }} />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-foreground leading-tight">{dia.titulo}</div>
                      {dia.subtitulo && <div className="text-[11px] text-foreground/50 italic mt-0.5">"{dia.subtitulo}"</div>}
                    </div>
                    {eHoje && (
                      <span className="ml-auto text-[9px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0"
                        style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>hoje</span>
                    )}
                  </div>

                  {dia.objetivo && (
                    <>
                      <div className="text-[9.5px] uppercase font-bold tracking-wider text-[var(--lz-accent-ink)] mb-1">Objetivo</div>
                      <p className="text-xs text-foreground/75 leading-relaxed mb-3">{dia.objetivo}</p>
                    </>
                  )}

                  <ul className="space-y-1.5">
                    {dia.ideias.map((ideia) => (
                      <li key={ideia} className="flex items-start gap-2 text-xs text-foreground/70 leading-relaxed">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-sm shrink-0" style={{ backgroundColor: "rgba(var(--lz-brand-rgb),0.7)" }} />
                        {ideia}
                      </li>
                    ))}
                  </ul>

                  {dia.nota && (
                    <p className="text-[11px] text-foreground/50 italic leading-relaxed mt-3 pt-3 border-t border-foreground/6">{dia.nota}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {rotina.essencia && (
              <div className="rounded-xl border border-foreground/8 p-3.5">
                <div className="text-[9.5px] uppercase font-bold tracking-wider text-[var(--lz-accent-ink)] mb-2 flex items-center gap-1.5">
                  <Sparkles size={11} /> A essência
                </div>
                {rotina.essencia.titulo && <p className="text-xs text-foreground/80 font-semibold mb-2.5">{rotina.essencia.titulo}</p>}
                <div className="space-y-2">
                  {rotina.essencia.itens.map((it) => (
                    <div key={it.dia}>
                      <div className="text-[9.5px] uppercase font-bold tracking-wider text-foreground/40">{it.dia}</div>
                      <p className="text-xs text-foreground/70 leading-relaxed">{it.texto}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rotina.padrao && (
              <div className="rounded-xl border border-foreground/8 p-3.5">
                <div className="text-[9.5px] uppercase font-bold tracking-wider text-[var(--lz-accent-ink)] mb-2 flex items-center gap-1.5">
                  <Check size={11} /> {rotina.padrao.titulo ?? "Padrão dos stories"}
                </div>
                <ul className="space-y-1.5">
                  {rotina.padrao.itens.map((it) => (
                    <li key={it} className="flex items-start gap-2 text-xs text-foreground/70 leading-relaxed">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-sm shrink-0" style={{ backgroundColor: "rgba(var(--lz-brand-rgb),0.7)" }} />
                      {it}
                    </li>
                  ))}
                </ul>
                {rotina.padrao.rodape?.map((r) => (
                  <p key={r} className="text-[11px] text-foreground/45 leading-relaxed mt-2">{r}</p>
                ))}
              </div>
            )}

            {rotina.evitar && rotina.evitar.length > 0 && (
              <div className="rounded-xl border p-3.5" style={{ borderColor: "rgba(255,107,107,0.25)" }}>
                <div className="text-[9.5px] uppercase font-bold tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "#FF6B6B" }}>
                  <X size={11} /> Evitar
                </div>
                <ul className="space-y-1.5">
                  {rotina.evitar.map((it) => (
                    <li key={it} className="flex items-start gap-2 text-xs text-foreground/70 leading-relaxed">
                      <X size={11} className="mt-0.5 shrink-0" style={{ color: "rgba(255,107,107,0.8)" }} />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Botão que abre as inspirações — só aparece se a agência tiver rotina. */
export function StoriesInspiracoesButton({ onClick }: { onClick: () => void }) {
  const { data: rotina } = useQuery(storiesInspiracoesQO());
  if (!rotina) return null;
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-bold transition-opacity hover:opacity-90"
      style={{ backgroundColor: "rgba(var(--lz-brand-rgb),0.15)", color: "var(--lz-accent-ink)" }}
    >
      <Lightbulb size={12} /> Ver inspirações
    </button>
  );
}
