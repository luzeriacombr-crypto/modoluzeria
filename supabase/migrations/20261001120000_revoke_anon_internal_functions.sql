-- Achado da primeira auditoria "porta aberta" (scripts/security/audit.sh):
-- funções SECURITY DEFINER internas chamáveis por quem não está logado.
-- Todas já checam auth.uid()/current_org_id() e não fazem nada pra anon,
-- mas o app só chama logado — tirar o EXECUTE do anon evita que uma
-- edição futura que perca a checagem vire porta aberta. (REVOKE FROM
-- PUBLIC não basta: o Supabase dá EXECUTE pro anon por padrão.)
REVOKE EXECUTE ON FUNCTION public.adjust_bank_account_balance(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_item_internal(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_agency_stories_done(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_photo_selection_face_search(uuid, boolean) FROM PUBLIC, anon;
