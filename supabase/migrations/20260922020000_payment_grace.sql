-- Régua de cobrança: fim de teste sem assinatura, ou fatura atrasada,
-- dão 7 dias de tolerância (mesma janela já usada pra estender teste
-- manualmente) antes da conta pausar. Mockup aprovado pelo Junior
-- (claude.ai/artifact/6zLgdSd2nA9qstYDeBZKiD).
--
-- payment_grace_started_at: quando a tolerância de 7 dias começou a
-- contar (fim do teste, ou o momento em que a fatura venceu). Null =
-- sem pendência de pagamento em aberto.
-- deactivation_reason: por que profiles.active virou false pra essa
-- org — 'inactivity' é o mecanismo que já existia (onboarding nunca
-- concluído), 'payment' é o novo (passou dos 7 dias sem pagar). Null
-- cobre tanto "nunca foi desativada" quanto "cadastro pendente de
-- aprovação" (esse último não mexe nessa coluna).
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS payment_grace_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivation_reason text CHECK (deactivation_reason IN ('inactivity', 'payment'));
