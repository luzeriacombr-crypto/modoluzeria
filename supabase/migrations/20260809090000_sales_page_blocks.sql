-- Torna o site de vendas (SalesPage.tsx) editável sem deploy: cada seção
-- flexível (hero, listas, passos, features com imagem, galeria, texto)
-- vira uma linha aqui em vez de JSX fixo. Cabeçalho, Planos (preço vem do
-- banco), Formulário, FAQ, Rodapé e WhatsApp continuam fixos em código —
-- têm lógica própria, não são "conteúdo genérico".
CREATE TABLE public.sales_page_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('hero','bullet_list','steps','feature','gallery','text_blurb')),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX idx_sales_page_blocks_order ON public.sales_page_blocks(sort_order);

GRANT SELECT ON public.sales_page_blocks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_page_blocks TO authenticated;
GRANT ALL ON public.sales_page_blocks TO service_role;
ALTER TABLE public.sales_page_blocks ENABLE ROW LEVEL SECURITY;

-- Visitante anônimo (quem vê o site de vendas antes de logar) só enxerga
-- blocos visíveis — mesmo mecanismo já usado em 20260801010000_public_plans_read.sql.
CREATE POLICY "anon read visible blocks" ON public.sales_page_blocks FOR SELECT TO anon
  USING (is_visible = true);

CREATE POLICY "auth read blocks" ON public.sales_page_blocks FOR SELECT TO authenticated
  USING (
    is_visible = true
    OR (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001')
  );

CREATE POLICY "luzeria master manages blocks" ON public.sales_page_blocks FOR ALL TO authenticated
  USING (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001');

-- Seed: migra o conteúdo hardcoded que já existe hoje em SalesPage.tsx,
-- pra o site não mudar de conteúdo no dia do deploy — só passa a ser editável.
INSERT INTO public.sales_page_blocks (type, content, sort_order, is_visible) VALUES
('hero', '{
  "eyebrowIcon": "rocket",
  "eyebrowLabel": "Gestão de conteúdo pra agência",
  "titleLine1": "Pare de perder cliente",
  "titleLine2": "por falta de organização.",
  "titleAccentLine1": "Ganhe tempo com",
  "titleAccentLine2": "o Modo Criador.",
  "subtitle": "A plataforma que centraliza tudo que um Social Media precisa: produtividade da equipe, calendário de postagens, link aprovação de cliente, organização de arquivos… tudo num só lugar, sem planilha chata ou arquivos perdidos no WhatsApp.",
  "ctaLabel": "Quero testar por 7 dias! →",
  "images": [
    {"id":"desktop","source":"upload","url":"/marketing/hero-desktop-mockup.png","floating":true,"floatVariant":"c","widthPct":82,"top":0,"left":18,"z":0},
    {"id":"phone","source":"upload","url":"/marketing/hero-phone-mockup.png","floating":true,"floatVariant":"a","widthPct":50,"top":50,"left":0,"z":1}
  ]
}'::jsonb, 0, true),

('bullet_list', '{
  "heading": "O Modo Criador é para...",
  "icon": "x",
  "items": [
    "Você que gerencia vários clientes e cada um vive numa planilha ou pasta diferente",
    "Cliente que demora dias pra aprovar um post porque os arquivos se perdem no WhatsApp",
    "Sua equipe que não sabe quem é responsável por qual entrega e qual o prazo",
    "Você que quer mensurar a produtividade do time",
    "Você que já perdeu prazo porque ninguém viu que faltava aprovar algo",
    "Você que tem vergonha de mostrar sua \"organização interna\" pra um cliente novo"
  ],
  "closingTextPlain": "Se você marcou pelo menos um,",
  "closingTextAccent": "o Modo Criador foi feito pra você.",
  "background": "blue2"
}'::jsonb, 1, true),

('steps', '{
  "heading": "Simples assim",
  "background": "white",
  "items": [
    {"icon":"calendarDays","number":"01","title":"Monte o calendário","description":"Organize Posts e Reels de cada cliente num board visual, por mês."},
    {"icon":"users","number":"02","title":"Atribua e acompanhe","description":"Sua equipe sabe exatamente quem faz o quê, qual o prazo e você pode fazer comentários."},
    {"icon":"link2","number":"03","title":"Cliente aprova pelo link","description":"Manda um link público bonito, o cliente aprova ou comenta alterações, sem login."},
    {"icon":"folderOpen","number":"04","title":"Arquivos no Drive","description":"Conecte sua própria conta do Google Drive e faça o Backup dos arquivos automaticamente."}
  ]
}'::jsonb, 2, true),

('feature', '{
  "eyebrowIcon": "folderOpen",
  "eyebrowLabel": "Backup automático",
  "title": "Todo post vai direto pro seu Google Drive.",
  "description": "Conecte sua própria conta do Google Drive e cada arquivo que sua equipe sobe no Modo Criador é organizado e salvo automaticamente. Sem pasta perdida, sem procurar arquivo em conversa do WhatsApp.",
  "background": "white",
  "reverse": false,
  "images": [
    {"id":"app","source":"upload","url":"/marketing/app-screenshot-mockup.png","floating":true,"floatVariant":"c","widthPct":62,"top":14,"left":38,"z":0},
    {"id":"drive","source":"upload","url":"/marketing/drive-card-mockup.png","floating":true,"floatVariant":"a","widthPct":34,"top":6,"left":0,"z":1},
    {"id":"post","source":"upload","url":"/marketing/post-creative-mockup.png","floating":true,"floatVariant":"b","widthPct":38,"top":0,"left":27,"z":2}
  ]
}'::jsonb, 3, true),

('feature', '{
  "eyebrowIcon": "messageCircle",
  "eyebrowLabel": "Preview de feed",
  "title": "O cliente aprova em segundos, sem sair do celular.",
  "description": "Manda um link, ele vê o post do jeitinho que vai ficar no Instagram — imagem, legenda, tudo — e aprova ou pede ajuste com um toque. Sem precisar criar conta, sem confusão de WhatsApp.",
  "background": "gray",
  "reverse": false,
  "images": [{"id":"main","source":"builtin","builtinKey":"feedPreview","floating":false,"widthPct":100,"top":0,"left":0,"z":0}]
}'::jsonb, 4, true),

('feature', '{
  "eyebrowIcon": "layoutDashboard",
  "eyebrowLabel": "Dashboard geral",
  "title": "A saúde da operação, num piscar de olhos.",
  "description": "Veja quantos posts foram entregues, quantos ainda faltam e onde estão os gargalos — de todos os clientes, de uma vez só. Clique em qualquer número e já cai na lista de tarefas por trás dele.",
  "background": "white",
  "reverse": true,
  "images": [{"id":"main","source":"builtin","builtinKey":"dashboard","floating":false,"widthPct":100,"top":0,"left":0,"z":0}]
}'::jsonb, 5, true),

('feature', '{
  "eyebrowIcon": "barChart3",
  "eyebrowLabel": "Relatórios da equipe",
  "title": "Saiba exatamente quem está entregando (e quem precisa de ajuda).",
  "description": "Ranking de produtividade por pessoa, taxa de retrabalho, prazos cumpridos. Chega de planilha manual pra saber como a equipe está performando no mês.",
  "background": "blue2",
  "reverse": false,
  "images": [{"id":"main","source":"builtin","builtinKey":"report","floating":false,"widthPct":100,"top":0,"left":0,"z":0}]
}'::jsonb, 6, true),

('feature', '{
  "eyebrowIcon": "calendarDays",
  "eyebrowLabel": "Calendário geral",
  "title": "Todos os clientes, num calendário só.",
  "description": "Veja tudo que está programado pra publicar em qualquer dia, de qualquer cliente, sem precisar abrir pasta por pasta. Passe o mouse e já vê a miniatura do post.",
  "background": "white",
  "reverse": true,
  "images": [{"id":"main","source":"builtin","builtinKey":"calendar","floating":false,"widthPct":100,"top":0,"left":0,"z":0}]
}'::jsonb, 7, true),

('feature', '{
  "eyebrowIcon": "bell",
  "eyebrowLabel": "Notificações no celular",
  "title": "Um comentário novo? Você fica sabendo na hora.",
  "description": "Ative as notificações push no seu celular e receba avisos de comentário, prazo próximo ou aprovação de cliente — direto na tela de bloqueio, sem precisar ficar checando o app.",
  "background": "gray",
  "reverse": false,
  "images": [{"id":"main","source":"builtin","builtinKey":"notifications","floating":false,"widthPct":100,"top":0,"left":0,"z":0}]
}'::jsonb, 8, true),

('feature', '{
  "eyebrowIcon": "zap",
  "eyebrowLabel": "Rapidez e responsividade",
  "title": "Rápido no computador. Rápido no celular. Sempre.",
  "description": "O Modo Criador foi construído pra carregar rápido e funcionar liso em qualquer tela — desktop, tablet ou celular — porque sua equipe não trabalha só sentada na frente do computador.",
  "background": "white",
  "reverse": true,
  "images": [{"id":"main","source":"builtin","builtinKey":"responsive","floating":false,"widthPct":100,"top":0,"left":0,"z":0}]
}'::jsonb, 9, true),

('feature', '{
  "eyebrowIcon": "shieldCheck",
  "eyebrowLabel": "Segurança e LGPD",
  "title": "Os dados dos seus clientes, protegidos de verdade.",
  "description": "Cada agência tem seus dados totalmente isolados dos de outras contas, com conexão criptografada e conformidade com a LGPD — pra você confiar informação sensível de cliente na plataforma sem medo.",
  "background": "blue2",
  "reverse": false,
  "images": [{"id":"main","source":"builtin","builtinKey":"security","floating":false,"widthPct":100,"top":0,"left":0,"z":0}]
}'::jsonb, 10, true),

('bullet_list', '{
  "heading": "Você vai ter...",
  "icon": "check",
  "items": [
    "Calendário de conteúdo ilimitado, por cliente e por mês",
    "Link de aprovação pro cliente",
    "Equipe com papéis e responsáveis por tarefa",
    "Google Drive conectado, arquivos organizados automaticamente",
    "Relatórios de produtividade da equipe",
    "Suporte em português, feito pra agência brasileira"
  ],
  "background": "gray"
}'::jsonb, 11, true),

('gallery', '{
  "heading": "Quem usa, recomenda",
  "background": "white",
  "images": []
}'::jsonb, 12, false),

('text_blurb', '{
  "eyebrowIcon": "zap",
  "eyebrowLabel": "Somos a Luzeria Estúdio!",
  "paragraph": "Com mais de uma década em comunicação e criação de conteúdo, vivemos na pele a dor de gerenciar vários clientes ao mesmo tempo e foi aí que nasceu o Modo Criador: a ferramenta que a nossa própria agência usa todos os dias e agora queremos compartilhar também com a sua.",
  "background": "white"
}'::jsonb, 13, true);
