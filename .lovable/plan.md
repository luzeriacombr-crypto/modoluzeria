# Organização automática no Google Drive

Toda vez que alguém anexar um arquivo numa tarefa, o app salva no Drive dentro da estrutura:

```
Pasta Raiz (a que você mandou)
└── <Nome do Cliente>/
    └── Entregas - <Nome do Cliente>/
        └── <Mês>/                     ← Janeiro, Fevereiro, ... (mês do conteúdo)
            └── arquivo.png
```

Se faltar qualquer pasta (Cliente, "Entregas - X" ou o mês), o app cria.

## Comportamento

**1. Configuração (uma vez)**
- Salvo o ID da pasta raiz `1LuefYT7TJiUhweGlOoHE31NGkXA2uTww` nas configurações do app.
- Só Adm Master vê esse campo (em Configurações → Drive) e pode trocar depois.

**2. Match do cliente** (igual ao que combinamos)
- Procuro subpasta com nome **exatamente igual** ao nome do cliente.
- Se não achar, procuro candidatas parecidas (ignora maiúsculas/acentos, "contém o nome").
- O app me pergunta antes: aparece um popup tipo "Não achei 'Padaria do Zé'. Usar 'Padaria Zé'? [Sim] [Criar nova] [Cancelar]". A escolha fica memorizada por cliente (não pergunta de novo).
- Se eu confirmar **Criar nova**, crio `<Cliente>/Entregas - <Cliente>/` do zero.

**3. Mês**
- Uso o campo "Mês" do conteúdo (ex.: item de Julho/2026 → pasta `Julho`).
- Nomes em português completo, capitalizados: Janeiro, Fevereiro, …, Dezembro.
- Sem ano no nome (você quis simples). Posso mudar pra "Julho 2026" se preferir depois.

**4. Upload pela tela do item**
- O fluxo atual já manda arquivos via gateway do Drive — só passo a setar o `parents` certo (a pasta do mês) antes de fazer o upload.
- Vale também pra "Colar link do Drive": eu **movo** o arquivo apontado para a pasta do mês daquele item (se não estiver lá).

**5. Botão "Reorganizar Drive" (só Adm Master)**
- Em Configurações → Drive, um botão "Reorganizar arquivos antigos".
- Varre todos os anexos já cadastrados no app (`item_files`) e move cada um para a pasta certa do seu item.
- Mostra progresso (`Processando 12/87 …`) e um resumo no final: movidos / já-no-lugar / pulados (sem cliente correspondente, pede confirmação).
- Cliente sem match exato entra numa fila de confirmação manual — você decide na hora se cria nova pasta ou aponta pra existente.

## O que vai mudar no app

- **Configurações → aba "Drive"** (Adm Master): campo "Pasta raiz no Drive" + botão "Reorganizar arquivos antigos".
- **Anexar arquivo / colar link** na tarefa: sem mudança visual — só passa a salvar no lugar certo automaticamente.
- **Popup de confirmação** quando o nome do cliente não bate exatamente.

## Detalhes técnicos

- Nova tabela `client_drive_map (client_id, drive_folder_id)` — guarda o ID da pasta do cliente já confirmado pra não perguntar de novo.
- Nova coluna `app_settings.drive_root_folder_id`.
- Server functions novas em `drive.functions.ts`:
  - `ensureClientFolderTree({ clientId, monthKey, confirmFolderId? })` → retorna o `folderId` do mês, criando o que faltar via Drive API (`files.create` com `mimeType: application/vnd.google-apps.folder`).
  - `findClientFolderCandidates({ clientId })` → lista candidatas quando não tem match exato.
  - `reorganizeAllFiles()` → itera `item_files`, chama `ensureClientFolderTree` e usa `files.update?addParents=...&removeParents=...` pra mover.
- `uploadDriveFile` e `attachDriveFile` passam a chamar `ensureClientFolderTree` e setar `parents` antes do upload / mover o arquivo logo após o attach.
- Cache de `client_drive_map` evita chamadas extras no Drive a cada upload.

Posso seguir?