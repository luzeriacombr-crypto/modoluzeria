-- CPF/CNPJ e endereço do cliente (LGPD) saem de `clients` — que toda a
-- equipe com acesso ao cliente lê — pra uma tabela só de admin. Só servem
-- pro contrato, que já é tela de admin.
--
-- Tabela à parte em vez de esconder colunas de `clients` com GRANT por
-- coluna: com GRANT por coluna, qualquer coluna nova criada em `clients`
-- ficaria ilegível pro app até alguém lembrar de liberar.
--
-- Etapa 1 de 3 (compatível com o código antigo): cria, copia e mantém
-- sincronizado a partir de `clients` enquanto o código antigo ainda grava
-- lá. A etapa 3 (20261001140000) apaga as colunas antigas e o gatilho.
CREATE TABLE public.client_legal_info (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  cnpj_cpf text,
  address text,
  legal_responsible_cpf text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.client_legal_info FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_legal_info TO authenticated;
GRANT ALL ON public.client_legal_info TO service_role;
ALTER TABLE public.client_legal_info ENABLE ROW LEVEL SECURITY;

-- Mesma regra de "admin manage clients": admin (master/setor) da agência
-- do cliente, com acesso a esse cliente.
CREATE POLICY "admin manage client legal info" ON public.client_legal_info FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_legal_info.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)))
  WITH CHECK (public.is_admin(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_legal_info.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)));

INSERT INTO public.client_legal_info (client_id, cnpj_cpf, address, legal_responsible_cpf)
SELECT id, cnpj_cpf, address, legal_responsible_cpf
FROM public.clients
WHERE cnpj_cpf IS NOT NULL OR address IS NOT NULL OR legal_responsible_cpf IS NOT NULL;

-- Transição: o código antigo ainda grava em clients.* até o deploy novo.
CREATE OR REPLACE FUNCTION public.sync_client_legal_info()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.cnpj_cpf IS NULL AND NEW.address IS NULL AND NEW.legal_responsible_cpf IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.client_legal_info (client_id, cnpj_cpf, address, legal_responsible_cpf, updated_at)
  VALUES (NEW.id, NEW.cnpj_cpf, NEW.address, NEW.legal_responsible_cpf, now())
  ON CONFLICT (client_id) DO UPDATE SET
    cnpj_cpf = EXCLUDED.cnpj_cpf,
    address = EXCLUDED.address,
    legal_responsible_cpf = EXCLUDED.legal_responsible_cpf,
    updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_client_legal_info() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER sync_client_legal_info
  AFTER INSERT OR UPDATE OF cnpj_cpf, address, legal_responsible_cpf ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_client_legal_info();
