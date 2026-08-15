-- Reversible: to restore, re-run the CREATE TABLE/TRIGGER/FUNCTION block from
-- supabase/migrations/20260806100000_promotion_codes.sql (lines 53-77) as a
-- new migration — this repo has no down-migration convention, so the
-- original source is the rollback path rather than a paired down-file.
--
-- promotion_code_validations was a public read-only mirror of promotion_codes,
-- meant to let unauthenticated clients validate a code without exposing the
-- admin-only promotion_codes table directly. It was never adopted: public
-- validation ended up going straight through server functions in
-- promotion-affiliate.functions.ts (which query promotion_codes directly),
-- so this table, its sync trigger, and sync function have sat unused and
-- unread since creation (verified: zero references to
-- "promotion_code_validations" anywhere in src/).
DROP TRIGGER IF EXISTS trg_sync_promotion_codes ON public.promotion_codes;
DROP FUNCTION IF EXISTS public.sync_promotion_code_validations();
DROP TABLE IF EXISTS public.promotion_code_validations;
