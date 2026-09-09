-- Índices em chaves estrangeiras que não tinham nenhum — achado pelo
-- Advisor de performance do Supabase. Sem índice, toda vez que o
-- Postgres precisa achar linhas relacionadas por uma dessas colunas
-- (fazer join, ou apagar em cascata) ele varre a tabela inteira em vez
-- de ir direto — o mesmo tipo de causa de lentidão do RLS que já
-- corrigimos, só que em nível de índice em vez de política.
--
-- IF NOT EXISTS deixa seguro rodar de novo sem erro. CREATE INDEX (sem
-- CONCURRENTLY) porque o SQL Editor do Supabase roda tudo numa
-- transação só, e CONCURRENTLY não pode rodar dentro de transação.

CREATE INDEX IF NOT EXISTS idx_email_role_assignments_org_id ON public.email_role_assignments(org_id);
CREATE INDEX IF NOT EXISTS idx_clients_active_month_id ON public.clients(active_month_id);
CREATE INDEX IF NOT EXISTS idx_clients_current_stage_id ON public.clients(current_stage_id);
CREATE INDEX IF NOT EXISTS idx_clients_fixed_responsible_id ON public.clients(fixed_responsible_id);
CREATE INDEX IF NOT EXISTS idx_content_items_deleted_by ON public.content_items(deleted_by);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON public.comments(author_id);
CREATE INDEX IF NOT EXISTS idx_notifications_item_id ON public.notifications(item_id);
CREATE INDEX IF NOT EXISTS idx_stories_schedule_client_id ON public.stories_schedule(client_id);
CREATE INDEX IF NOT EXISTS idx_stories_schedule_user_id ON public.stories_schedule(user_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_schedule_task_id ON public.cleaning_schedule(task_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_schedule_user_id ON public.cleaning_schedule(user_id);
CREATE INDEX IF NOT EXISTS idx_status_transitions_actor_id ON public.status_transitions(actor_id);
CREATE INDEX IF NOT EXISTS idx_status_transitions_changed_by ON public.status_transitions(changed_by);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor_id ON public.activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_mentions_item_id ON public.mentions(item_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_updated_by ON public.app_settings(updated_by);
CREATE INDEX IF NOT EXISTS idx_cleaning_log_task_id ON public.cleaning_log(task_id);
CREATE INDEX IF NOT EXISTS idx_item_files_added_by ON public.item_files(added_by);
CREATE INDEX IF NOT EXISTS idx_client_drive_map_confirmed_by ON public.client_drive_map(confirmed_by);
CREATE INDEX IF NOT EXISTS idx_feed_share_tokens_created_by ON public.feed_share_tokens(created_by);
CREATE INDEX IF NOT EXISTS idx_feed_share_tokens_month_id ON public.feed_share_tokens(month_id);
CREATE INDEX IF NOT EXISTS idx_orgs_plan_id ON public.orgs(plan_id);
CREATE INDEX IF NOT EXISTS idx_orgs_promotion_code_id ON public.orgs(promotion_code_id);
CREATE INDEX IF NOT EXISTS idx_org_google_credentials_connected_by ON public.org_google_credentials(connected_by);
CREATE INDEX IF NOT EXISTS idx_bug_reports_reported_by ON public.bug_reports(reported_by);
CREATE INDEX IF NOT EXISTS idx_automation_rules_action_user_id ON public.automation_rules(action_user_id);
CREATE INDEX IF NOT EXISTS idx_platform_updates_created_by ON public.platform_updates(created_by);
CREATE INDEX IF NOT EXISTS idx_client_instagram_credentials_connected_by ON public.client_instagram_credentials(connected_by);
CREATE INDEX IF NOT EXISTS idx_promotion_codes_created_by ON public.promotion_codes(created_by);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referred_org_id ON public.affiliate_referrals(referred_org_id);
CREATE INDEX IF NOT EXISTS idx_purchase_events_plan_id ON public.purchase_events(plan_id);
CREATE INDEX IF NOT EXISTS idx_sales_page_blocks_updated_by ON public.sales_page_blocks(updated_by);
CREATE INDEX IF NOT EXISTS idx_client_stage_updates_org_id ON public.client_stage_updates(org_id);
CREATE INDEX IF NOT EXISTS idx_client_stage_updates_sent_by ON public.client_stage_updates(sent_by);
CREATE INDEX IF NOT EXISTS idx_client_stage_updates_stage_id ON public.client_stage_updates(stage_id);
CREATE INDEX IF NOT EXISTS idx_client_docs_created_by ON public.client_docs(created_by);
CREATE INDEX IF NOT EXISTS idx_client_docs_org_id ON public.client_docs(org_id);
CREATE INDEX IF NOT EXISTS idx_client_doc_roteiro_status_content_item_id ON public.client_doc_roteiro_status(content_item_id);
CREATE INDEX IF NOT EXISTS idx_client_doc_roteiro_status_org_id ON public.client_doc_roteiro_status(org_id);
CREATE INDEX IF NOT EXISTS idx_client_doc_roteiro_status_updated_by ON public.client_doc_roteiro_status(updated_by);
CREATE INDEX IF NOT EXISTS idx_client_stage_history_org_id ON public.client_stage_history(org_id);
CREATE INDEX IF NOT EXISTS idx_client_stage_history_stage_id ON public.client_stage_history(stage_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_author_id ON public.forum_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_replies_author_id ON public.forum_replies(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_replies_org_id ON public.forum_replies(org_id);
CREATE INDEX IF NOT EXISTS idx_reference_library_items_created_by ON public.reference_library_items(created_by);
CREATE INDEX IF NOT EXISTS idx_reseller_wholesale_prices_plan_id ON public.reseller_wholesale_prices(plan_id);
CREATE INDEX IF NOT EXISTS idx_leads_won_client_id ON public.leads(won_client_id);
CREATE INDEX IF NOT EXISTS idx_lead_contacts_created_by ON public.lead_contacts(created_by);
CREATE INDEX IF NOT EXISTS idx_lead_contacts_org_id ON public.lead_contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_marked_by ON public.client_payments(marked_by);
CREATE INDEX IF NOT EXISTS idx_client_payments_org_id ON public.client_payments(org_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON public.campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_campaigns_org_id ON public.campaigns(org_id);
CREATE INDEX IF NOT EXISTS idx_photo_selections_created_by ON public.photo_selections(created_by);
CREATE INDEX IF NOT EXISTS idx_photo_selections_org_id ON public.photo_selections(org_id);
CREATE INDEX IF NOT EXISTS idx_photo_clients_created_by ON public.photo_clients(created_by);
CREATE INDEX IF NOT EXISTS idx_client_contracts_org_id ON public.client_contracts(org_id);
CREATE INDEX IF NOT EXISTS idx_client_contracts_uploaded_by ON public.client_contracts(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_client_brand_assets_client_id ON public.client_brand_assets(client_id);
CREATE INDEX IF NOT EXISTS idx_client_brand_assets_created_by ON public.client_brand_assets(created_by);
CREATE INDEX IF NOT EXISTS idx_client_brand_assets_org_id ON public.client_brand_assets(org_id);
CREATE INDEX IF NOT EXISTS idx_client_contract_requests_created_by ON public.client_contract_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_client_contract_requests_org_id ON public.client_contract_requests(org_id);
