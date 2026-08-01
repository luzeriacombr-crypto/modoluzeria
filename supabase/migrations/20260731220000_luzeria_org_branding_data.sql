-- Luzeria stops being a special case in the UI code (sidebar logo/tagline,
-- tab title, branding/plan sections all now render the same for every org,
-- Luzeria included — the owner wants to experience the exact same UX as a
-- paying agency). This just seeds Luzeria's own org row with the same
-- identity that used to be hardcoded, so nothing visually changes except
-- the logo image (which needs to be re-uploaded via Configurações → Geral →
-- Marca da agência, since it's now data-driven instead of a bundled asset).
UPDATE public.orgs
SET name = 'Luzeria', tagline = 'Você foi chamado para criar'
WHERE id = '00000000-0000-0000-0000-000000000001';
