# Ficha da Chrome Web Store — Modo Criador: Salvar Referência

Copiar e colar direto nos campos do painel de desenvolvedor.

---

## Nome do item
(já vem do manifest.json — não precisa digitar de novo)

```
Modo Criador — Salvar referência
```

---

## Descrição resumida
(campo curto, aparece na busca — limite 132 caracteres)

```
Salve qualquer página como referência no Modo Criador em 2 cliques, geral ou direto num cliente.
```

(88 caracteres — dentro do limite)

---

## Descrição detalhada
(campo grande da ficha)

```
Viu um vídeo, post ou site que serve de referência pro trabalho? Salve
direto de onde você está, sem trocar de aba nem copiar link na mão.

Como funciona:
1. Abra a extensão na página que você quer guardar
2. Título e link já vêm preenchidos sozinhos
3. Escolha se é uma referência geral da agência ou de um cliente específico
4. Salvar

A referência aparece na hora na Biblioteca de Referências do Modo
Criador, pronta pra consultar depois — sua ou de qualquer pessoa da
equipe com acesso àquele cliente.

Pra usar, você precisa ter uma conta ativa no Modo Criador
(modocriador.com.br). A extensão entra com o mesmo e-mail e senha que
você já usa lá — não precisa cadastrar nada de novo.

Sobre a extensão:
• Só fala com o banco de dados do Modo Criador — não lê, guarda nem
  envia o conteúdo das páginas que você visita.
• A permissão de acessar a aba atual é usada só na hora em que você
  abre a extensão, pra preencher título e link.
• Sem anúncios, sem rastreamento, sem coleta de dados de navegação.
```

---

## Categoria
```
Produtividade
```

---

## Idioma
```
Português (Brasil)
```

---

## Visibilidade — decisão sua

Como só a sua equipe (e clientes seus que usam o Modo Criador) vai usar
isso, duas opções fazem sentido — **pública** não é recomendável, pois
listaria a extensão pra qualquer pessoa do mundo, mesmo que inútil sem
conta:

- **Não listada**: não aparece em busca nem na loja, mas qualquer
  pessoa com o link direto pode instalar. Bom se você quiser mandar o
  link por WhatsApp pra equipe/clientes sem burocracia.
- **Privada**: só instala quem você convidar explicitamente por e-mail
  no próprio painel (até 100 contas nesse modo, sem custo extra). Mais
  controlado, mas dá um passo a mais quando entra gente nova.

Recomendo **Não listada** — cobre o caso de uso real (equipes e
clientes variados, que mudam com o tempo) sem te obrigar a gerenciar
uma lista de e-mails toda vez que alguém novo precisar da extensão.

---

## Capturas de tela (obrigatório, 1 a 5)

Formato: 1280×800 ou 640×400, PNG ou JPEG.

Como tirar (com a extensão já carregada localmente):
1. Abra qualquer página (ex: um vídeo do YouTube ou um post do Instagram)
2. Clique no ícone da extensão na barra do Chrome
3. Print da tela de "Salvar referência" já preenchida
4. Se quiser uma segunda, print da tela de sucesso ("Salvo na
   biblioteca!")

Me manda os prints que eu corto/redimensiono pro tamanho exigido.

---

## Justificativas de permissão
(a Chrome Web Store pergunta por que cada permissão é necessária —
respostas prontas pra colar)

**activeTab:**
```
Usada só no momento em que a pessoa abre a extensão, pra ler o título
e a URL da aba visível e pré-preencher o formulário de salvar
referência. Não é lido nada além disso, e não roda em segundo plano.
```

**storage:**
```
Guarda localmente, no próprio navegador, a sessão de login da pessoa
no Modo Criador — pra não pedir e-mail e senha toda vez que abrir a
extensão. Nenhum dado sai do navegador por causa dessa permissão.
```

**host_permissions (grmayzeeemilvhjeninh.supabase.co):**
```
É o endereço do banco de dados do Modo Criador (Supabase). A extensão
precisa falar com ele pra autenticar a pessoa e salvar a referência —
é o único servidor com o qual ela se comunica.
```
