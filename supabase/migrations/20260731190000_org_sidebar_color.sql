-- Third customizable color: the sidebar's own dark-green background,
-- separate from the bright accent color (color_primary) and its light
-- tint (color_primary_light).
ALTER TABLE public.orgs ADD COLUMN color_sidebar text;
