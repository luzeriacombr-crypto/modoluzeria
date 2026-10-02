-- Data de entrada na agência, preenchida à mão pelo Adm Master (o created_at
-- do perfil é de quando a conta foi criada no app, não de quando a pessoa
-- entrou na equipe). Usada no card da Equipe ("há 8 meses") e pra celebrar
-- o aniversário de casa em Minhas Demandas. Pedido do Junior (02/10).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS joined_at date;
