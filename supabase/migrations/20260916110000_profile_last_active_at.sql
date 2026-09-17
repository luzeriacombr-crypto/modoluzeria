-- profiles.last_active_at: quando a pessoa de fato USOU o app, gravado pelo
-- próprio servidor a cada requisição (com trava de 10min pra não virar
-- escrita a cada clique) — diferente de auth.users.last_sign_in_at, que só
-- atualiza num login novo de verdade e fica parado enquanto a sessão salva
-- no navegador só renova o token sozinha em segundo plano.
ALTER TABLE public.profiles ADD COLUMN last_active_at timestamptz;
