import { useQuery } from "@tanstack/react-query";
import { Loader2, Video, Mail, MessageCircle } from "lucide-react";
import { demoRequestsQO } from "@/lib/luzeria/queries";

function relativeLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}

export function DemoRequestsPanel() {
  const { data: requests = [], isLoading } = useQuery(demoRequestsQO());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin text-white/40" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Video size={16} className="text-[rgb(var(--lz-brand-rgb))]" />
        <h2 className="text-white font-semibold">Pedidos de Demonstração</h2>
        <span className="text-white/40 text-sm">— {requests.length}</span>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-8 px-6 bg-white/[0.03] border border-white/10 rounded-2xl">
          <p className="text-white/50 text-sm">Ninguém pediu demonstração ainda.</p>
        </div>
      ) : (
        <div className="bg-[#161616] border border-white/[0.07] rounded-xl overflow-hidden divide-y divide-white/[0.05]">
          {requests.map((r: any) => {
            const digits = (r.phone ?? "").replace(/\D/g, "");
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 flex-wrap">
                <div className="flex-1 min-w-[160px]">
                  <div className="text-white font-medium text-sm">{r.name}</div>
                  <div className="text-white/40 text-xs">{relativeLabel(r.created_at)}</div>
                </div>
                <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition">
                  <Mail size={13} /> {r.email}
                </a>
                {digits && (
                  <a
                    href={`https://wa.me/55${digits}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full text-black shrink-0"
                    style={{ backgroundColor: "#25D366" }}
                  >
                    <MessageCircle size={13} /> Chamar no WhatsApp
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
