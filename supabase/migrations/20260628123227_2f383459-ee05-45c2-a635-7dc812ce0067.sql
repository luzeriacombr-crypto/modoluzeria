ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Social Media';
CREATE INDEX IF NOT EXISTS clients_category_idx ON public.clients(category);