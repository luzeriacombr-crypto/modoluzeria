-- Comparativo histórico de seguidores no Instagram (ideia de cliente numa
-- call de demonstração: "consigo mostrar pro meu cliente que ele tinha X
-- seguidores há 3 meses e hoje tem Y?"). A API do Instagram só devolve uma
-- janela recente de histórico — pra comparar períodos longos, precisamos
-- guardar nosso próprio retrato diário a partir de agora (não dá pra
-- puxar retroativo de antes dessa tabela existir).

CREATE TABLE public.instagram_client_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  captured_on date NOT NULL,
  followers_count int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, captured_on)
);

GRANT SELECT ON public.instagram_client_snapshots TO authenticated;
GRANT ALL ON public.instagram_client_snapshots TO service_role;
ALTER TABLE public.instagram_client_snapshots ENABLE ROW LEVEL SECURITY;

-- Só leitura, e só de clientes da própria org — a escrita é sempre feita
-- pelo cron via service role (supabaseAdmin), nunca pelo app autenticado.
CREATE POLICY "read own org instagram snapshots" ON public.instagram_client_snapshots
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = instagram_client_snapshots.client_id
      AND c.org_id = public.current_org_id()
  ));

CREATE INDEX instagram_client_snapshots_client_idx ON public.instagram_client_snapshots(client_id, captured_on);
