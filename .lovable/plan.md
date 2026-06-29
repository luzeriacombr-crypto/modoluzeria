# Integração com Google Drive (conector nativo Lovable)

## Por que isso resolve

- **O erro `ERR_BLOCKED_BY_RESPONSE`** acontece porque o Google bloqueia abrir o Drive dentro de iframe (no preview do Lovable). No site publicado já abre direto. Mesmo assim, vamos garantir que abertura sempre use `window.open(url, '_blank', 'noopener,noreferrer')` e tenha botão de "copiar link" como fallback.
- **Custo / plano Free:** os arquivos **continuam no SEU Google Drive** (não consomem Storage do Lovable). Cada chamada à API consome um pouquinho de crédito (poucos centavos por mês no uso real), bem abaixo da cota gratuita mensal.
- **Por ser app interno** (uso exclusivo da equipe), faz total sentido usar **uma conta Google da agência** conectada uma vez. Todos do time veem os mesmos arquivos via app, sem precisar logar individualmente no Google.

## O que muda na interface

### Em cada item (Post / Reel / Outros / Avulso)
No painel de detalhe, substituo o campo único "Link do Drive" por uma **seção "Arquivos"** com:
- Botão **"Anexar do Drive"** → abre um seletor (busca arquivo/pasta no Drive da agência por nome).
- Botão **"Colar link"** → mantém o jeito atual de colar URL do Drive (compatibilidade com itens antigos).
- Botão **"Enviar do computador"** → faz upload direto pro Drive da agência via API, dentro de uma pasta organizada (ex: `Luzeria App/{Cliente}/{Mês}/{Item}`). O arquivo fica no SEU Drive, não no Lovable.
- Lista dos arquivos anexados ao item com: thumbnail (quando o Drive fornece), nome, tipo (ícone de imagem/vídeo/pasta/PDF), botão "Abrir no Drive" e botão remover.

### Onde já mostra link hoje
- Lista compacta (linha de cada Post/Reel): ícone do Drive vira chip com nº de arquivos ("3 arquivos") e abre o painel.
- Migração: links antigos do campo `driveLink` viram o primeiro item da lista de arquivos automaticamente. Nada é perdido.

## Detalhes técnicos

### 1. Conector
- Solicito linkar o conector **Google Drive** (`google_drive`) — você autoriza com a conta Google da agência uma vez. As credenciais ficam guardadas no Lovable, ninguém do time precisa logar.

### 2. Banco (1 migration)
Nova tabela `item_files`:
```text
id uuid pk
item_id uuid fk → content_items(id) on delete cascade
drive_file_id text         -- ID do arquivo no Drive
name text
mime_type text
icon_url text null         -- iconLink do Drive
thumbnail_url text null    -- thumbnailLink do Drive (assinado, expira)
web_view_url text          -- webViewLink (abre no Drive)
size_bytes bigint null
added_by uuid fk → profiles(id)
sort_order int default 0
created_at timestamptz
```
RLS: leitura para autenticados; insert/update/delete para responsáveis do item OU admin (mesma lógica de comentários). GRANTs para `authenticated` e `service_role`.

### 3. Server functions (em `src/lib/luzeria/drive.functions.ts`)
Tudo via gateway do conector, autenticado, sem expor token Google ao cliente:
- `searchDriveFiles({ query, pageToken? })` → lista arquivos do Drive da agência.
- `getDriveFileMeta({ fileId })` → busca metadados (usado quando o user cola link, extrai ID e busca thumbnail/nome).
- `uploadToDrive({ filename, mimeType, base64, folderPath })` → cria pasta-caminho se não existir e sobe o arquivo.
- `attachFileToItem({ itemId, driveFileId })` → grava em `item_files`.
- `removeFileFromItem({ fileId })` → desanexa (não apaga do Drive, só remove o vínculo).
- `getThumbnailSignedUrl({ fileId })` → renova thumbnail expirada quando precisar.

Permissões verificadas via `requireSupabaseAuth` + checagem de responsável/admin antes de qualquer escrita.

### 4. Frontend
- `src/components/luzeria/FilesSection.tsx` — nova seção dentro do `DetailPanel`.
- `src/components/luzeria/DrivePicker.tsx` — modal de busca/seleção no Drive.
- Substitui o uso atual do campo `driveLink` no `DetailPanel.tsx` e na lista (`ContentRow.tsx`) por essa seção. Mantém o campo antigo como input alternativo dentro do "Colar link".
- Abertura: SEMPRE `window.open(webViewUrl, '_blank', 'noopener,noreferrer')`. Nunca iframe.

### 5. Limites práticos
- **Upload pelo app:** limito a 25 MB por arquivo na UI (suficiente pra artes, PDFs, áudios). Vídeos brutos grandes continuam melhor de subir manual no Drive e usar "Anexar do Drive".
- **Quantidade:** sem limite — vários arquivos por item, ordenáveis.
- **Onde fica armazenado:** 100% no Google Drive da agência. O Lovable só guarda o ID e metadados (nome, tipo, ícone).

## O que NÃO muda
- Toda a lógica existente de status, atribuições, comentários, dashboard, ranking, stories, limpeza, etc. fica intacta.
- Itens antigos com `driveLink` preenchido continuam funcionando — o link aparece como primeiro arquivo da lista após a migração.

## Ordem de execução
1. Linkar conector Google Drive (você autoriza com a conta da agência).
2. Migration `item_files` + RLS + GRANTs.
3. Server functions de Drive.
4. Componentes `FilesSection` + `DrivePicker`.
5. Plugar no `DetailPanel` e `ContentRow`, migrar `driveLink` antigos.
6. QA: testar abrir/anexar/upload no preview e no site publicado.

## Pergunta única antes de começar
**Pasta raiz no Drive:** quer que o app organize os uploads em `Luzeria App/{Cliente}/{Mês}/...` automaticamente, ou prefere uma pasta única flat tipo `Luzeria App/Uploads/`? Se não responder, sigo com a estrutura organizada por cliente/mês.
