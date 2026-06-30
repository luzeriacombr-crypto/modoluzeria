## Mudança

Hoje, dentro de cada cliente existem duas coisas parecidas:

- A aba **"Perfil do Cliente"** (última aba ao lado de Posts / Reels / Preview de Feed) com formulário de nicho, posts/semana, reels/semana, responsável fixo, dia de revisão e observações.
- A **"Ficha do Cliente"** que abre em painel lateral (botão de informação ao lado do nome do cliente, e também acessado pela sidebar e por outros pontos) — muito mais completa: métricas, descrição, pasta de entregas no Drive, links, contatos, senhas, onboarding e recorrências.

Vou **remover a aba "Perfil do Cliente"** e colocar a **Ficha do Cliente no lugar dela**, agora como aba inline (não mais como painel lateral).

## O que muda na interface

- Em cada cliente (Social Media e Pack Digital), as abas passam a ser:
  `Posts · Reels · Preview de Feed · Ficha do Cliente`
- Clientes da categoria **Avulsos** continuam com `Posts · Reels · Outros · Preview de Feed` (não tinham Perfil, não terão Ficha como aba — segue acessível pelos atalhos existentes).
- A aba **Ficha do Cliente** mostra exatamente o conteúdo que hoje aparece no painel lateral: métricas, "Sobre", pasta de entregas no Drive, links importantes, contatos, senhas e acessos (admins), onboarding e recorrências.
- Os campos do antigo "Perfil" (nicho, posts/semana, reels/semana, responsável fixo, dia de revisão, observações) **continuam editáveis** — vou incluí-los como uma seção "Configuração do cliente" dentro da própria Ficha, para não perder funcionalidade.
- O **botão de informação (ⓘ)** ao lado do nome do cliente, que hoje abre o painel lateral, passa a simplesmente **levar para a aba Ficha do Cliente** (mantém o atalho).
- Os outros pontos que abrem a Ficha como painel lateral (sidebar via menu de três pontinhos, mensagens de "pasta não configurada" no Drive) **continuam funcionando como painel lateral** — assim quem está em outra tela não precisa entrar no cliente para ver/editar a ficha.

## Resumo técnico

- `src/components/luzeria/ClientView.tsx`
  - Troca a aba `"profile"` por `"ficha"` na lista de abas (somente para Social Media e Pack Digital).
  - Renderiza um novo componente `ClientFichaTab` quando `tab === "ficha"`.
  - O botão de info ao lado do nome chama `setTab("ficha")` em vez de `openFicha(client.id)`.
  - Remove `ProfileTab` e helpers exclusivos (`Field`, `inp`) do arquivo.
- `src/components/luzeria/ClientFichaPanel.tsx`
  - Extrai o corpo (métricas, sobre, pasta de entregas, links, contatos, senhas, onboarding, recorrências) para um componente compartilhado `ClientFichaContent({ clientId })` que não depende do `useUI().fichaClientId` nem da estrutura de painel lateral (sem header de fechar, sem fundo modal).
  - Acrescenta a seção "Configuração do cliente" com os campos do antigo Perfil (nicho, posts/semana, reels/semana, responsável fixo, dia de revisão, observações), usando o mesmo `updateClient`.
  - `ClientFichaPanel` continua existindo e simplesmente envolve `ClientFichaContent` com a UI de painel lateral, para que sidebar e atalhos externos continuem funcionando.
- Nenhuma mudança em backend, store, queries ou rotas.