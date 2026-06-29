## O que vai mudar

Hoje o app já tem integração nativa com Google Drive via conector da Lovable (autorização compartilhada — não precisa de novo OAuth) e uma tabela `client_drive_map` que guarda a pasta de entregas por cliente. Vamos expor esse mapeamento direto no Perfil do Cliente, deixar o admin colar o link da pasta correta, e fazer os uploads/anexos sempre caírem em `[Pasta de Entregas do Cliente] / [Mês Ano] / arquivo`.

> Observação: a aba "Integrações → Conectar Google Drive" descrita no pedido não é necessária neste app. A conexão com o Drive já é gerida pela Lovable (uma única autorização da agência, já ativa). Mantemos isso transparente; se algum dia o token cair, o erro do gateway aparece no painel de uploads.

---

## 1. Perfil do Cliente — campo "Pasta de Entregas (Drive)"

Em `src/components/luzeria/ClientFichaPanel.tsx`, dentro da aba já existente do cliente, nova seção logo abaixo de **Sobre**:

```text
PASTA DE ENTREGAS (DRIVE)        ← label 10px uppercase #C8D44E
[ https://drive.google.com/drive/folders/ABC123… ]  [Abrir pasta ↗]  [Salvar]
"Todos os uploads desse cliente vão para essa pasta, em subpasta [Mês Ano]."
```

- Input aceita link completo ou ID puro; é normalizado no servidor para um `folderId`.
- Botão **Abrir pasta ↗** usa `window.open(url, "_blank", "noopener,noreferrer")` — só habilitado quando há valor salvo.
- Botão **Salvar** chama nova server fn `setClientDeliveriesFolder`.
- Visível para Master, Setor e Membro; **editável** apenas por Master e Setor (Membro vê apenas o link e o botão de abrir, sem input editável).
- Se o admin colar um link inválido, toast vermelho "Link/ID do Drive inválido".

## 2. Upload direto para a pasta correta

Toda anexação/upload (`attachDriveFile`, `uploadDriveFile` em `src/lib/luzeria/drive.functions.ts`) passa a:

1. Buscar `client_drive_map.deliveries_folder_id` daquele cliente.
2. Se preenchido: usar como pai e garantir subpasta `[Mês Ano]` (ex.: "Junho 2026") via `files.list` → senão `files.create` (mimeType `application/vnd.google-apps.folder`).
3. Subir/mover o arquivo para essa subpasta com `supportsAllDrives=true`.
4. Se **não** estiver preenchido: a server fn lança erro estruturado `{ code: "deliveries_folder_missing", clientId }`. O front (`FilesSection.tsx`) intercepta e mostra:

```text
⚠ Configure a pasta de entregas no Perfil do Cliente antes de fazer upload.
   [Abrir perfil do cliente]
```

O botão abre a ficha do cliente (já existe `useUI().openFicha(clientId)`).

## 3. Feedback visual

`FilesSection.tsx` já tem spinner durante upload ("Enviando…"), preview ao concluir e link "Abrir no Drive ↗". Vamos:
- Trocar texto para **"Enviando para o Drive…"** com spinner.
- Em caso de erro genérico do Drive, exibir mensagem clara + botão **Tentar novamente** que reabre o seletor de arquivos.
- Em caso de erro `deliveries_folder_missing`, mostrar o aviso com link para abrir a ficha (item 2).

---

## Detalhes técnicos

### Banco
Nenhuma migração nova. Reutilizamos `public.client_drive_map.deliveries_folder_id` (já existe, RLS configurada).

### Servidor — `src/lib/luzeria/drive.functions.ts`
- Nova fn pública `setClientDeliveriesFolder({ clientId, folderIdOrUrl })` (middleware `requireActiveProfile` + checagem `is_admin`):
  - `parseDriveId` no input; valida via `GET /drive/v3/files/{id}?fields=id,name,mimeType` esperando `application/vnd.google-apps.folder`.
  - Upsert em `client_drive_map` setando `drive_folder_id = <folderId>`, `deliveries_folder_id = <folderId>`, `confirmed_by = userId`.
- Nova fn `clearClientDeliveriesFolder({ clientId })` (mesmas permissões) para esvaziar.
- Refactor `monthLabelFromKey` → `monthLabelWithYear(key)` retornando "Junho 2026"; nova chamada usada apenas no novo fluxo (mantém compat com reorganização antiga).
- `resolveTargetFolderForItem`: se o cliente tem `deliveries_folder_id` salvo manualmente (via novo fluxo), usá-lo como pai direto e criar subpasta `[Mês Ano]`. Senão lançar erro `deliveries_folder_missing` (com `clientId` no `cause`) em vez de cair no fallback antigo da pasta raiz — o pedido é que o admin configure explicitamente.
  - Compatibilidade: se `client_drive_map` ainda estiver no formato antigo (`Entregas - <Cliente>` / mês sem ano), continuamos respeitando enquanto a ficha não for re-salva; uma vez que o admin salva via novo campo, passamos para `[Mês Ano]`.

### Front
- `ClientFichaPanel.tsx`: nova `Section` com input controlado, botões Salvar / Abrir, estado pendente com Loader. Usa `useApi()` + nova query `clientDriveFolderQO(clientId)`.
- `src/lib/luzeria/queries.ts`: novo `clientDriveFolderQO` chamando `getClientDeliveriesFolder` (server fn que devolve `{ folderId, webViewUrl } | null`).
- `FilesSection.tsx`: detecta erro com `code === "deliveries_folder_missing"` e renderiza CTA com `useUI().openFicha(clientId)` (recebe `clientId` como prop opcional — `DetailPanel.tsx` já conhece o cliente do item, passamos para baixo).
- `DetailPanel.tsx`: passar `clientId` para `<FilesSection />`.

### Permissões
- Server fn `setClientDeliveriesFolder` faz `supabase.rpc("is_admin", { _user_id: userId })` — só master/setor.
- Conector Google Drive permanece o gerenciado pela Lovable (escopo `drive.file` herdado). Nenhum botão "Conectar" novo.

---

## Arquivos tocados

- `src/lib/luzeria/drive.functions.ts` — novas fns, mudanças em `resolveTargetFolderForItem`, label de mês com ano.
- `src/lib/luzeria/queries.ts` — query options + wrappers em `useApi`.
- `src/components/luzeria/ClientFichaPanel.tsx` — nova seção.
- `src/components/luzeria/FilesSection.tsx` — tratamento do erro + CTA.
- `src/components/luzeria/DetailPanel.tsx` — propagar `clientId` ao `FilesSection`.

Nenhum arquivo existente é renomeado ou removido; toda a lógica anterior (reorganização global, root folder, etc.) continua funcionando.
