import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
import { bankAccountsQO, walletBalanceQO, useApi } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { parseBRLToCents } from "@/lib/luzeria/utils";
import type { BankAccount } from "@/lib/luzeria/bank-accounts.functions";

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function relativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "atualizado hoje";
  if (days === 1) return "atualizado ontem";
  if (days < 30) return `atualizado há ${days} dias`;
  return `atualizado em ${new Date(iso).toLocaleDateString("pt-BR")}`;
}

/** Bancos mais usados no Brasil, pré-cadastrados (pedido do Junior,
 * 30/09) — cor de marca de cada um (sem reproduzir a logo, só a cor) e uma
 * sigla mais reconhecível que as 2 primeiras letras do nome. Escolher um
 * aqui preenche nome e cor — dá pra editar os dois antes de salvar (ex:
 * "Nubank PJ"). `match` são outros jeitos comuns de escrever o nome. */
// `logo`: ícone quadrado em public/bancos/ (fundo na cor da marca, símbolo
// centralizado com o mesmo respiro em todos — arquivos enviados pelo Junior
// em 30/09). Sem logo, o ícone é a cor + sigla.
const KNOWN_BANKS: { name: string; color: string; initials: string; match?: string[]; logo?: string }[] = [
  { name: "Nubank", color: "#820AD1", initials: "NU", logo: "/bancos/nubank.png" },
  { name: "Itaú", color: "#FF6200", initials: "IT", match: ["itau"], logo: "/bancos/itau.png" },
  { name: "Bradesco", color: "#CC092F", initials: "BR", logo: "/bancos/bradesco.png" },
  { name: "Banco do Brasil", color: "#0038A8", initials: "BB", logo: "/bancos/banco-do-brasil.png" },
  { name: "Caixa", color: "#005CA9", initials: "CX", logo: "/bancos/caixa.png" },
  { name: "Santander", color: "#EC0000", initials: "SA", logo: "/bancos/santander.png" },
  { name: "Inter", color: "#EA7100", initials: "IN", logo: "/bancos/inter.png" },
  { name: "C6 Bank", color: "#242424", initials: "C6", match: ["c6"], logo: "/bancos/c6-bank.png" },
  { name: "BTG Pactual", color: "#001E61", initials: "BTG", match: ["btg"], logo: "/bancos/btg-pactual.png" },
  { name: "PicPay", color: "#22C25E", initials: "PP", logo: "/bancos/picpay.png" },
  { name: "Mercado Pago", color: "#009EE3", initials: "MP", logo: "/bancos/mercado-pago.png" },
  { name: "PagBank", color: "#00A868", initials: "PB", match: ["pagseguro"], logo: "/bancos/pagbank.png" },
  { name: "Sicoob", color: "#04363F", initials: "SC", logo: "/bancos/sicoob.png" },
  { name: "Sicredi", color: "#3DAA33", initials: "SI", logo: "/bancos/sicredi.png" },
  { name: "Banco Pan", color: "#06B2FC", initials: "PAN", match: ["pan"], logo: "/bancos/banco-pan.png" },
];

/** Cores pra escolher no ícone de uma conta (pedido do Junior, 30/09). */
const COLOR_CHOICES = ["#820AD1", "#EC7000", "#CC092F", "#0038A8", "#005CA9", "#009EE3", "#11C76F", "#3FA110", "#003641", "#242424", "#B79CFF", "#F5A623"];

/** Cor do avatar: a escolhida pela agência; senão a oficial se o nome bater
 * com um banco conhecido (mesmo com sufixo, tipo "Nubank PJ"); senão uma
 * cor determinística a partir do nome. */
const AVATAR_COLORS = ["#FF6B35", "#EC7000", "#6FA4FF", "#B79CFF", "#D1D82F", "#5BA88A"];
function normalize(s: string) {
  return s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function knownBank(name: string) {
  const n = normalize(name);
  return KNOWN_BANKS.find((b) => [b.name, ...(b.match ?? [])].some((k) => {
    const key = normalize(k);
    // Siglas curtas ("pan", "c6") só batem como palavra inteira — senão
    // "Panamericano"/"Japan" viravam Banco Pan.
    return key.length <= 3 ? new RegExp(`(^|\\s)${key}(\\s|$)`).test(n) : n.includes(key);
  }));
}
function avatarColor(name: string, color?: string | null): string {
  if (color) return color;
  const known = knownBank(name);
  if (known) return known.color;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}
function avatarInitials(name: string): string {
  return knownBank(name)?.initials ?? name.slice(0, 2).toUpperCase();
}
/** Texto escuro em cor clara (ex: amarelo), branco no resto. */
function avatarTextColor(bg: string): string {
  const n = parseInt(bg.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#0D0D0D" : "#FFFFFF";
}

function BankAvatar({ name, color }: { name: string; color?: string | null }) {
  const logo = knownBank(name)?.logo;
  if (logo) return <img src={logo} alt={name} className="h-8 w-8 rounded-lg shrink-0 object-cover" loading="lazy" />;
  const bg = avatarColor(name, color);
  const initials = avatarInitials(name);
  return (
    <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-extrabold shrink-0 ${initials.length > 2 ? "text-[9px]" : "text-[11px]"}`}
      style={{ background: bg, color: avatarTextColor(bg) }}>
      {initials}
    </div>
  );
}

const inp = "w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]";

/** Saldo pode ser zero ou negativo (conta no vermelho), diferente de um
 * lançamento — por isso trata o sinal e o zero antes do parse comum. */
function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (/^-?\s*0+([.,]0+)?$/.test(trimmed)) return 0;
  const negative = trimmed.startsWith("-");
  const cents = parseBRLToCents(trimmed.replace(/^-/, ""));
  if (cents == null) return null;
  return negative ? -cents : cents;
}

/** "Saldo em banco" (Financeiro): registro MANUAL de contas bancárias da
 * agência — sem nenhuma integração bancária real, é só uma anotação que a
 * própria agência atualiza de vez em quando. Pedido do Junior junto da
 * reformulação de "Pagamentos" → "Financeiro". */
export function BankAccountsSection() {
  const { data: allAccounts = [] } = useQuery(bankAccountsQO());
  const accounts = allAccounts.filter((a) => !a.archived);
  const { data: wallet } = useQuery(walletBalanceQO());
  const walletCents = wallet?.balanceCents ?? 0;
  const api = useApi();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [color, setColor] = useState<string | null>(null);

  const totalCents = accounts.reduce((s, a) => s + a.balanceCents, 0);

  function startEdit(a: BankAccount) {
    setEditingId(a.id);
    setName(a.name);
    setBalance((a.balanceCents / 100).toFixed(2).replace(".", ","));
    setColor(a.color ?? avatarColor(a.name));
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
    setName("");
    setBalance("");
    setColor(null);
  }

  function save() {
    const cents = parseAmount(balance);
    if (!name.trim() || cents == null) { toast.error("Preencha o nome do banco e o saldo."); return; }
    if (editingId) {
      api.updateBankAccount.mutate({ data: { id: editingId, name: name.trim(), balanceCents: cents, color } }, { onSuccess: cancel });
    } else {
      api.addBankAccount.mutate({ data: { name: name.trim(), balanceCents: cents, color } }, { onSuccess: cancel });
    }
  }

  async function remove(a: BankAccount) {
    if (await requestConfirm(`Remover "${a.name}" do saldo em banco? Os lançamentos que já usaram essa conta continuam no histórico.`, { danger: true })) {
      api.removeBankAccount.mutate({ data: { id: a.id } });
    }
  }

  return (
    <div className="bg-card border border-foreground/7 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-bold text-foreground">Saldo em banco</div>
        <button
          onClick={() => { cancel(); setAdding(true); }}
          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-md"
          style={{ background: "rgba(var(--lz-brand-rgb),0.14)", color: "var(--lz-accent-ink)" }}
        >
          <Plus size={12} /> Nova conta
        </button>
      </div>
      <p className="text-[11px] text-foreground/35 mb-3">Atualizado à mão por vocês — não é conectado ao banco de verdade, é só um registro.</p>

      {(adding || editingId) && (
        <div className="rounded-lg p-3 mb-3 space-y-2" style={{ background: "color-mix(in srgb, var(--foreground) 3%, transparent)", border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)" }}>
          {!editingId && (
            <div className="flex flex-wrap gap-1.5">
              {KNOWN_BANKS.map((b) => (
                <button
                  key={b.name}
                  onClick={() => { setName(b.name); setColor(b.color); }}
                  className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1 text-[11px] font-semibold text-foreground/70 hover:text-foreground transition"
                  style={{ background: "color-mix(in srgb, var(--foreground) 5%, transparent)", border: "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)" }}
                >
                  {b.logo
                    ? <img src={b.logo} alt="" className="h-4 w-4 rounded-full" />
                    : <span className="h-4 w-4 rounded-full" style={{ background: b.color }} />}
                  {b.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <BankAvatar name={name || "?"} color={color} />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Nubank PJ" className={inp} />
          </div>
          <input value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="Saldo atual (R$)" className={inp} />
          {knownBank(name)?.logo ? (
            <p className="text-[10.5px] text-foreground/40">Usa a logo do banco como ícone.</p>
          ) : <div>
            <span className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">Cor do ícone</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {COLOR_CHOICES.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Cor ${c}`}
                  className="h-6 w-6 rounded-full transition"
                  style={{ background: c, boxShadow: color?.toLowerCase() === c.toLowerCase() ? "0 0 0 2px var(--card), 0 0 0 4px var(--foreground)" : undefined }} />
              ))}
              {/* Qualquer outra cor, pelo seletor nativo do navegador. */}
              <label className="h-6 px-2 rounded-full inline-flex items-center text-[10.5px] font-semibold text-foreground/60 hover:text-foreground cursor-pointer"
                style={{ background: "color-mix(in srgb, var(--foreground) 6%, transparent)" }}>
                Outra
                <input type="color" value={color ?? avatarColor(name || "?")} onChange={(e) => setColor(e.target.value.toUpperCase())} className="sr-only" />
              </label>
            </div>
          </div>}
          <div className="flex justify-end gap-2">
            <button onClick={cancel} className="text-xs text-foreground/50 hover:text-foreground px-2 py-1.5">Cancelar</button>
            <button onClick={save} disabled={api.addBankAccount.isPending || api.updateBankAccount.isPending} className="lz-btn-primary text-xs px-4 py-1.5 rounded-md disabled:opacity-50">
              Salvar
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-3">
          {/* Carteira/espécie não é uma conta cadastrável (não dá pra editar
           * nem remover) — é só o total acumulado das entradas/saídas
           * lançadas sem banco escolhido, somado na hora (ver
           * getWalletBalance em cash-flow.functions.ts). Pedido do Junior
           * (30/09) pra aparecer junto dos bancos, com ícone de carteira. */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-dashed border-foreground/15" style={{ background: "color-mix(in srgb, var(--foreground) 2.5%, transparent)" }}>
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(var(--lz-brand-rgb),0.16)" }}>
              <Wallet size={15} style={{ color: "var(--lz-accent-ink)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-bold text-foreground truncate">Carteira / espécie</div>
              <div className="text-[10.5px] text-foreground/40">Soma das entradas e saídas sem banco</div>
            </div>
            <div className="text-sm font-extrabold text-foreground whitespace-nowrap">{money(walletCents)}</div>
          </div>
          {accounts.map((a) => (
            <div key={a.id} className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg" style={{ background: "color-mix(in srgb, var(--foreground) 2.5%, transparent)" }}>
              <BankAvatar name={a.name} color={a.color} />
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-bold text-foreground truncate">{a.name}</div>
                <div className="text-[10.5px] text-foreground/40">{relativeDate(a.updatedAt)}</div>
              </div>
              <div className="text-sm font-extrabold text-foreground whitespace-nowrap">{money(a.balanceCents)}</div>
              <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                <button onClick={() => startEdit(a)} className="text-foreground/30 hover:text-[var(--lz-accent-ink)] transition p-0.5"><Pencil size={13} /></button>
                <button onClick={() => remove(a)} className="text-foreground/30 hover:text-red-400 transition p-0.5"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
      </div>

      {accounts.length > 0 && (
        <div className="flex items-center justify-between pt-3 border-t border-foreground/6">
          <div className="text-[12.5px] text-foreground/50">Total em banco</div>
          <div className="text-lg font-extrabold text-foreground">{money(totalCents)}</div>
        </div>
      )}
    </div>
  );
}
