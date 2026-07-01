
-- Add missing columns to status_transitions (table already exists)
ALTER TABLE public.status_transitions
  ADD COLUMN IF NOT EXISTS changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignee_ids uuid[] DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS status_transitions_item_id_idx ON public.status_transitions(item_id);
CREATE INDEX IF NOT EXISTS status_transitions_created_at_idx ON public.status_transitions(created_at DESC);

-- contract_value in clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS contract_value numeric(10,2) DEFAULT NULL;

-- client_approved_at in feed_share_tokens
ALTER TABLE public.feed_share_tokens
  ADD COLUMN IF NOT EXISTS client_approved_at timestamptz DEFAULT NULL;
