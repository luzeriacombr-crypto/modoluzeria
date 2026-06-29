## Renomear "Bloqueados" → "Travados (precisam de ação)"

Mudança apenas de rótulo visível, sem mexer no status do banco (`BLOQUEADO` continua igual internamente — nenhum dado se perde).

### Onde troca o texto

| Local | Antes | Depois |
|---|---|---|
| Card no Dashboard ("Saúde da Operação") | "Bloqueados" | "Travados" + sublinha "precisam de ação" / "tudo fluindo" |
| Aba em Configurações → Relatório | "Bloqueios" | "Travados" |
| Status no pipeline / detalhe / sidebar | "Bloqueado" | "Travado" |
| Motivo do bloqueio (campo no DetailPanel) | "Motivo do bloqueio" | "Motivo do travamento" |
| Card de cliente (ClientFichaPanel) | "Bloqueados" | "Travados" |

### Arquivos tocados
- `src/lib/luzeria/types.ts` — `STATUS_META.BLOQUEADO.label` vira `"Travado"`.
- `src/components/luzeria/AdminDashboard.tsx` — label e sublinha do card.
- `src/components/luzeria/ReportsTab.tsx` — label da aba.
- `src/components/luzeria/DetailPanel.tsx` — label da seção de motivo.
- `src/components/luzeria/ClientFichaPanel.tsx` — label do contador.

### Não muda
- Chave do status no banco continua `BLOQUEADO` (nenhuma migration).
- Cor (vermelho) e ícone (Ban) ficam iguais.
- Lógica de contagem, notificações, RLS — tudo intacto.

Confirma esse rótulo ("Travados" / "Travado") ou prefere outro (ex.: "Parados", "Empacados", "Em espera")?
