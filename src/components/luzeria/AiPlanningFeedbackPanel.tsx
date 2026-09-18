import { useQuery } from "@tanstack/react-query";
import { Star, Sparkles, Loader2 } from "lucide-react";
import { aiPlanningFeedbackQO } from "@/lib/luzeria/queries";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Platform-admin only: avaliações de satisfação da prévia de planejamento
 * por IA (feature em beta), de todas as agências. */
export function AiPlanningFeedbackPanel() {
  const { data: rows = [], isLoading } = useQuery(aiPlanningFeedbackQO());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-foreground/40" size={32} />
      </div>
    );
  }

  const avg = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-[var(--lz-accent-ink)]" />
        <h2 className="text-foreground font-semibold">Avaliações da prévia por IA (beta)</h2>
        {rows.length > 0 && (
          <span className="text-foreground/40 text-sm">— {rows.length} avaliação{rows.length > 1 ? "ões" : ""}, média {avg.toFixed(1)}★</span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-12 px-6 bg-foreground/[0.03] border border-foreground/10 rounded-2xl">
          <p className="text-foreground/50 text-sm">Nenhuma avaliação recebida ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="bg-card border border-foreground/7 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{r.orgName}</span>
                  <span className="text-foreground/30 text-xs">· {r.clientName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} size={13} fill={n <= r.rating ? "rgb(var(--lz-brand-rgb))" : "none"}
                        color={n <= r.rating ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 25%, transparent)"} />
                    ))}
                  </div>
                  <span className="text-foreground/30 text-[11px]">{formatDate(r.createdAt)}</span>
                </div>
              </div>
              {r.reason && <p className="text-xs text-foreground/60 mt-2 leading-relaxed">{r.reason}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
