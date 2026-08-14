ALTER TABLE public.platform_updates
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Correções e Melhorias';

UPDATE public.platform_updates SET category = 'Roteiros e Planejamento' WHERE title IN (
  'Cliente pode aprovar ou pedir ajuste no roteiro',
  'Roteiros ganham fluxo de aprovação e envio direto pro Reels',
  'Roteiros e Planejamento no link do cliente'
);

UPDATE public.platform_updates SET category = 'Equipe' WHERE title IN (
  'Ranking mostra todo mundo com atividade',
  'Membros podem virar editor e escolher o formato — se você liberar',
  'Gravação agora pontua pela quantidade de vídeos',
  'Escolha quais recursos aparecem pra sua equipe',
  'Excluir do ranking + automação ao criar conteúdo',
  'Correção no ranking do Top Membros',
  'Equipe em formato de cards'
);

UPDATE public.platform_updates SET category = 'Notificações' WHERE title IN (
  'Notificação de menção agora chega pra quem foi marcado',
  'Notificações mais confiáveis + você escolhe quais chegam no celular',
  'Notificações push só do seu usuário'
);

UPDATE public.platform_updates SET category = 'Cliente e Preview' WHERE title IN (
  'Imagem de preview e logo da agência: corrigido',
  'Imagem de preview de feed personalizável',
  'Ícone (favicon) personalizável',
  'Link de preview de feed agora é fixo',
  'Logo da agência no rodapé do preview',
  'Escolha qual mês aparece no link do cliente',
  'Ver bloqueios do cliente, com o motivo',
  'Lembrete semanal: quem falta avisar no WhatsApp',
  'Etapa do projeto do cliente + mensagem pronta pro WhatsApp',
  'Progresso do projeto no link de acompanhamento do cliente',
  'Status de aprovação no Preview de Feed',
  'Ordem cronológica ou personalizada no feed'
);

UPDATE public.platform_updates SET category = 'Arquivos e Mídia' WHERE title IN (
  'Imagens de referência abrem no próprio app, não mais no Drive',
  'Post no formato Estático também ganhou baixar e remover',
  'Remover arquivo: escolha se some só do app ou também do Google Drive',
  'Baixe imagens direto do app — sem passar pelo Google Drive',
  'Mídia compacta, carrossel e imagens de briefing',
  'Agora aceitamos arquivos com 50MB!'
);

UPDATE public.platform_updates SET category = 'Segurança e Conta' WHERE title IN (
  'Autenticação de dois fatores (2FA)',
  'Login e cadastro com Google',
  'Esqueci minha senha',
  'Reset de senha da equipe corrigido + senha direta',
  'Reforço de segurança da plataforma'
);

UPDATE public.platform_updates SET category = 'Financeiro' WHERE title IN (
  'Programa de Afiliados'
);

-- Everything else (bug fixes, tour, help center, calendar, automations,
-- dashboard, stories, settings reorg, etc.) keeps the default
-- 'Correções e Melhorias' set above.
