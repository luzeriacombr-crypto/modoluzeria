-- CPF do responsável legal do cliente (pessoa que assina), separado do
-- CNPJ/CPF da empresa (clients.cnpj_cpf) — contratos reais (ex: modelo que
-- o Junior usa) citam os dois separadamente ("CNPJ nº ...", representada
-- por Fulano, CPF ...).
ALTER TABLE public.clients ADD COLUMN legal_responsible_cpf text;
