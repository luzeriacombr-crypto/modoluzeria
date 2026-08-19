-- Leads que pediram demonstração pelo popup de exit-intent no formulário de
-- assinatura (SalesPage). Escrita sempre via service role (rota pública, sem
-- sessão) — RLS fica ligado sem nenhuma policy, então ninguém lê/escreve por
-- fora do backend, nem master via client comum.
create table public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  ip text,
  created_at timestamptz not null default now()
);

alter table public.demo_requests enable row level security;

create index idx_demo_requests_created_at on public.demo_requests (created_at desc);
create index idx_demo_requests_ip_created_at on public.demo_requests (ip, created_at);
