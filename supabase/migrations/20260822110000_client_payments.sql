-- Cobrança de clientes: dia de vencimento por cliente, chave Pix da própria
-- agência (pra mandar junto na cobrança) e um log manual de "recebi esse
-- pagamento" — não existe integração de cobrança do cliente pro lado da
-- agência, então "está em dia" só pode vir de alguém confirmando à mão
-- depois de conferir o Pix caiu.

ALTER TABLE public.clients ADD COLUMN payment_due_day smallint CHECK (payment_due_day BETWEEN 1 AND 31);
ALTER TABLE public.orgs ADD COLUMN pix_key text;

CREATE TABLE public.client_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  period text NOT NULL, -- "2026-08", o ciclo a que esse pagamento se refere
  amount_cents integer,
  paid_at timestamptz NOT NULL DEFAULT now(),
  marked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (client_id, period)
);

GRANT SELECT, INSERT ON public.client_payments TO authenticated;
GRANT ALL ON public.client_payments TO service_role;
ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financeiro read client payments" ON public.client_payments FOR SELECT TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro'))
    AND public.has_client_access(auth.uid(), client_id)
  );

CREATE POLICY "financeiro insert client payments" ON public.client_payments FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.current_org_id()
    AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro'))
    AND public.has_client_access(auth.uid(), client_id)
    AND marked_by = auth.uid()
  );

CREATE INDEX idx_client_payments_client ON public.client_payments(client_id, period);
