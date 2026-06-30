DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'content_status' AND e.enumlabel = 'FINALIZADO'
  ) THEN
    ALTER TYPE public.content_status RENAME VALUE 'FINALIZADO' TO 'PRONTO_PARA_PUBLICAR';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'content_status' AND e.enumlabel = 'BLOQUEADO'
  ) THEN
    ALTER TYPE public.content_status RENAME VALUE 'BLOQUEADO' TO 'TRAVADO';
  END IF;
END $$;
