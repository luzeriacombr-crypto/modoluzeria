-- Lets each agency pick its own two brand colors (main + light/tint), shown
-- everywhere the app used to hardcode Luzeria's lime green — buttons,
-- badges, focus rings, etc. Stored as hex strings; the app converts to
-- "R, G, B" at login time and overrides the --lz-brand-rgb /
-- --lz-brand-light-rgb CSS variables (defined in styles.css, defaulting to
-- Luzeria's own green) via document.documentElement.style. The pre-login
-- screen never applies this override, so it always shows Luzeria's green.
ALTER TABLE public.orgs ADD COLUMN color_primary text;
ALTER TABLE public.orgs ADD COLUMN color_primary_light text;
