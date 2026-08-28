import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";
import type { Client, ContentItem, ContentType, MonthData, Profile, Role, Status, WorkSchedule } from "./types";
import { isActivityType, STATUS_META, SETOR_PERMISSION_KEYS } from "./types";

/** Fixed id of the original Luzeria Estúdio org — also hardcoded in migrations
 * and in the admin-auth-operations edge function (they can't share a TS import). */
export const LUZERIA_ORG_ID = "00000000-0000-0000-0000-000000000001";

/** Junior's own profile id (master of LUZERIA_ORG_ID) — for notifications
 * that must reach him specifically, not every Luzeria master. Hardcoded
 * like LUZERIA_ORG_ID since there's no other stable identifier: his login
 * email (junior.reis@live.com) differs from the address used for platform
 * emails (junioreisfoto2@gmail.com, see PLATFORM_SUPPORT_EMAIL in
 * bug-reports.functions.ts / demo-request.functions.ts), so neither email
 * can be used to look this profile up reliably. */
export const MODO_CRIADOR_OWNER_ID = "93f0cbec-e009-48fb-ac88-6bf1fd8120de";

/* ============== PROFILES & ROLES ============== */

type AvatarTransform = { width: number; height: number; resize: "cover" | "contain" } | null;

/** Square photos (profile avatars, client photos) — always 1:1 out of
 * ImageCropModal, so "cover" at 128×128 never crops content, just shrinks
 * it. Nothing in the app renders one bigger than 56-64px CSS. Deliberately
 * NOT applied to agency branding assets (logo, favicon, feed-preview image)
 * — those aren't square (a wide "cover" transform once shipped a cropped,
 * broken logo), they're one-off uploads (not repeated per row in a list),
 * and testing against a real logo showed "contain" can even make an
 * already-small file bigger (re-encoding overhead) — no actual problem to
 * fix there, so it's served as uploaded. Favicon and feed-preview image
 * DO benefit though (tested against real org data: favicon 66KB→18KB,
 * feed-preview 356KB→67KB) since people upload them at whatever resolution
 * without resizing first — "contain" so neither ever gets cropped, capped
 * at generous boxes (feed-preview's box matches its own recommended
 * 1200×630, so sharing quality isn't affected, just re-compressed). */
const SQUARE_THUMB: AvatarTransform = { width: 128, height: 128, resize: "cover" };
const FAVICON_THUMB: AvatarTransform = { width: 128, height: 128, resize: "contain" };
const FEED_PREVIEW_THUMB: AvatarTransform = { width: 1200, height: 630, resize: "contain" };

/** Generate signed read URLs for avatar storage paths (1 year), optionally
 * resized via Supabase's image transform. createSignedUrls (batch) has no
 * transform option, so this signs individually, in parallel — signing
 * itself is cheap (no image processing happens until the URL is actually
 * fetched, and Supabase's edge caches the transformed result after that).
 * Pass `transform: null` to skip resizing (e.g. the org's logo — see
 * comment above SQUARE_THUMB). */
async function signAvatarPaths(
  supabase: any, paths: (string | null | undefined)[], transform: AvatarTransform = SQUARE_THUMB,
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  const result = new Map<string, string>();
  if (unique.length === 0) return result;
  const signed = await Promise.all(unique.map(async (path) => {
    const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365,
      transform ? { transform } : undefined);
    return { path, url: data?.signedUrl as string | undefined };
  }));
  signed.forEach(({ path, url }) => { if (url) result.set(path, url); });
  return result;
}

/** Generate signed read URLs for reel-cover storage paths (1 year). */
export async function signCoverPaths(supabase: any, paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  const result = new Map<string, string>();
  if (unique.length === 0) return result;
  const { data } = await supabase.storage.from("reel-covers").createSignedUrls(unique, 60 * 60 * 24 * 365);
  (data ?? []).forEach((r: any) => {
    if (r?.path && r?.signedUrl) result.set(r.path, r.signedUrl);
  });
  return result;
}

export const listProfiles = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data: profiles, error } = await context.supabase
      .from("profiles")
      .select("id, name, color, icon, active, avatar_url, onboarded_at, tour_completed_at, exclude_from_ranking, client_access_restricted")
      .order("name");
    if (error) throw new Error(error.message);
    const { data: roles } = await context.supabase.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, Role>();
    (roles ?? []).forEach((r) => roleMap.set(r.user_id, r.role as Role));
    // Emails are only readable by admins via a SECURITY DEFINER RPC.
    const emailMap = new Map<string, string>();
    const { data: emailRows } = await context.supabase.rpc("admin_list_profile_emails");
    (emailRows ?? []).forEach((r: any) => emailMap.set(r.id, r.email));
    const signed = await signAvatarPaths(context.supabase, (profiles ?? []).map((p: any) => p.avatar_url));
    const { data: cargoRows } = await context.supabase
      .from("profile_cargos").select("profile_id, cargo_id").in("profile_id", (profiles ?? []).map((p: any) => p.id));
    const cargoIdsByProfile = new Map<string, string[]>();
    (cargoRows ?? []).forEach((r: any) => {
      const list = cargoIdsByProfile.get(r.profile_id) ?? [];
      list.push(r.cargo_id);
      cargoIdsByProfile.set(r.profile_id, list);
    });
    const { data: clientAccessRows } = await context.supabase
      .from("client_access").select("profile_id, client_id").in("profile_id", (profiles ?? []).map((p: any) => p.id));
    const clientAccessByProfile = new Map<string, string[]>();
    (clientAccessRows ?? []).forEach((r: any) => {
      const list = clientAccessByProfile.get(r.profile_id) ?? [];
      list.push(r.client_id);
      clientAccessByProfile.set(r.profile_id, list);
    });
    return (profiles ?? []).map<Profile>((p: any) => ({
      id: p.id,
      email: emailMap.get(p.id) ?? "",
      name: p.name,
      color: p.color,
      icon: p.icon,
      active: p.active,
      role: roleMap.get(p.id) ?? "member",
      avatarPath: p.avatar_url ?? null,
      avatarUrl: p.avatar_url ? signed.get(p.avatar_url) ?? null : null,
      onboardedAt: p.onboarded_at ?? null,
      tourCompletedAt: p.tour_completed_at ?? null,
      excludeFromRanking: p.exclude_from_ranking ?? false,
      cargoIds: cargoIdsByProfile.get(p.id) ?? [],
      clientAccessRestricted: p.client_access_restricted ?? false,
      clientAccessIds: clientAccessByProfile.get(p.id) ?? [],
    }));
  });

/** Cheap lookup for the "/" route's post-login redirect — just the one
 * field, so it doesn't pay getMe()'s avatar/org-branding signing cost on
 * every login just to decide where to send someone. */
export const getMyDefaultLanding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles").select("default_landing").eq("id", context.userId).maybeSingle();
    return (profile as any)?.default_landing ?? null;
  });

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id, name, color, icon, active, avatar_url, onboarded_at, tour_completed_at, org_id, exclude_from_ranking, default_landing")
      .eq("id", context.userId).maybeSingle();
    const { data: roleRow } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).maybeSingle();
    if (!profile) return null;
    const { data: myEmail } = await context.supabase.rpc("get_my_email");
    const role = (roleRow?.role ?? "member") as Role;
    const orgId = (profile as any).org_id as string | null;
    const { data: org, error: orgErr } = orgId
      ? await context.supabase.from("orgs").select("name, tagline, logo_path, logo_path_light, color_primary, color_primary_light, color_sidebar, color_accent_light, feed_preview_image_path, favicon_path, disabled_features, setor_permissions, members_can_set_editor_format, is_reseller, nav_labels, nav_order, border_radius, dashboard_layout, hero_gradient_from, hero_gradient_to").eq("id", orgId).maybeSingle()
      : { data: null, error: null };
    // Silenciosamente virar tudo null aqui já apagou a marca (logo/cores) de
    // toda agência uma vez, quando uma política de RLS quebrada fazia essa
    // query falhar sem ninguém perceber — melhor estourar alto do que
    // voltar um perfil com marca zerada pra todo mundo de novo.
    if (orgErr) throw new Error(`Falha ao carregar dados da agência: ${orgErr.message}`);
    const logoPath = (org as any)?.logo_path as string | null | undefined;
    const logoPathLight = (org as any)?.logo_path_light as string | null | undefined;
    const feedPreviewImagePath = (org as any)?.feed_preview_image_path as string | null | undefined;
    const faviconPath = (org as any)?.favicon_path as string | null | undefined;
    const [signed, logoSigned, logoLightSigned, feedPreviewSigned, faviconSigned] = await Promise.all([
      signAvatarPaths(context.supabase, [profile.avatar_url]),
      signAvatarPaths(context.supabase, [logoPath], null),
      signAvatarPaths(context.supabase, [logoPathLight], null),
      signAvatarPaths(context.supabase, [feedPreviewImagePath], FEED_PREVIEW_THUMB),
      signAvatarPaths(context.supabase, [faviconPath], FAVICON_THUMB),
    ]);
    const orgLogoUrl = logoPath ? logoSigned.get(logoPath) ?? null : null;
    const orgLogoUrlLight = logoPathLight ? logoLightSigned.get(logoPathLight) ?? null : null;
    const orgFeedPreviewImageUrl = feedPreviewImagePath ? feedPreviewSigned.get(feedPreviewImagePath) ?? null : null;
    const orgFaviconUrl = faviconPath ? faviconSigned.get(faviconPath) ?? null : null;
    // Cargos atribuídos (pode ter vários) — cargoPermissions já é a união
    // de todos eles, pra checar direto com hasPermission() sem cruzar listas.
    const { data: cargoRows } = await context.supabase
      .from("profile_cargos").select("cargos(name, permissions)").eq("profile_id", context.userId);
    const myCargos = ((cargoRows ?? []) as any[]).map((r) => r.cargos).filter(Boolean);
    const cargoNames = myCargos.map((c: any) => c.name as string);
    const cargoPermissions = [...new Set(myCargos.flatMap((c: any) => (c.permissions ?? []) as string[]))];
    return {
      id: profile.id, email: (myEmail as string | null) ?? "", name: profile.name,
      color: profile.color, icon: profile.icon, active: profile.active,
      excludeFromRanking: (profile as any).exclude_from_ranking ?? false,
      role,
      avatarPath: profile.avatar_url ?? null,
      avatarUrl: profile.avatar_url ? signed.get(profile.avatar_url) ?? null : null,
      onboardedAt: profile.onboarded_at ?? null,
      tourCompletedAt: (profile as any).tour_completed_at ?? null,
      isPlatformAdmin: role === "master" && orgId === LUZERIA_ORG_ID,
      isReseller: (org as any)?.is_reseller ?? false,
      orgId,
      orgName: (org as any)?.name ?? null,
      orgTagline: (org as any)?.tagline ?? null,
      orgColorPrimary: (org as any)?.color_primary ?? null,
      orgColorPrimaryLight: (org as any)?.color_primary_light ?? null,
      orgColorSidebar: (org as any)?.color_sidebar ?? null,
      orgColorAccentLight: (org as any)?.color_accent_light ?? null,
      orgLogoUrl,
      orgLogoUrlLight,
      orgFeedPreviewImageUrl,
      orgFeedPreviewImagePath: feedPreviewImagePath ?? null,
      orgFaviconUrl,
      orgFaviconPath: faviconPath ?? null,
      disabledFeatures: ((org as any)?.disabled_features ?? []) as string[],
      setorPermissions: ((org as any)?.setor_permissions ?? []) as string[],
      membersCanSetEditorFormat: ((org as any)?.members_can_set_editor_format ?? false) as boolean,
      navLabels: ((org as any)?.nav_labels ?? {}) as Record<string, string>,
      navOrder: ((org as any)?.nav_order ?? {}) as Record<string, string[]>,
      borderRadius: ((org as any)?.border_radius ?? 12) as number,
      dashboardLayout: ((org as any)?.dashboard_layout ?? {}) as Record<string, { x: number; y: number; w: number; h: number }>,
      heroGradientFrom: ((org as any)?.hero_gradient_from ?? null) as string | null,
      heroGradientTo: ((org as any)?.hero_gradient_to ?? null) as string | null,
      cargoNames,
      cargoPermissions,
      defaultLanding: ((profile as any)?.default_landing ?? null) as { view: string; clientId?: string } | null,
    } satisfies Profile;
  });

/** Master-only: which capabilities beyond the fixed baseline the "setor"
 * role has in this org. */
export const updateSetorPermissions = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { permissions: string[] }) =>
    z.object({ permissions: z.array(z.enum(SETOR_PERMISSION_KEYS)) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Apenas o Adm Master pode configurar permissões.");
    const { error } = await context.supabase
      .from("orgs").update({ setor_permissions: data.permissions }).eq("id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Master-only: rename their own agency and/or set its in-app tagline. */
export const updateMyOrg = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: {
    name?: string; tagline?: string | null; logoPath?: string | null; logoPathLight?: string | null;
    colorPrimary?: string | null; colorPrimaryLight?: string | null; colorSidebar?: string | null;
    colorAccentLight?: string | null;
    taxId?: string | null; feedPreviewImagePath?: string | null; faviconPath?: string | null;
    disabledFeatures?: string[];
    membersCanSetEditorFormat?: boolean;
    borderRadius?: number;
    navLabels?: Record<string, string>;
    navOrder?: Record<string, string[]>;
    dashboardLayout?: Record<string, { x: number; y: number; w: number; h: number }>;
    heroGradientFrom?: string | null;
    heroGradientTo?: string | null;
  }) =>
    z.object({
      name: z.string().trim().min(1).max(80).optional(),
      tagline: z.string().trim().max(120).nullable().optional(),
      logoPath: z.string().max(300).nullable().optional(),
      logoPathLight: z.string().max(300).nullable().optional(),
      colorPrimary: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
      colorPrimaryLight: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
      colorSidebar: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
      colorAccentLight: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
      taxId: z.string().trim().regex(/^\d{11}$|^\d{14}$/).nullable().optional(),
      feedPreviewImagePath: z.string().max(300).nullable().optional(),
      faviconPath: z.string().max(300).nullable().optional(),
      disabledFeatures: z.array(z.string().max(40)).max(20).optional(),
      membersCanSetEditorFormat: z.boolean().optional(),
      borderRadius: z.number().int().min(0).max(28).optional(),
      navLabels: z.record(z.string(), z.string().trim().min(1).max(40)).optional(),
      navOrder: z.record(z.string(), z.array(z.string().max(40)).max(40)).optional(),
      dashboardLayout: z.record(z.string().max(40), z.object({
        x: z.number().int().min(0).max(24),
        y: z.number().int().min(0).max(200),
        w: z.number().int().min(1).max(24),
        h: z.number().int().min(1).max(20),
      })).optional(),
      heroGradientFrom: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
      heroGradientTo: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    const patch: any = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.tagline !== undefined) patch.tagline = data.tagline;
    if (data.logoPath !== undefined) patch.logo_path = data.logoPath;
    if (data.logoPathLight !== undefined) patch.logo_path_light = data.logoPathLight;
    if (data.colorPrimary !== undefined) patch.color_primary = data.colorPrimary;
    if (data.colorPrimaryLight !== undefined) patch.color_primary_light = data.colorPrimaryLight;
    if (data.colorSidebar !== undefined) patch.color_sidebar = data.colorSidebar;
    if (data.colorAccentLight !== undefined) patch.color_accent_light = data.colorAccentLight;
    if (data.taxId !== undefined) patch.tax_id = data.taxId;
    if (data.feedPreviewImagePath !== undefined) patch.feed_preview_image_path = data.feedPreviewImagePath;
    if (data.faviconPath !== undefined) patch.favicon_path = data.faviconPath;
    if (data.disabledFeatures !== undefined) patch.disabled_features = data.disabledFeatures;
    if (data.membersCanSetEditorFormat !== undefined) patch.members_can_set_editor_format = data.membersCanSetEditorFormat;
    if (data.borderRadius !== undefined) patch.border_radius = data.borderRadius;
    if (data.navLabels !== undefined) patch.nav_labels = data.navLabels;
    if (data.navOrder !== undefined) patch.nav_order = data.navOrder;
    if (data.dashboardLayout !== undefined) patch.dashboard_layout = data.dashboardLayout;
    if (data.heroGradientFrom !== undefined) patch.hero_gradient_from = data.heroGradientFrom;
    if (data.heroGradientTo !== undefined) patch.hero_gradient_to = data.heroGradientTo;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { data: updated, error } = await context.supabase
      .from("orgs").update(patch).eq("id", context.orgId).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    // A blocked-by-RLS update returns no error and zero rows — surface that
    // as a real failure instead of a false "saved" toast.
    if (!updated) throw new Error("Não foi possível salvar (permissão negada).");
    return { ok: true };
  });

/** Personal, not org-wide — which screen a member lands on right after
 * login. Any active profile can set their own; there's no "set for
 * someone else" here, unlike updateMyOrg's admin-only branding fields. */
export const updateMyDefaultLanding = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { defaultLanding: { view: string; clientId?: string } | null }) =>
    z.object({
      defaultLanding: z.object({
        view: z.enum(["minhas-tarefas", "admin", "calendario", "cliente"]),
        clientId: z.string().uuid().optional(),
      }).nullable(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles").update({ default_landing: data.defaultLanding }).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============== PLANS ============== */

export const getPlans = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("plans").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []).map((p: any) => ({
      id: p.id as string,
      name: p.name as string,
      priceCents: p.price_cents as number | null,
      maxClients: p.max_clients as number | null,
      maxCollaborators: p.max_collaborators as number | null,
      features: (p.features ?? {}) as Record<string, boolean | string | number | null>,
      sortOrder: p.sort_order as number,
    }));
  });

/** Drives the "Primeiros passos" checklist shown to masters until they've
 * customized the brand, connected Drive, and added at least one client. */
export const getSetupChecklist = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data: org } = await context.supabase
      .from("orgs").select("logo_path, color_primary").eq("id", context.orgId).maybeSingle();
    const brandingDone = !!(org?.logo_path || org?.color_primary);

    const { data: drive } = await context.supabase
      .from("org_google_credentials").select("org_id").eq("org_id", context.orgId).maybeSingle();
    const driveConnected = !!drive || (context.orgId === LUZERIA_ORG_ID && !!process.env.GOOGLE_REFRESH_TOKEN);

    const { count } = await context.supabase
      .from("clients").select("id", { count: "exact", head: true }).eq("archived", false).neq("category", "Ex-clientes");
    const hasClients = (count ?? 0) > 0;

    return { brandingDone, driveConnected, hasClients };
  });

export const getOrgPlanStatus = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data: org } = await context.supabase
      .from("orgs").select("plan_id, subscription_status, trial_ends_at, tax_id, asaas_subscription_id, max_collaborators_override").eq("id", context.orgId).maybeSingle();
    const planId = (org as any)?.plan_id ?? "solo";
    const { data: plan } = await context.supabase.from("plans").select("*").eq("id", planId).maybeSingle();
    const { count: clientsUsed } = await context.supabase
      .from("clients").select("id", { count: "exact", head: true }).eq("archived", false).neq("category", "Ex-clientes");
    const { count: collaboratorsUsed } = await context.supabase
      .from("profiles").select("id", { count: "exact", head: true }).eq("active", true);
    return {
      planId,
      planName: (plan as any)?.name ?? "Solo",
      priceCents: (plan as any)?.price_cents ?? null,
      maxClients: (plan as any)?.max_clients ?? null,
      maxCollaborators: (org as any)?.max_collaborators_override ?? (plan as any)?.max_collaborators ?? null,
      features: ((plan as any)?.features ?? {}) as Record<string, boolean | string | number | null>,
      subscriptionStatus: (org as any)?.subscription_status ?? "trialing",
      trialEndsAt: (org as any)?.trial_ends_at ?? null,
      clientsUsed: clientsUsed ?? 0,
      collaboratorsUsed: collaboratorsUsed ?? 0,
      taxId: (org as any)?.tax_id ?? null,
      hasAsaasSubscription: !!(org as any)?.asaas_subscription_id,
    };
  });

/** Platform-admin only: every agency on Modo Criador with its plan and
 * billing status, for the "Financeiro" tab in Settings. */
export const listOrgsBilling = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");

    const { data: orgs, error } = await context.supabase
      .from("orgs")
      .select("id, name, slug, plan_id, subscription_status, trial_ends_at, asaas_subscription_id, created_at, tax_id, whatsapp, is_reseller, reseller_org_id")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const resellerNameById = new Map((orgs ?? []).map((o: any) => [o.id, o.name as string]));

    const { data: plans } = await context.supabase.from("plans").select("id, name, price_cents");
    const planMap = new Map((plans ?? []).map((p: any) => [p.id, p]));

    // clients RLS only allows org_id = current_org_id() — even for the
    // platform admin — so this needs the service-role client to see every
    // agency's clients, not just Luzeria's own.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: clientRows } = await supabaseAdmin
      .from("clients").select("org_id").eq("archived", false).neq("category", "Ex-clientes");
    const clientsByOrg = new Map<string, number>();
    (clientRows ?? []).forEach((c: any) => clientsByOrg.set(c.org_id, (clientsByOrg.get(c.org_id) ?? 0) + 1));

    // Owner contact (name + email) — the earliest-created "master" profile
    // in each org, same as who received the signup confirmation email.
    const { data: masterRoles } = await supabaseAdmin
      .from("user_roles").select("user_id").eq("role", "master");
    const masterIds = new Set((masterRoles ?? []).map((r: any) => r.user_id));
    const { data: ownerProfiles } = await supabaseAdmin
      .from("profiles").select("id, org_id, name, email, created_at")
      .in("org_id", (orgs ?? []).map((o: any) => o.id));
    const ownerByOrg = new Map<string, { name: string; email: string }>();
    (ownerProfiles ?? [])
      .filter((p: any) => masterIds.has(p.id))
      .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
      .forEach((p: any) => {
        if (!ownerByOrg.has(p.org_id)) ownerByOrg.set(p.org_id, { name: p.name, email: p.email });
      });

    // Pra cada revendedor, quantas instâncias ele já revendeu e quanto isso
    // soma no atacado — dá pra ver isso na lista sem abrir org por org.
    const { data: wholesaleRows } = await supabaseAdmin
      .from("reseller_wholesale_prices").select("reseller_org_id, plan_id, wholesale_price_cents");
    const wholesaleByResellerPlan = new Map<string, number>(
      (wholesaleRows ?? []).map((w: any) => [`${w.reseller_org_id}:${w.plan_id}`, w.wholesale_price_cents as number]));
    const resoldCountByReseller = new Map<string, number>();
    const resoldTotalByReseller = new Map<string, number>();
    (orgs ?? []).forEach((o: any) => {
      if (!o.reseller_org_id) return;
      resoldCountByReseller.set(o.reseller_org_id, (resoldCountByReseller.get(o.reseller_org_id) ?? 0) + 1);
      const cents = wholesaleByResellerPlan.get(`${o.reseller_org_id}:${o.plan_id}`) ?? 0;
      resoldTotalByReseller.set(o.reseller_org_id, (resoldTotalByReseller.get(o.reseller_org_id) ?? 0) + cents);
    });

    return (orgs ?? []).map((o: any) => {
      const plan = planMap.get(o.plan_id);
      const owner = ownerByOrg.get(o.id);
      return {
        id: o.id as string,
        name: o.name as string,
        slug: o.slug as string,
        planId: o.plan_id as string,
        planName: (plan as any)?.name ?? o.plan_id,
        priceCents: (plan as any)?.price_cents ?? null,
        subscriptionStatus: o.subscription_status as string,
        trialEndsAt: o.trial_ends_at as string | null,
        hasAsaasSubscription: !!o.asaas_subscription_id,
        clientsUsed: clientsByOrg.get(o.id) ?? 0,
        createdAt: o.created_at as string,
        taxId: o.tax_id as string | null,
        whatsapp: o.whatsapp as string | null,
        ownerName: owner?.name ?? null,
        ownerEmail: owner?.email ?? null,
        isReseller: !!o.is_reseller,
        resellerOrgId: o.reseller_org_id as string | null,
        resellerOrgName: o.reseller_org_id ? (resellerNameById.get(o.reseller_org_id) ?? null) : null,
        resoldCount: o.is_reseller ? (resoldCountByReseller.get(o.id) ?? 0) : 0,
        resoldMonthlyCents: o.is_reseller ? (resoldTotalByReseller.get(o.id) ?? 0) : 0,
      };
    });
  });

/** Platform-admin only: gives an agency another trial window (TRIAL_DAYS) — for
 * when someone signs up but doesn't actually try the product in time, and
 * Junior wants to give them a second shot. Also revives a trial that had
 * already lapsed into "past_due"/"canceled" back to "trialing", since the
 * whole point is letting them properly try it. Doesn't touch orgs already
 * on a paying "active" subscription — resetting a trial makes no sense
 * there (gated client-side too, but enforced here as the source of truth). */
export const resetOrgTrial = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
    const { data: org } = await context.supabase
      .from("orgs").select("subscription_status").eq("id", data.orgId).maybeSingle();
    if ((org as any)?.subscription_status === "active") {
      throw new Error("Essa agência já é assinante ativa — não dá pra resetar teste.");
    }
    const { TRIAL_DAYS } = await import("./signup.functions");
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString();
    const { error } = await context.supabase
      .from("orgs").update({ subscription_status: "trialing", trial_ends_at: trialEndsAt }).eq("id", data.orgId);
    if (error) throw new Error(error.message);
    return { trialEndsAt };
  });

/** Platform-admin only: corrects/updates the WhatsApp number an agency gave
 * at signup (collected there since 2026-08-23; older agencies may still
 * have it null, filled in manually as Junior gets it). */
export const updateOrgWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { orgId: string; whatsapp: string }) =>
    z.object({ orgId: z.string().uuid(), whatsapp: z.string().trim().max(30) }).parse(d))
  .handler(async ({ data, context }) => {
    if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("orgs").update({ whatsapp: data.whatsapp || null }).eq("id", data.orgId);
    if (error) throw new Error(error.message);
  });

/** Platform-admin only: fetches an org's next pending Asaas invoice on
 * demand (not batched with listOrgsBilling — avoids one Asaas call per
 * agency on every load). */
export const getOrgNextInvoice = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
    const { data: org } = await context.supabase
      .from("orgs").select("asaas_subscription_id").eq("id", data.orgId).maybeSingle();
    if (!(org as any)?.asaas_subscription_id) return null;
    const { getNextPendingPayment } = await import("./asaas.server");
    const payment = await getNextPendingPayment((org as any).asaas_subscription_id);
    return payment
      ? { id: payment.id, valueCents: Math.round(payment.value * 100), invoiceUrl: payment.invoiceUrl ?? null }
      : null;
  });

/** Platform-admin only, and only for test/throwaway agencies: permanently
 * deletes an org and everything in it. Requires typing the org's exact
 * name as `confirmName` — this has no undo.
 *
 * Order matters: promotion_codes.created_by is ON DELETE RESTRICT against
 * profiles, so it has to go before any profile/auth user is removed, or
 * that deletion would fail outright. Asaas cancellation runs first and
 * aborts the whole thing on failure, so a failed cancel never leaves an
 * orphaned subscription with no org left to reference it. */
export const deleteOrg = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { orgId: string; confirmName: string }) =>
    z.object({ orgId: z.string().uuid(), confirmName: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    if (data.orgId === LUZERIA_ORG_ID) throw new Error("Não é possível remover a agência da Luzeria.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("orgs").select("id, name, asaas_subscription_id").eq("id", data.orgId).maybeSingle();
    if (orgErr || !org) throw new Error("Agência não encontrada.");
    if ((org as any).name.trim().toLowerCase() !== data.confirmName.trim().toLowerCase()) {
      throw new Error("O nome digitado não confere com o nome da agência.");
    }

    if ((org as any).asaas_subscription_id) {
      const { cancelAsaasSubscription } = await import("./asaas.server");
      try {
        await cancelAsaasSubscription((org as any).asaas_subscription_id);
      } catch (err: any) {
        throw new Error(`Não foi possível cancelar a assinatura no Asaas: ${err.message}. Nada foi apagado.`);
      }
    }

    await supabaseAdmin.from("promotion_codes").delete().eq("org_id", data.orgId);
    await supabaseAdmin.from("clients").delete().eq("org_id", data.orgId);
    await supabaseAdmin.from("email_role_assignments").delete().eq("org_id", data.orgId);
    await supabaseAdmin.from("stories_schedule").delete().eq("org_id", data.orgId);
    await supabaseAdmin.from("cleaning_schedule").delete().eq("org_id", data.orgId);
    await supabaseAdmin.from("cleaning_log").delete().eq("org_id", data.orgId);
    await supabaseAdmin.from("cleaning_settings").delete().eq("org_id", data.orgId);

    const { data: profiles } = await supabaseAdmin.from("profiles").select("id").eq("org_id", data.orgId);
    for (const p of profiles ?? []) {
      await supabaseAdmin.auth.admin.deleteUser((p as any).id);
    }

    const { error: delErr } = await supabaseAdmin.from("orgs").delete().eq("id", data.orgId);
    if (delErr) throw new Error(delErr.message);

    return { ok: true };
  });

/** Master clicks "Assinar" for a plan: creates (or reuses) the org's Asaas
 * customer + a monthly subscription for that plan's price, returns the
 * invoice URL so the org can complete the first payment (boleto/PIX/cartão). */
export const subscribeToPlan = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { planId: string }) => z.object({ planId: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");

    const { data: org } = await context.supabase
      .from("orgs").select("name, tax_id, asaas_customer_id").eq("id", context.orgId).maybeSingle();
    if (!org?.tax_id) throw new Error("Preencha o CNPJ/CPF da agência antes de assinar um plano.");

    const { data: plan } = await context.supabase.from("plans").select("id, name, price_cents").eq("id", data.planId).maybeSingle();
    if (!plan) throw new Error("Plano não encontrado.");
    if (plan.price_cents == null) throw new Error("Este plano é sob consulta — fale com a gente para contratar.");

    const { createAsaasCustomer, createAsaasSubscription } = await import("./asaas.server");

    let customerId = org.asaas_customer_id;
    if (!customerId) {
      const customer = await createAsaasCustomer({ name: org.name, cpfCnpj: org.tax_id });
      customerId = customer.id;
    }

    const { subscriptionId, invoiceUrl } = await createAsaasSubscription({
      customerId,
      valueCents: plan.price_cents,
      description: `Modo Criador — Plano ${plan.name}`,
    });

    const { error } = await context.supabase
      .from("orgs")
      .update({ plan_id: plan.id, asaas_customer_id: customerId, asaas_subscription_id: subscriptionId })
      .eq("id", context.orgId);
    if (error) throw new Error(error.message);

    return { invoiceUrl };
  });

/** Throws a friendly error if the org is at/over its plan's client cap.
 * Luzeria itself is exempt (not a customer of its own platform). */
export async function assertClientLimit(supabase: any, orgId: string) {
  if (orgId === LUZERIA_ORG_ID) return;
  const { data: org } = await supabase.from("orgs").select("plan_id").eq("id", orgId).maybeSingle();
  const { data: plan } = await supabase.from("plans").select("max_clients, name").eq("id", org?.plan_id ?? "solo").maybeSingle();
  if (plan?.max_clients == null) return;
  const { count } = await supabase.from("clients").select("id", { count: "exact", head: true }).eq("archived", false).neq("category", "Ex-clientes");
  if ((count ?? 0) >= plan.max_clients) {
    throw new Error(`Limite de ${plan.max_clients} clientes do plano ${plan.name} atingido. Faça upgrade para adicionar mais.`);
  }
}

/** Mesma ideia, mas para colaboradores — chamado antes de criar um novo
 * membro da equipe. `max_collaborators_override` permite dar a uma agência
 * específica um limite de vagas diferente do seu plano, sem mudar o plano
 * em si (o limite de clientes continua sempre vindo do plano). */
async function assertCollaboratorLimit(supabase: any, orgId: string) {
  if (orgId === LUZERIA_ORG_ID) return;
  const { data: org } = await supabase.from("orgs").select("plan_id, max_collaborators_override").eq("id", orgId).maybeSingle();
  const { data: plan } = await supabase.from("plans").select("max_collaborators, name").eq("id", org?.plan_id ?? "solo").maybeSingle();
  const effectiveMax = (org as any)?.max_collaborators_override ?? plan?.max_collaborators;
  if (effectiveMax == null) return;
  const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("active", true);
  if ((count ?? 0) >= effectiveMax) {
    throw new Error(`Limite de ${effectiveMax} colaboradores atingido. Faça upgrade para adicionar mais.`);
  }
}

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { name?: string; color?: string; icon?: string | null; avatarPath?: string | null; onboarded?: boolean; tourCompleted?: boolean }) =>
    z.object({
      name: z.string().trim().min(1).max(80).optional(),
      color: z.string().trim().max(32).optional(),
      icon: z.string().max(64).nullable().optional(),
      avatarPath: z.string().trim().max(400).nullable().optional(),
      onboarded: z.boolean().optional(),
      tourCompleted: z.boolean().optional(),
    }).strict().parse(d))
  .handler(async ({ data, context }) => {
    const update: {
      name?: string; color?: string; icon?: string | null;
      avatar_url?: string | null; onboarded_at?: string;
      tour_completed_at?: string | null;
    } = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.color !== undefined) update.color = data.color;
    if (data.icon !== undefined) update.icon = data.icon;
    if (data.avatarPath !== undefined) update.avatar_url = data.avatarPath;
    if (data.onboarded) update.onboarded_at = new Date().toISOString();
    if (data.tourCompleted === true) update.tour_completed_at = new Date().toISOString();
    if (data.tourCompleted === false) update.tour_completed_at = null;
    if (Object.keys(update).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("profiles").update(update).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId: string; role: Role }) =>
    z.object({ userId: z.string().uuid(), role: z.enum(["master","setor","member"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    await context.supabase.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await context.supabase.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId: string; active: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    const { error } = await context.supabase.from("profiles").update({ active: data.active }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setExcludeFromRanking = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId: string; excludeFromRanking: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    const { error } = await context.supabase.from("profiles")
      .update({ exclude_from_ranking: data.excludeFromRanking }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateMemberAvatar = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId: string; avatarPath: string | null }) =>
    z.object({ userId: z.string().uuid(), avatarPath: z.string().trim().max(400).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    const { error } = await context.supabase.from("profiles").update({ avatar_url: data.avatarPath }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Salário + escala são dados sensíveis: vivem numa tabela própria
 * (member_pay) protegida por RLS master-only — não em `profiles`, porque
 * column-level REVOKE não se mostrou confiável nesse projeto (a coluna
 * "email" já tinha esse mesmo problema). O cálculo de custo-hora usado na
 * Margem por cliente usa uma função SEPARADA (admin_list_member_hourly_cost,
 * master OU setor) que nunca expõe o salário/escala bruto, só o valor já
 * calculado — ver supabase/migrations/20260817170000_member_pay_table.sql. */
export type MemberPay = { userId: string; monthlySalary: number | null; workSchedule: WorkSchedule | null };

export const listMemberPay = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<MemberPay[]> => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    const { data, error } = await context.supabase.from("member_pay").select("user_id, monthly_salary, work_schedule");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      userId: r.user_id, monthlySalary: r.monthly_salary ?? null, workSchedule: r.work_schedule ?? null,
    }));
  });

export const setMemberPay = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId: string; monthlySalary: number | null; workSchedule: WorkSchedule | null }) =>
    z.object({
      userId: z.string().uuid(),
      monthlySalary: z.number().min(0).nullable(),
      workSchedule: z.object({
        mon: z.union([z.literal(0), z.literal(1), z.literal(2)]),
        tue: z.union([z.literal(0), z.literal(1), z.literal(2)]),
        wed: z.union([z.literal(0), z.literal(1), z.literal(2)]),
        thu: z.union([z.literal(0), z.literal(1), z.literal(2)]),
        fri: z.union([z.literal(0), z.literal(1), z.literal(2)]),
        sat: z.union([z.literal(0), z.literal(1), z.literal(2)]),
        sun: z.union([z.literal(0), z.literal(1), z.literal(2)]),
      }).nullable(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    const { error } = await context.supabase.from("member_pay")
      .upsert({
        user_id: data.userId, org_id: context.orgId,
        monthly_salary: data.monthlySalary, work_schedule: data.workSchedule,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function callAdminEdgeFn(
  operation: string,
  params: Record<string, unknown>,
): Promise<any> {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("Sessão inválida.");
  const url = `${process.env.SUPABASE_URL}/functions/v1/admin-auth-operations`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": authHeader,
      "apikey": process.env.SUPABASE_PUBLISHABLE_KEY!,
    },
    body: JSON.stringify({ operation, ...params }),
  });
  const json = await res.json() as any;
  if (!json.success) throw new Error(json.error || "Erro na operação de admin.");
  return json.data;
}

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("Não é possível remover a si mesmo.");
    await callAdminEdgeFn("deleteUser", { targetUserId: data.userId });
    return { ok: true };
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { email: string; password: string; name: string; role: Role }) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().min(1).max(80),
      role: z.enum(["master","setor","member"]),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCollaboratorLimit(context.supabase, context.orgId);
    const result = await callAdminEdgeFn("createUser", {
      email: data.email,
      password: data.password,
      name: data.name,
      role: data.role,
      orgId: context.orgId,
    });
    return { ok: true, id: result?.id };
  });

/** Luzeria-only: provisions a brand new agency (org) plus its first master
 * user, in one step. Used to onboard a new paying agency onto the platform. */
export const createAgency = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { orgName: string; name: string; email: string; password: string }) =>
    z.object({
      orgName: z.string().trim().min(1).max(80),
      name: z.string().trim().min(1).max(80),
      email: z.string().email(),
      password: z.string().min(6),
    }).parse(d))
  .handler(async ({ data, context }) => {
    if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");

    const slug = data.orgName.trim().toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
      || "agencia";
    const { data: org, error: orgErr } = await context.supabase
      .from("orgs").insert({ name: data.orgName.trim(), slug: `${slug}-${Date.now().toString(36)}` })
      .select().single();
    if (orgErr) throw new Error(orgErr.message);

    await callAdminEdgeFn("createUser", {
      email: data.email,
      password: data.password,
      name: data.name,
      role: "master",
      orgId: org.id,
    });
    return { ok: true, orgId: org.id as string };
  });

export const adminSendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const result = await callAdminEdgeFn("sendPasswordReset", {
      targetUserId: data.userId,
    });
    // generateLink() (inside the edge function) only mints the link — it
    // never sends anything. Delivery happens here, via Resend, since only
    // the Node side has RESEND_API_KEY.
    const { sendEmail } = await import("./resend.server");
    await sendEmail({
      to: result.email,
      subject: "Redefinição de senha — Modo Criador",
      html: `
        <p>Olá, ${result.name ?? ""}!</p>
        <p>Foi solicitada uma redefinição de senha para sua conta no Modo Criador.</p>
        <p><a href="${result.actionLink}">Clique aqui para criar uma nova senha</a></p>
        <p>Se você não pediu isso, pode ignorar este e-mail.</p>
      `,
    });
    return { ok: true, email: result.email };
  });

export const adminSetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId: string; password: string }) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(8).max(72) }).parse(d))
  .handler(async ({ data }) => {
    await callAdminEdgeFn("updateUser", {
      targetUserId: data.userId,
      password: data.password,
    });
    return { ok: true };
  });

/* ============== CLIENTS ============== */

export const updateMyAccount = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { name?: string; email?: string; password?: string }) =>
    z.object({
      name: z.string().trim().min(1).max(80).optional(),
      email: z.string().trim().email().max(255).optional(),
      password: z.string().min(6).max(128).optional(),
    }).strict().parse(d))
  .handler(async ({ data, context }) => {
    if (!data.name && !data.email && !data.password) return { ok: true };
    await callAdminEdgeFn("updateUser", {
      targetUserId: context.userId,
      email: data.email,
      password: data.password,
      name: data.name,
    });
    return { ok: true };
  });

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("clients")
      .select("id, name, color, icon, favorite, archived, category, niche, posts_per_week, reels_per_week, fixed_responsible_id, review_day, notes, created_at, description, photo_url, notify_stories_in_tasks, contract_value, payment_due_day, hidden_tabs")
      .order("name");
    if (error) throw new Error(error.message);
    const photoPaths = (data ?? []).map((c: any) => c.photo_url).filter(Boolean) as string[];
    const signedPhotos = await signAvatarPaths(context.supabase, photoPaths);
    // contract_value é dado financeiro sensível — só volta pro Adm Master, mesmo que a
    // RLS de admin manage clients já libere leitura/escrita pra setor também.
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    return (data ?? []).map<Client>((c: any) => ({
      id: c.id, name: c.name, color: c.color, icon: c.icon,
      favorite: c.favorite, archived: c.archived,
      category: c.category ?? "Social Media",
      customFields: {
        niche: c.niche ?? "",
        postsPerWeek: c.posts_per_week ?? 0,
        reelsPerWeek: c.reels_per_week ?? 0,
        fixedResponsibleId: c.fixed_responsible_id,
        reviewDay: c.review_day ?? "",
        notes: c.notes ?? "",
      },
      createdAt: c.created_at,
      description: c.description ?? null,
      photoPath: c.photo_url ?? null,
      photoUrl: c.photo_url ? (signedPhotos.get(c.photo_url) ?? null) : null,
      notifyStoriesInTasks: c.notify_stories_in_tasks ?? false,
      contractValue: isMaster ? (c.contract_value ?? null) : undefined,
      paymentDueDay: isMaster ? (c.payment_due_day ?? null) : undefined,
      hiddenTabs: c.hidden_tabs ?? null,
    }));
  });

export const setNotifyStoriesInTasks = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; enabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase.from("clients")
      .update({ notify_stories_in_tasks: data.enabled }).eq("id", data.clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setWhatsappGroupLink = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; link: string | null }) =>
    z.object({ clientId: z.string().uuid(), link: z.string().trim().max(500).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase.from("clients")
      .update({ whatsapp_group_link: data.link || null }).eq("id", data.clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nextMonthKey(key: string) {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m, 1));
}

export async function seedMonth(supabase: any, clientId: string, key: string) {
  const { data: month, error: mErr } = await supabase
    .from("months").insert({ client_id: clientId, key }).select().single();
  if (mErr) throw new Error(mErr.message);
  const items = [];
  for (let i = 1; i <= 6; i++) items.push({ month_id: month.id, type: "post", idx: i, title: `Post ${i}` });
  for (let i = 1; i <= 6; i++) items.push({ month_id: month.id, type: "reel", idx: i, title: `Reels ${i}` });
  const { error: iErr } = await supabase.from("content_items").insert(items);
  if (iErr) throw new Error(iErr.message);
  return month;
}

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { name: string; category?: string; color?: string; icon?: string | null }) =>
    z.object({
      name: z.string().trim().min(1).max(80),
      category: z.string().trim().min(1).max(40).optional(),
      color: z.string().trim().optional(),
      icon: z.string().nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    await assertClientLimit(context.supabase, context.orgId);
    const insert: any = { name: data.name, org_id: context.orgId };
    if (data.category) insert.category = data.category;
    if (data.color) insert.color = data.color;
    if (data.icon !== undefined) insert.icon = data.icon;
    const { data: client, error } = await context.supabase
      .from("clients").insert(insert).select().single();
    if (error) throw new Error(error.message);
    if ((data.category ?? "Social Media") !== "Avulsos") {
      const key = monthKey(new Date());
      await seedMonth(context.supabase, client.id, key);
    } else {
      // Avulsos: create empty month container so items can be added.
      await context.supabase.from("months").insert({ client_id: client.id, key: monthKey(new Date()) });
    }
    return { id: client.id };
  });

export const updateClient = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; patch: Record<string, any> }) => d)
  .handler(async ({ data, context }) => {
    let patch = data.patch;
    if (Object.prototype.hasOwnProperty.call(patch, "contract_value") || Object.prototype.hasOwnProperty.call(patch, "payment_due_day")) {
      const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
      if (!isMaster) {
        const { contract_value, payment_due_day, ...rest } = patch;
        patch = rest;
      }
    }
    const { error } = await context.supabase.from("clients").update(patch as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("clients").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function computeLateDays(dueDate: string | null | undefined, finalizedAt: string | null | undefined): number {
  if (!dueDate || !finalizedAt) return 0;
  // dueDate is YYYY-MM-DD; treat as end-of-day UTC.
  const due = new Date(dueDate + "T23:59:59Z").getTime();
  const fin = new Date(finalizedAt).getTime();
  if (Number.isNaN(due) || Number.isNaN(fin) || fin <= due) return 0;
  return Math.ceil((fin - due) / 86400000);
}

export const duplicateMonth = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; fromKey: string }) => d)
  .handler(async ({ data, context }) => {
    const newKey = nextMonthKey(data.fromKey);
    const { data: exists } = await context.supabase
      .from("months").select("id").eq("client_id", data.clientId).eq("key", newKey).maybeSingle();
    if (exists) return { key: newKey };
    const { data: fromMonth } = await context.supabase
      .from("months").select("id").eq("client_id", data.clientId).eq("key", data.fromKey).maybeSingle();
    const { data: newMonth, error: mErr } = await context.supabase
      .from("months").insert({ client_id: data.clientId, key: newKey }).select().single();
    if (mErr) throw new Error(mErr.message);
    if (fromMonth) {
      const { data: oldItems } = await context.supabase
        .from("content_items").select("type, idx").eq("month_id", fromMonth.id);
      if (oldItems?.length) {
        // Copy only the QUANTITY per type (post/reel/outros).
        // No titles, no assignees, no due dates, no comments, no files.
        const counts: Record<string, number> = {};
        oldItems.forEach((it: any) => { counts[it.type] = (counts[it.type] ?? 0) + 1; });
        const rows: any[] = [];
        (["post", "reel", "story", "outros"] as const).forEach((t) => {
          const n = counts[t] ?? 0;
          const status: Status = isActivityType(t) ? "PENDENTE" : "PLANEJAMENTO";
          for (let i = 1; i <= n; i++) {
            rows.push({ month_id: newMonth.id, type: t, idx: i, title: "", status });
          }
        });
        if (rows.length) {
          const { error: insErr } = await context.supabase.from("content_items").insert(rows);
          if (insErr) throw new Error(insErr.message);
        }
      }
    }
    // If there was nothing to duplicate from, leave the new month empty —
    // fabricating placeholder content here was the source of a real bug.
    return { key: newKey };
  });

export const listMonthKeys = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: months } = await context.supabase
      .from("months").select("key").eq("client_id", data.clientId).order("key");
    return (months ?? []).map((m) => m.key);
  });

export const getMonth = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; key: string }) => d)
  .handler(async ({ data, context }): Promise<MonthData | null> => {
    // Reading a month must never have side effects — creating it (empty or
    // seeded) is an explicit action (addContentItem, duplicateMonth), not
    // something that should happen just because someone viewed the page.
    const { data: month } = await context.supabase
      .from("months").select("id, key, feed_order_mode, feed_order_direction").eq("client_id", data.clientId).eq("key", data.key).maybeSingle();
    if (!month) return null;
    const { data: items } = await context.supabase
      .from("content_items")
      .select("id, type, idx, title, status, copy, drive_link, caption, updated_at, reel_type, post_format, editor_id, due_date, scheduled_at, started_at, finished_at, blocked_reason, checklist, rework_count, quality_rating, feed_order, cover_path, cover_source, ig_auto_publish, activity_location, activity_quantity, campaign_id, campaign_internal")
      .eq("month_id", month.id).order("type").order("idx");
    const itemIds = (items ?? []).map((it: any) => it.id);
    const [{ data: assignees }, { data: comments }] = await Promise.all([
      context.supabase.from("item_assignees").select("item_id, user_id").in("item_id", itemIds),
      context.supabase.from("comments").select("id, item_id, author_id, text, is_system, created_at, edited_at, audio_path, audio_duration_seconds").in("item_id", itemIds).order("created_at"),
    ]);
    const itemAssignees = new Map<string, string[]>();
    (assignees ?? []).forEach((a) => {
      const arr = itemAssignees.get(a.item_id) ?? [];
      arr.push(a.user_id); itemAssignees.set(a.item_id, arr);
    });
    const audioPaths = [...new Set((comments ?? []).map((c: any) => c.audio_path).filter(Boolean))];
    const audioUrlByPath = new Map<string, string>();
    if (audioPaths.length > 0) {
      const { data: signedAudio } = await context.supabase.storage.from("comment-audio").createSignedUrls(audioPaths, 60 * 60 * 24);
      (signedAudio ?? []).forEach((r: any) => { if (r?.path && r?.signedUrl) audioUrlByPath.set(r.path, r.signedUrl); });
    }
    const itemComments = new Map<string, ContentItem["comments"]>();
    (comments ?? []).forEach((c: any) => {
      const arr = itemComments.get(c.item_id) ?? [];
      arr.push({
        id: c.id, text: c.text, authorId: c.author_id, createdAt: c.created_at, editedAt: c.edited_at, system: c.is_system,
        audioUrl: c.audio_path ? (audioUrlByPath.get(c.audio_path) ?? null) : null,
        audioDurationSeconds: c.audio_duration_seconds ?? null,
      });
      itemComments.set(c.item_id, arr);
    });
    const campaignIds = [...new Set((items ?? []).map((it: any) => it.campaign_id).filter(Boolean))];
    const campaignNameById = new Map<string, string>();
    if (campaignIds.length > 0) {
      const { data: campaignRows } = await context.supabase.from("campaigns").select("id, name").in("id", campaignIds);
      (campaignRows ?? []).forEach((c: any) => campaignNameById.set(c.id, c.name));
    }
    const mapped = (items ?? []).map<ContentItem>((it) => ({
      id: it.id, type: it.type as ContentType, idx: it.idx, title: it.title,
      status: it.status as Status, copy: it.copy, driveLink: it.drive_link,
      caption: ((it as any).caption ?? "") as string,
      assigneeIds: itemAssignees.get(it.id) ?? [],
      comments: itemComments.get(it.id) ?? [],
      updatedAt: it.updated_at,
      reelType: ((it as any).reel_type ?? null) as any,
      postFormat: ((it as any).post_format ?? null) as any,
      editorId: ((it as any).editor_id ?? null) as any,
      dueDate: ((it as any).due_date ?? null) as any,
      scheduledAt: ((it as any).scheduled_at ?? null) as any,
      igAutoPublish: ((it as any).ig_auto_publish ?? false) as any,
      startedAt: ((it as any).started_at ?? null) as any,
      finishedAt: ((it as any).finished_at ?? null) as any,
      blockedReason: ((it as any).blocked_reason ?? null) as any,
      checklist: ((it as any).checklist ?? []) as any,
      reworkCount: ((it as any).rework_count ?? 0) as any,
      qualityRating: ((it as any).quality_rating ?? null) as any,
      feedOrder: ((it as any).feed_order ?? null) as any,
      location: ((it as any).activity_location ?? null) as any,
      activityQuantity: ((it as any).activity_quantity ?? null) as any,
      campaignId: (it as any).campaign_id ?? null,
      campaignName: (it as any).campaign_id ? campaignNameById.get((it as any).campaign_id) ?? null : null,
      campaignInternal: (it as any).campaign_internal ?? false,
    }));
    const coverPaths = (items ?? []).map((it: any) => it.cover_path).filter(Boolean);
    const signedCovers = await signCoverPaths(context.supabase, coverPaths);
    mapped.forEach((m, idx) => {
      const raw = (items ?? [])[idx] as any;
      m.coverPath = raw?.cover_path ?? null;
      m.coverSource = (raw?.cover_source ?? null) as any;
      m.coverUrl = raw?.cover_path ? signedCovers.get(raw.cover_path) ?? null : null;
    });
    return {
      id: month.id, key: month.key,
      feedOrderMode: ((month as any).feed_order_mode ?? "personalizada") as any,
      feedOrderDirection: ((month as any).feed_order_direction ?? "asc") as any,
      // Itens "internos" de campanha continuam aqui (senão o modal de
      // detalhe do item, que acha o item procurando nesses arrays, fecharia
      // sozinho ao marcar/desmarcar interno) — quem exclui da grade visível
      // de Posts/Reels e do Preview de Feed é o consumidor (ClientView,
      // FeedPreview), filtrando por campaignInternal na hora de renderizar.
      posts: mapped.filter((i) => i.type === "post"),
      reels: mapped.filter((i) => i.type === "reel"),
      stories: mapped.filter((i) => i.type === "story"),
      outros: mapped.filter((i) => i.type === "outros"),
      gravacoes: mapped.filter((i) => i.type === "gravacao"),
      roteiros: mapped.filter((i) => i.type === "roteiro"),
      sistemas: mapped.filter((i) => i.type === "sistema"),
    };
  });

/* ============== ITEMS ============== */

export const updateItem = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: {
    id: string;
    patch: {
      title?: string; copy?: string; caption?: string; drive_link?: string;
      reel_type?: string | null; post_format?: string | null; editor_id?: string | null;
      due_date?: string | null; scheduled_at?: string | null; blocked_reason?: string | null;
      activity_location?: string | null; activity_quantity?: number | null;
    };
  }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("content_items").update(data.patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Editor/reel_type/post_format writes go through these RPCs instead of
 * `updateItem` because `content_items` UPDATE is admin-only via RLS — the
 * RPCs are the narrow, explicit escape hatch that also lets an assignee
 * write them when the org has `members_can_set_editor_format` on (see
 * migration 20260814030000). Admins still pass through the same RPC; the
 * function itself checks is_admin first. */
export const setItemEditor = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; editorId: string | null }) =>
    z.object({ itemId: z.string().uuid(), editorId: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .rpc("set_item_editor", { _item_id: data.itemId, _editor_id: data.editorId as any });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setItemReelType = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; reelType: string | null }) =>
    z.object({ itemId: z.string().uuid(), reelType: z.enum(["lofi", "facil", "basico", "avancado"]).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .rpc("set_item_reel_type", { _item_id: data.itemId, _reel_type: data.reelType as any });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setItemPostFormat = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; postFormat: string | null }) =>
    z.object({ itemId: z.string().uuid(), postFormat: z.enum(["estatico", "carrossel"]).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .rpc("set_item_post_format", { _item_id: data.itemId, _post_format: data.postFormat as any });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateFeedOrder = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { monthId: string; orderedItemIds: string[] }) =>
    z.object({
      monthId: z.string().uuid(),
      orderedItemIds: z.array(z.string().uuid()).max(500),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Apenas admins podem reordenar o feed.");
    // Update each item's feed_order to its position in the array.
    // Items not in the list are reset to null so they fall to the end.
    const { data: existing } = await context.supabase
      .from("content_items").select("id").eq("month_id", data.monthId);
    const allIds = (existing ?? []).map((x: any) => x.id);
    const ordered = data.orderedItemIds.filter((id) => allIds.includes(id));
    const missing = allIds.filter((id) => !ordered.includes(id));
    const rows = [
      ...ordered.map((id, pos) => ({ id, feed_order: pos })),
      ...missing.map((id) => ({ id, feed_order: null })),
    ];
    if (rows.length) {
      const { error } = await context.supabase.rpc("update_feed_order", { p_updates: rows });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const setFeedOrderMode = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { monthId: string; mode: "personalizada" | "cronologica" }) =>
    z.object({
      monthId: z.string().uuid(),
      mode: z.enum(["personalizada", "cronologica"]),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Apenas admins podem mudar a ordem do feed.");
    const { error } = await context.supabase.from("months").update({ feed_order_mode: data.mode }).eq("id", data.monthId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setFeedOrderDirection = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { monthId: string; direction: "asc" | "desc" }) =>
    z.object({
      monthId: z.string().uuid(),
      direction: z.enum(["asc", "desc"]),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Apenas admins podem mudar a ordem do feed.");
    const { error } = await context.supabase.from("months").update({ feed_order_direction: data.direction }).eq("id", data.monthId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============== ITEM COVER (Reels) ============== */

async function assertCanEditCover(supabase: any, userId: string, itemId: string) {
  const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
  if (isAdmin) return;
  const { data: row } = await supabase
    .from("item_assignees").select("user_id").eq("item_id", itemId).eq("user_id", userId).maybeSingle();
  if (!row) throw new Error("Sem permissão para editar a capa deste item.");
}

export const setItemCover = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; coverPath: string | null; coverSource: "frame" | "upload" | null }) =>
    z.object({
      itemId: z.string().uuid(),
      coverPath: z.string().trim().max(400).nullable(),
      coverSource: z.enum(["frame", "upload"]).nullable(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanEditCover(context.supabase, context.userId, data.itemId);
    // Fetch previous cover to clean up old file
    const { data: prev } = await context.supabase
      .from("content_items").select("cover_path").eq("id", data.itemId).maybeSingle();
    const prevPath = (prev as any)?.cover_path as string | null;
    const { error } = await context.supabase
      .from("content_items")
      .update({ cover_path: data.coverPath, cover_source: data.coverSource })
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    if (prevPath && prevPath !== data.coverPath) {
      await context.supabase.storage.from("reel-covers").remove([prevPath]).catch(() => {});
    }
    return { ok: true };
  });

export const uploadItemCover = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; base64: string; contentType: string; source: "frame" | "upload" }) =>
    z.object({
      itemId: z.string().uuid(),
      base64: z.string().min(1).max(15_000_000), // ~10 MB image
      contentType: z.string().min(3).max(80),
      source: z.enum(["frame", "upload"]),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanEditCover(context.supabase, context.userId, data.itemId);
    const ext = data.contentType.includes("png") ? "png"
      : data.contentType.includes("webp") ? "webp"
      : "jpg";
    const path = `${data.itemId}/${Date.now()}.${ext}`;
    const bin = Buffer.from(data.base64, "base64");
    const { error: upErr } = await context.supabase.storage
      .from("reel-covers")
      .upload(path, bin, { contentType: data.contentType, upsert: false });
    if (upErr) throw new Error(upErr.message);

    // Remove previous cover if exists
    const { data: prev } = await context.supabase
      .from("content_items").select("cover_path").eq("id", data.itemId).maybeSingle();
    const prevPath = (prev as any)?.cover_path as string | null;

    const { error } = await context.supabase
      .from("content_items")
      .update({ cover_path: path, cover_source: data.source })
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);

    if (prevPath && prevPath !== path) {
      await context.supabase.storage.from("reel-covers").remove([prevPath]).catch(() => {});
    }

    const { data: signed } = await context.supabase.storage
      .from("reel-covers").createSignedUrl(path, 60 * 60 * 24 * 365);
    return { ok: true, coverPath: path, coverUrl: signed?.signedUrl ?? null };
  });

/* ============== CLIENT FICHA ============== */

export const getClientFicha = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) =>
    z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });

    const { data: client } = await context.supabase
      .from("clients").select("description, current_stage_id, whatsapp_group_link").eq("id", data.clientId).maybeSingle();

    const [linksRes, contactsRes, secretsRes] = await Promise.all([
      context.supabase.from("client_links")
        .select("id, client_id, label, url, position")
        .eq("client_id", data.clientId).order("position"),
      context.supabase.from("client_contacts")
        .select("id, client_id, name, role, email, phone, notes, position")
        .eq("client_id", data.clientId).order("position"),
      isAdmin
        ? context.supabase.from("client_secrets")
            .select("id, client_id, label, value, notes")
            .eq("client_id", data.clientId).order("label")
        : Promise.resolve({ data: [] }),
    ]);

    // ---- metrics ----
    const { data: months } = await context.supabase
      .from("months").select("id").eq("client_id", data.clientId);
    const monthIds = (months ?? []).map((m: any) => m.id);
    let totalItems = 0, finalized = 0, blocked = 0;
    let avgLeadTimeHours: number | null = null;
    let lastDeliveryAt: string | null = null;
    if (monthIds.length) {
      const { data: items } = await context.supabase
        .from("content_items")
        .select("status, started_at, finished_at")
        .in("month_id", monthIds);
      totalItems = (items ?? []).length;
      let sumHours = 0, leadCount = 0;
      (items ?? []).forEach((it: any) => {
        if (it.status === "PRONTO_PARA_PUBLICAR" || it.status === "FINALIZADO") {
          finalized++;
          if (it.finished_at) {
            if (!lastDeliveryAt || it.finished_at > lastDeliveryAt) lastDeliveryAt = it.finished_at;
          }
          if (it.started_at && it.finished_at) {
            const diffMs = new Date(it.finished_at).getTime() - new Date(it.started_at).getTime();
            if (diffMs > 0) { sumHours += diffMs / 3_600_000; leadCount++; }
          }
        }
        if (it.status === "TRAVADO") blocked++;
      });
      if (leadCount > 0) avgLeadTimeHours = Math.round((sumHours / leadCount) * 10) / 10;
    }

    // Contato "elegível pro WhatsApp": primeiro contato (por posição, igual já
    // ordena na Ficha) com telefone preenchido — resolvido aqui pra não duplicar
    // essa lógica entre a Ficha e o compositor de mensagem.
    const whatsappContact = (contactsRes.data ?? []).find((c: any) => c.phone && c.phone.trim())
      ?? null;

    return {
      description: (client as any)?.description ?? "",
      currentStageId: (client as any)?.current_stage_id ?? null,
      whatsappPhone: whatsappContact?.phone ?? null,
      whatsappGroupLink: (client as any)?.whatsapp_group_link ?? null,
      links: (linksRes.data ?? []).map((l: any) => ({
        id: l.id, clientId: l.client_id, label: l.label, url: l.url, sortOrder: l.position,
      })),
      contacts: (contactsRes.data ?? []).map((c: any) => ({
        id: c.id, clientId: c.client_id, name: c.name, role: c.role,
        email: c.email, phone: c.phone, notes: c.notes, sortOrder: c.position,
      })),
      secrets: (secretsRes.data ?? []).map((s: any) => ({
        id: s.id, clientId: s.client_id, label: s.label, value: s.value, notes: s.notes,
      })),
      metrics: { totalItems, finalized, blocked, avgLeadTimeHours, lastDeliveryAt },
    };
  });

export const upsertClientLink = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id?: string; clientId: string; label: string; url: string; sortOrder?: number }) =>
    z.object({
      id: z.string().uuid().optional(),
      clientId: z.string().uuid(),
      label: z.string().trim().min(1).max(120),
      url: z.string().trim().min(1).max(2000),
      sortOrder: z.number().int().min(0).max(9999).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const db: any = context.supabase;
    if (data.id) {
      const { error } = await db.from("client_links")
        .update({ label: data.label, url: data.url, position: data.sortOrder ?? 0 })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("client_links")
        .insert({ client_id: data.clientId, label: data.label, url: data.url, position: data.sortOrder ?? 0 });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteClientLink = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase.from("client_links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertClientContact = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: {
    id?: string; clientId: string; name: string;
    role?: string | null; email?: string | null; phone?: string | null; notes?: string | null;
    sortOrder?: number;
  }) => z.object({
    id: z.string().uuid().optional(),
    clientId: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    role: z.string().trim().max(120).nullable().optional(),
    email: z.string().trim().max(200).nullable().optional(),
    phone: z.string().trim().max(60).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const db: any = context.supabase;
    const payload: any = {
      name: data.name, role: data.role ?? "", email: data.email ?? "",
      phone: data.phone ?? "", notes: data.notes ?? "", position: data.sortOrder ?? 0,
    };
    if (data.id) {
      const { error } = await db.from("client_contacts").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      payload.client_id = data.clientId;
      const { error } = await db.from("client_contacts").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteClientContact = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase.from("client_contacts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertClientSecret = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id?: string; clientId: string; label: string; value: string; notes?: string | null }) =>
    z.object({
      id: z.string().uuid().optional(),
      clientId: z.string().uuid(),
      label: z.string().trim().min(1).max(120),
      value: z.string().min(1).max(2000),
      notes: z.string().trim().max(2000).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const db: any = context.supabase;
    if (data.id) {
      const { error } = await db.from("client_secrets")
        .update({ label: data.label, value: data.value, notes: data.notes ?? null })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("client_secrets")
        .insert({ client_id: data.clientId, label: data.label, value: data.value, notes: data.notes ?? null });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteClientSecret = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase.from("client_secrets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setItemStatus = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; status: Status }) => d)
  .handler(async ({ data, context }) => {
    // Fetch current status + assignees before changing
    const { data: current } = await context.supabase
      .from("content_items")
      .select("status, item_assignees(user_id)")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await context.supabase
      .rpc("set_item_status", { p_item_id: data.id, p_status: data.status });
    if (error) throw new Error(error.message);

    // Log transition (fire-and-forget, don't block on error)
    const assigneeIds = (current?.item_assignees ?? []).map((a: any) => a.user_id);
    context.supabase.from("status_transitions").insert({
      item_id: data.id,
      from_status: current?.status ?? null,
      to_status: data.status,
      changed_by: context.userId,
      assignee_ids: assigneeIds,
    }).then(() => {});

    // Push (if any) is dispatched uniformly by the notification-preferences
    // aware cron in push-dispatch.functions.ts, off the `status` row the
    // on_status_change() DB trigger already inserts into `notifications`.

    return { ok: true };
  });

export const addAssignee = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; userId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: assigneeProfile } = await context.supabase
      .from("profiles").select("org_id").eq("id", data.userId).maybeSingle();
    if (!assigneeProfile || assigneeProfile.org_id !== context.orgId) {
      throw new Error("Forbidden: usuário não pertence a esta agência");
    }

    const { error } = await context.supabase.from("item_assignees")
      .insert({ item_id: data.itemId, user_id: data.userId });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);

    // Push (if any) is dispatched uniformly by the notification-preferences
    // aware cron in push-dispatch.functions.ts, off the `assigned` row the
    // notify_on_assignment() DB trigger already inserts into `notifications`.

    return { ok: true };
  });

export const addContentItem = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; key: string; type: ContentType; title?: string; dueDate?: string | null; notes?: string | null; location?: string | null; quantity?: number | null; campaignId?: string | null; campaignInternal?: boolean }) =>
    z.object({
      clientId: z.string().uuid(),
      key: z.string(),
      type: z.enum(["post", "reel", "story", "outros", "gravacao", "roteiro", "sistema"]),
      title: z.string().trim().max(200).optional(),
      dueDate: z.string().nullable().optional(),
      notes: z.string().trim().max(2000).nullable().optional(),
      location: z.string().trim().max(500).nullable().optional(),
      quantity: z.number().int().min(0).max(100000).nullable().optional(),
      campaignId: z.string().uuid().nullable().optional(),
      campaignInternal: z.boolean().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    let { data: month } = await context.supabase
      .from("months").select("id").eq("client_id", data.clientId).eq("key", data.key).maybeSingle();
    if (!month) {
      const { data: m, error } = await context.supabase
        .from("months").insert({ client_id: data.clientId, key: data.key }).select("id").single();
      if (error) throw new Error(error.message);
      month = m;
    }
    const { data: maxRow } = await context.supabase
      .from("content_items").select("idx").eq("month_id", month.id).eq("type", data.type)
      .order("idx", { ascending: false }).limit(1).maybeSingle();
    const nextIdx = ((maxRow as any)?.idx ?? 0) + 1;
    const insertRow: Record<string, any> = {
      month_id: month.id, type: data.type, idx: nextIdx,
      title: (data.title?.trim() || ""),
    };
    if (isActivityType(data.type)) insertRow.status = "PENDENTE";
    if (data.dueDate) insertRow.due_date = data.dueDate;
    if (data.notes) insertRow.copy = data.notes;
    if (data.location) insertRow.activity_location = data.location;
    if (data.quantity !== undefined && data.quantity !== null) insertRow.activity_quantity = data.quantity;
    if (data.campaignId) {
      insertRow.campaign_id = data.campaignId;
      insertRow.campaign_internal = data.campaignInternal ?? false;
    }
    const { data: inserted, error: iErr } = await context.supabase
      .from("content_items").insert(insertRow).select("id").single();
    if (iErr) throw new Error(iErr.message);
    return { id: inserted.id };
  });

/** Reordenar arrastando dentro da própria grade (posts ou reels de um
 * mesmo mês). Só faz sentido em "ordem personalizada" — em cronológica a
 * ordem já vem da data agendada. */
export const reorderContentItems = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { monthId: string; type: ContentType; orderedItemIds: string[] }) =>
    z.object({
      monthId: z.string().uuid(),
      type: z.enum(["post", "reel", "story", "outros", "gravacao", "roteiro", "sistema"]),
      orderedItemIds: z.array(z.string().uuid()).max(500),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: existing } = await context.supabase
      .from("content_items").select("id").eq("month_id", data.monthId).eq("type", data.type);
    const allIds = new Set((existing ?? []).map((x: any) => x.id));
    const rows = data.orderedItemIds
      .filter((id) => allIds.has(id))
      .map((id, pos) => ({ id, idx: pos + 1 }));
    if (rows.length) {
      const { error } = await context.supabase.rpc("update_item_idx", { p_updates: rows });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Move um post/reel pra outro mês do mesmo cliente — cria o mês de
 * destino se ainda não existir (mesmo fallback do addContentItem), e o
 * item entra no fim da fila desse mês/tipo. */
export const moveItemToMonth = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; targetKey: string }) =>
    z.object({
      itemId: z.string().uuid(),
      targetKey: z.string().regex(/^\d{4}-\d{2}$/),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: item, error: itemErr } = await context.supabase
      .from("content_items")
      .select("id, type, month_id, months!inner(client_id, key)")
      .eq("id", data.itemId).single();
    if (itemErr || !item) throw new Error(itemErr?.message ?? "Item não encontrado.");
    const clientId = (item as any).months.client_id as string;
    const currentKey = (item as any).months.key as string;
    if (currentKey === data.targetKey) return { ok: true };
    let { data: targetMonth } = await context.supabase
      .from("months").select("id").eq("client_id", clientId).eq("key", data.targetKey).maybeSingle();
    if (!targetMonth) {
      const { data: m, error } = await context.supabase
        .from("months").insert({ client_id: clientId, key: data.targetKey, org_id: context.orgId }).select("id").single();
      if (error) throw new Error(error.message);
      targetMonth = m;
    }
    const { data: maxRow } = await context.supabase
      .from("content_items").select("idx").eq("month_id", targetMonth.id).eq("type", item.type)
      .order("idx", { ascending: false }).limit(1).maybeSingle();
    const nextIdx = ((maxRow as any)?.idx ?? 0) + 1;
    const { error: updErr } = await context.supabase
      .from("content_items")
      .update({ month_id: targetMonth.id, idx: nextIdx, feed_order: null })
      .eq("id", data.itemId);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });

/** "Excluir" não apaga de verdade — só marca deleted_at/deleted_by
 * (soft delete). O item some de toda tela normal (a política de RLS já
 * filtra deleted_at is null pra todo mundo), mas continua existindo
 * intacto por 7 dias, restaurável na Lixeira — ver trash.functions.ts.
 * Usa o service role pra essa escrita especificamente: content_items tem
 * uma política de UPDATE sem menção a deleted_at (de propósito, pra não
 * bloquear edições normais), mas por algum motivo do Postgres/RLS que não
 * conseguimos isolar, a MESMA política rejeita a transição desse campo de
 * nulo pra preenchido mesmo sem citá-lo — só o service role, que ignora
 * RLS, escreve esse campo de forma confiável. */
export const deleteItem = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("content_items")
      .update({ deleted_at: new Date().toISOString(), deleted_by: context.userId })
      .eq("id", data.id).eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteContentItems = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { ids: string[] }) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("content_items")
      .update({ deleted_at: new Date().toISOString(), deleted_by: context.userId })
      .in("id", data.ids).eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true, count: data.ids.length };
  });

export const removeAssignee = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; userId: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("item_assignees")
      .delete().eq("item_id", data.itemId).eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; text: string }) =>
    z.object({ itemId: z.string().uuid(), text: z.string().trim().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("comments")
      .insert({ item_id: data.itemId, author_id: context.userId, text: data.text, is_system: false });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============== NOTIFICATIONS ============== */

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notifications")
      .select("*, content_items(month_id, months(client_id, key))")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false }).limit(50);
    return (data ?? []).map((n: any) => ({
      id: n.id, type: n.type, itemId: n.item_id,
      message: n.message, read: n.read, createdAt: n.created_at,
      clientId: n.client_id ?? n.content_items?.months?.client_id ?? null,
      monthKey: n.content_items?.months?.key ?? null,
    }));
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id?: string; all?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const q = context.supabase.from("notifications").update({ read: true }).eq("user_id", context.userId);
    if (data.id) await q.eq("id", data.id);
    else await q.eq("read", false);
    return { ok: true };
  });

export const listMyMentions = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data: mens } = await context.supabase
      .from("mentions")
      .select("id, item_id, comment_id, created_at, read_at, comments(text, author_id, profiles:author_id(name, color)), content_items(id, type, idx, title, status, month_id, months(key, clients!months_client_id_fkey(id, name, color, category)))")
      .eq("mentioned_user_id", context.userId)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(30);
    return (mens ?? [])
      .filter((m: any) => m.content_items && m.content_items.months?.clients)
      .map((m: any) => {
        const it = m.content_items;
        const c = it.months.clients;
        return {
          mentionId: m.id,
          itemId: it.id,
          type: it.type as "post" | "reel" | "outros",
          idx: it.idx as number,
          title: it.title as string,
          status: it.status as string,
          monthKey: it.months.key as string,
          clientId: c.id as string,
          clientName: c.name as string,
          clientColor: c.color as string,
          clientCategory: (c.category ?? "Social Media") as string,
          mentionedAt: m.created_at as string,
          authorName: (m.comments?.profiles?.name ?? null) as string | null,
          snippet: ((m.comments?.text ?? "") as string).replace(/@\[([^\]]+)\]\([0-9a-f-]{36}\)/g, "@$1").slice(0, 140),
        };
      });
  });

export const markMentionRead = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { mentionId?: string; itemId?: string; all?: boolean }) => d)
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("mentions").update({ read_at: new Date().toISOString() }).eq("mentioned_user_id", context.userId);
    if (data.mentionId) q = q.eq("id", data.mentionId);
    else if (data.itemId) q = q.eq("item_id", data.itemId);
    else q = q.is("read_at", null);
    await q;
    return { ok: true };
  });

/* ============== MY TASKS ============== */

export const listMyTasks = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId?: string }) => d)
  .handler(async ({ data, context }) => {
    let targetUser = context.userId;
    if (data.userId && data.userId !== context.userId) {
      const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
      if (!isAdmin) throw new Error("Forbidden");
      targetUser = data.userId;
    }
    const { data: assigns } = await context.supabase
      .from("item_assignees").select("item_id").eq("user_id", targetUser);
    const itemIds = (assigns ?? []).map((a) => a.item_id);
    if (itemIds.length === 0) return [];
    const { data: items } = await context.supabase
      .from("content_items")
      .select("id, type, idx, title, status, due_date, month_id, months!inner(client_id, key, clients!months_client_id_fkey!inner(id, name, color, category, notify_stories_in_tasks))")
      .in("id", itemIds);
    return (items ?? [])
      // Stories only show up here for clients that opted in — otherwise
      // high-frequency Stories work would clutter everyone's task list.
      .filter((it: any) => it.type !== "story" || it.months.clients.notify_stories_in_tasks)
      .map((it: any) => ({
        id: it.id, type: it.type, idx: it.idx, title: it.title, status: it.status,
        dueDate: it.due_date ?? null,
        monthKey: it.months.key, clientId: it.months.clients.id,
        clientName: it.months.clients.name, clientColor: it.months.clients.color,
        clientCategory: it.months.clients.category ?? "Social Media",
      }));
  });

/* ============== PRODUCTIVITY ============== */

export const getProductivity = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId?: string; monthKey: string }) => d)
  .handler(async ({ data, context }) => {
    let targetUser = context.userId;
    if (data.userId && data.userId !== context.userId) {
      const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
      if (!isAdmin) throw new Error("Forbidden");
      targetUser = data.userId;
    }
    const [y, m] = data.monthKey.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const end = new Date(Date.UTC(y, m, 1)).toISOString();
    const [{ data: assigns }, { data: edited }] = await Promise.all([
      context.supabase.from("item_assignees").select("item_id").eq("user_id", targetUser),
      context.supabase.from("content_items").select("id").eq("editor_id", targetUser),
    ]);
    const itemIds = [...new Set([
      ...(assigns ?? []).map((a) => a.item_id),
      ...(edited ?? []).map((e) => e.id),
    ])];
    if (itemIds.length === 0) {
      return { weeks: [0, 0, 0, 0], items: [[], [], [], []] as string[][], total: 0, history: [] };
    }
    const { data: done } = await context.supabase
      .from("content_items").select("id, title, updated_at")
      .in("id", itemIds).in("status", ["PRONTO_PARA_PUBLICAR", "FINALIZADO", "CONCLUIDO"])
      .gte("updated_at", start).lt("updated_at", end);
    const weeks = [0, 0, 0, 0];
    const items: string[][] = [[], [], [], []];
    (done ?? []).forEach((it: any) => {
      const day = new Date(it.updated_at).getUTCDate();
      const w = Math.min(3, Math.floor((day - 1) / 7));
      weeks[w]++; items[w].push(it.title);
    });
    // 6-month history
    const histStart = new Date(Date.UTC(y, m - 6, 1)).toISOString();
    const { data: hist } = await context.supabase
      .from("content_items").select("updated_at")
      .in("id", itemIds).in("status", ["PRONTO_PARA_PUBLICAR", "FINALIZADO", "CONCLUIDO"])
      .gte("updated_at", histStart).lt("updated_at", end);
    const history: { key: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      history.push({ key: k, count: 0 });
    }
    (hist ?? []).forEach((it: any) => {
      const d = new Date(it.updated_at);
      const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const h = history.find((x) => x.key === k);
      if (h) h.count++;
    });
    return { weeks, items, total: (done ?? []).length, history };
  });

/** Monthly count of registered activities (gravação/roteiro/sistema/outros) — separate
 * from post/reel productivity, since these aren't "published" content. */
export const getMyActivityCounts = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId?: string; monthKey: string }) => d)
  .handler(async ({ data, context }) => {
    let targetUser = context.userId;
    if (data.userId && data.userId !== context.userId) {
      const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
      if (!isAdmin) throw new Error("Forbidden");
      targetUser = data.userId;
    }
    const [y, m] = data.monthKey.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const end = new Date(Date.UTC(y, m, 1)).toISOString();
    const { data: rows, error } = await context.supabase
      .from("finalizations")
      .select("finalized_at, content_items!inner(type, activity_quantity)")
      .eq("user_id", targetUser)
      .gte("finalized_at", start).lt("finalized_at", end);
    if (error) throw new Error(error.message);
    const counts = { gravacao: 0, roteiro: 0, sistema: 0, outros: 0 };
    (rows ?? []).forEach((r: any) => {
      const t = r.content_items?.type;
      if (t && t in counts) {
        // Gravação conta pela quantidade de vídeos gravados, não por item.
        const qty = r.content_items?.activity_quantity;
        const weight = t === "gravacao" && qty > 0 ? qty : 1;
        (counts as any)[t] += weight;
      }
    });
    return counts;
  });

export const getMyToday = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId?: string; today: string; weekday: number }) => d)
  .handler(async ({ data, context }) => {
    let targetUser = context.userId;
    if (data.userId && data.userId !== context.userId) {
      const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
      if (!isAdmin) throw new Error("Forbidden");
      targetUser = data.userId;
    }
    let cleaningTasks: { taskId: string; taskName: string }[] = [];
    let cleaningStatuses: { taskId: string; status: "done" | "missed" }[] = [];
    if (data.weekday >= 0 && data.weekday <= 5) {
      const { data: rows } = await context.supabase
        .from("cleaning_schedule")
        .select("task_id, cleaning_tasks(name)")
        .eq("weekday", data.weekday).eq("user_id", targetUser);
      cleaningTasks = (rows ?? []).map((r: any) => ({ taskId: r.task_id as string, taskName: (r.cleaning_tasks?.name ?? "") as string }));
      if (cleaningTasks.length > 0) {
        const { data: logs } = await context.supabase
          .from("cleaning_log")
          .select("task_id, status")
          .eq("occurrence_date", data.today)
          .eq("weekday", data.weekday)
          .in("task_id", cleaningTasks.map((t) => t.taskId));
        cleaningStatuses = (logs ?? []).map((r: any) => ({ taskId: r.task_id, status: r.status }));
      }
    }
    return {
      cleaningTasks,
      cleaningStatuses,
    };
  });

/* ============== CLEANING ============== */

export const getCleaning = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    // Compute Monday-based week start in UTC
    const now = new Date();
    const dow = now.getUTCDay(); // 0=Sun..6=Sat
    const diffToMon = (dow + 6) % 7;
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMon));
    const sunday = new Date(monday); sunday.setUTCDate(monday.getUTCDate() + 6);
    const weekStart = monday.toISOString().slice(0, 10);
    const weekEnd = sunday.toISOString().slice(0, 10);

    const [{ data: taskRows }, { data: rows }, { data: settings }, { data: logs }] = await Promise.all([
      context.supabase.from("cleaning_tasks").select("id, name, sort_order").order("sort_order"),
      context.supabase.from("cleaning_schedule").select("id, task_id, weekday, user_id, label"),
      context.supabase.from("cleaning_settings").select("note").eq("org_id", context.orgId).maybeSingle(),
      context.supabase.from("cleaning_log")
        .select("task_id, weekday, occurrence_date, status, done_at, done_by")
        .gte("occurrence_date", weekStart).lte("occurrence_date", weekEnd),
    ]);
    return {
      tasks: (taskRows ?? []).map((t: any) => ({
        id: t.id as string, name: t.name as string, sortOrder: t.sort_order as number,
      })),
      cells: (rows ?? []).map((r: any) => ({
        id: r.id as string,
        taskId: r.task_id as string,
        weekday: r.weekday as number,
        userId: (r.user_id ?? null) as string | null,
        label: (r.label ?? null) as string | null,
      })),
      note: (settings?.note ?? "") as string,
      weekStart,
      weekLog: (logs ?? []).map((r: any) => ({
        taskId: r.task_id as string,
        weekday: r.weekday as number,
        occurrenceDate: r.occurrence_date as string,
        status: r.status as "done" | "missed",
        doneAt: (r.done_at ?? null) as string | null,
        doneBy: (r.done_by ?? null) as string | null,
      })),
    };
  });

export const listCleaningTasks = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("cleaning_tasks").select("id, name, sort_order").order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []).map((t: any) => ({ id: t.id as string, name: t.name as string, sortOrder: t.sort_order as number }));
  });

export const addCleaningTask = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { name: string }) => z.object({ name: z.string().trim().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    const { data: maxRow } = await context.supabase
      .from("cleaning_tasks").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const nextOrder = (maxRow?.sort_order ?? -1) + 1;
    const { error } = await context.supabase
      .from("cleaning_tasks").insert({ org_id: context.orgId, name: data.name, sort_order: nextOrder });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameCleaningTask = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; name: string }) => z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    const { error } = await context.supabase.from("cleaning_tasks").update({ name: data.name }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCleaningTask = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    const { error } = await context.supabase.from("cleaning_tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertCleaningCell = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { taskId: string; weekday: number; userId?: string | null; label?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    if (!data.userId && !data.label) {
      const { error } = await context.supabase
        .from("cleaning_schedule").delete().eq("task_id", data.taskId).eq("weekday", data.weekday);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase
      .from("cleaning_schedule")
      .upsert({ org_id: context.orgId, task_id: data.taskId, weekday: data.weekday, user_id: data.userId ?? null, label: data.label ?? null, updated_at: new Date().toISOString() }, { onConflict: "org_id,task_id,weekday" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCleaningDone = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { taskId: string; weekday: number; occurrenceDate: string; done: boolean }) =>
    z.object({
      taskId: z.string().uuid(),
      weekday: z.number().int().min(0).max(6),
      occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      done: z.boolean(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    // Validate responsibility (responsible scheduled OR admin)
    const [{ data: isAdmin }, { data: cell }] = await Promise.all([
      context.supabase.rpc("is_admin", { _user_id: context.userId }),
      context.supabase.from("cleaning_schedule")
        .select("user_id").eq("task_id", data.taskId).eq("weekday", data.weekday).maybeSingle(),
    ]);
    if (!isAdmin && cell?.user_id !== context.userId) throw new Error("Forbidden");

    if (!data.done) {
      // Mark back to pending: remove the log row
      const { error } = await context.supabase
        .from("cleaning_log")
        .delete()
        .eq("task_id", data.taskId)
        .eq("weekday", data.weekday)
        .eq("occurrence_date", data.occurrenceDate);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    const { error } = await context.supabase
      .from("cleaning_log")
      .upsert({
        org_id: context.orgId,
        task_id: data.taskId,
        weekday: data.weekday,
        occurrence_date: data.occurrenceDate,
        user_id: cell?.user_id ?? null,
        status: "done",
        done_at: new Date().toISOString(),
        done_by: context.userId,
      }, { onConflict: "org_id,task_id,weekday,occurrence_date" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateCleaningNote = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { note: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("cleaning_settings").upsert({ org_id: context.orgId, note: data.note, updated_at: new Date().toISOString() }, { onConflict: "org_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============== ADMIN DASHBOARD ============== */

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { monthKey: string }) =>
    z.object({ monthKey: z.string().regex(/^\d{4}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: clientsAll } = await context.supabase
      .from("clients").select("id, name, color, archived, category, photo_url, posts_per_week, reels_per_week").order("name");
    // "Ex-clientes" não entram nas métricas nem na listagem do dashboard.
    const clients = (clientsAll ?? []).filter(
      (c: any) => (c.category ?? "Social Media") !== "Ex-clientes"
    );
    const photoMap = await signAvatarPaths(context.supabase, clients.map((c: any) => c.photo_url));
    const { data: months } = await context.supabase
      .from("months").select("id, client_id").eq("key", data.monthKey);
    const monthIds = (months ?? []).map((m) => m.id);
    const monthByClient = new Map<string, string>();
    (months ?? []).forEach((m) => monthByClient.set(m.client_id, m.id));
    const { data: items } = monthIds.length
      ? await context.supabase
          .from("content_items").select("id, month_id, type, status, title").in("month_id", monthIds)
      : { data: [] as any[] };

    type Row = {
      id: string; name: string; color: string; archived: boolean; category: string;
      photoUrl: string | null;
      posts: number; reels: number; total: number; done: number; percent: number;
      contracted: number;
    };
    const rows: Row[] = (clients ?? []).map((c: any) => {
      const mid = monthByClient.get(c.id);
      const its = mid ? (items ?? []).filter((it: any) => it.month_id === mid) : [];
      const posts = its.filter((i) => i.type === "post").length;
      const reels = its.filter((i) => i.type === "reel").length;
      const total = its.length;
      const done = its.filter((i) => i.status === "PRONTO_PARA_PUBLICAR" || i.status === "FINALIZADO" || i.status === "CONCLUIDO").length;
      // % contra o combinado no contrato (posts/reels por mês), não contra o
      // que foi criado no sistema — assim dá pra ultrapassar 100% quando a
      // equipe entrega mais do que o combinado.
      const contracted = (c.posts_per_week ?? 0) + (c.reels_per_week ?? 0);
      const percent = contracted > 0
        ? Math.round((done / contracted) * 100)
        : (total ? Math.round((done / total) * 100) : 0);
      return {
        id: c.id, name: c.name, color: c.color, archived: !!c.archived,
        category: c.category ?? "Social Media",
        photoUrl: c.photo_url ? (photoMap.get(c.photo_url) ?? null) : null,
        posts, reels, total, done, percent, contracted,
      };
    });

    const active = rows.filter((r) => !r.archived);
    const totalPlanned = active.reduce((a, r) => a + r.total, 0);
    const totalDone = active.reduce((a, r) => a + r.done, 0);
    const overallPct = totalPlanned ? Math.round((totalDone / totalPlanned) * 100) : 0;
    const ontime = active.filter((r) => r.total > 0 && r.percent >= 80).length;
    const behind = active.filter((r) => r.total > 0 && r.percent < 80).length;

    // Item-level breakdown behind the "Entregues"/"Falta" metric cards —
    // only active (non-archived) clients, matching totalDone/totalPlanned above.
    const activeClientIds = new Set(active.map((r) => r.id));
    const monthIdToClient = new Map<string, any>();
    (months ?? []).forEach((m: any) => {
      const c = clients.find((cl: any) => cl.id === m.client_id);
      if (c && activeClientIds.has(c.id)) monthIdToClient.set(m.id, c);
    });
    const doneItems: { id: string; title: string; type: string; clientName: string; clientColor: string }[] = [];
    const pendingItems: typeof doneItems = [];
    (items ?? []).forEach((it: any) => {
      const c = monthIdToClient.get(it.month_id);
      if (!c) return;
      const entry = { id: it.id, title: it.title, type: it.type, clientName: c.name, clientColor: c.color };
      if (it.status === "PRONTO_PARA_PUBLICAR" || it.status === "FINALIZADO" || it.status === "CONCLUIDO") doneItems.push(entry);
      else pendingItems.push(entry);
    });

    return {
      monthKey: data.monthKey,
      totals: {
        clients: active.length,
        planned: totalPlanned,
        done: totalDone,
        percent: overallPct,
        ontime,
        behind,
      },
      clients: rows,
      doneItems,
      pendingItems,
    };
  });

/** Shared by getTopMembers/getTopMembersByGoal: derives the [start, end) UTC
 * date range for a period ending at monthKey's month. */
function periodRange(period: "month" | "3m" | "6m" | "year", monthKey: string): { start: Date; end: Date } {
  const [y, m] = monthKey.split("-").map(Number);
  const end = new Date(Date.UTC(y, m, 1)); // exclusive end = first day of next month
  let start: Date;
  if (period === "month") start = new Date(Date.UTC(y, m - 1, 1));
  else if (period === "3m") start = new Date(Date.UTC(y, m - 3, 1));
  else if (period === "6m") start = new Date(Date.UTC(y, m - 6, 1));
  else start = new Date(Date.UTC(y, 0, 1));
  return { start, end };
}

export const getTopMembers = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { period: "month" | "3m" | "6m" | "year"; monthKey: string }) =>
    z.object({
      period: z.enum(["month", "3m", "6m", "year"]),
      monthKey: z.string().regex(/^\d{4}-\d{2}$/),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { start, end } = periodRange(data.period, data.monthKey);

    const { data: finals } = await context.supabase
      .from("finalizations").select("user_id, content_items(type, activity_quantity)")
      .gte("finalized_at", start.toISOString())
      .lt("finalized_at", end.toISOString())
      // item_id is set NULL (not row-deleted) when its content_item is
      // removed — e.g. test items created then deleted. Excluding those
      // keeps deleted-item credit from lingering in the ranking forever.
      .not("item_id", "is", null);
    const counts = new Map<string, number>();
    (finals ?? []).forEach((f: any) => {
      // Gravação pontua pela quantidade de vídeos gravados, não por item.
      const it = f.content_items;
      const weight = it?.type === "gravacao" && it.activity_quantity > 0 ? it.activity_quantity : 1;
      counts.set(f.user_id, (counts.get(f.user_id) ?? 0) + weight);
    });

    const { data: profiles } = await context.supabase
      .from("profiles").select("id, name, color, icon, avatar_url, exclude_from_ranking")
      .eq("exclude_from_ranking", false);
    const avatarMap = await signAvatarPaths(context.supabase, (profiles ?? []).map((p: any) => p.avatar_url));
    const ranking = (profiles ?? [])
      .map((p: any) => ({
        id: p.id, name: p.name, color: p.color, icon: p.icon,
        avatarUrl: p.avatar_url ? (avatarMap.get(p.avatar_url) ?? null) : null,
        count: counts.get(p.id) ?? 0,
      }))
      .sort((a, b) => b.count - a.count);
    return { period: data.period, ranking };
  });

/** Ranking oficial: quem bateu (ou superou) a própria meta fica em cima,
 * independente do volume bruto. `member_goals` tem RLS restrita a
 * dono-da-meta-ou-admin (propositalmente — número de meta é privado), então
 * essa consulta em lote precisa do client de service role pra enxergar a
 * meta de todo mundo; por bypassar RLS, escopa manualmente pela lista de
 * membros ativos da org (já filtrada via context.supabase acima). */
export const getTopMembersByGoal = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { period: "month" | "3m" | "6m" | "year"; monthKey: string }) =>
    z.object({
      period: z.enum(["month", "3m", "6m", "year"]),
      monthKey: z.string().regex(/^\d{4}-\d{2}$/),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { start, end } = periodRange(data.period, data.monthKey);
    const monthKeys: string[] = [];
    for (let k = monthKey(start); k < monthKey(end); k = nextMonthKey(k)) monthKeys.push(k);

    const { data: profiles } = await context.supabase
      .from("profiles").select("id, name, color, icon, avatar_url, exclude_from_ranking")
      .eq("org_id", context.orgId).eq("exclude_from_ranking", false);
    const userIds = (profiles ?? []).map((p: any) => p.id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const goalByUser = new Map<string, { posts: number; reels: number; stories: number }>();
    const doneByUser = new Map<string, { posts: number; reels: number; stories: number }>();

    if (userIds.length > 0 && monthKeys.length > 0) {
      const { data: goalRows } = await supabaseAdmin
        .from("member_goals")
        .select("user_id, month_key, posts_goal, reels_goal, stories_goal")
        .in("user_id", userIds).in("month_key", monthKeys);
      (goalRows ?? []).forEach((r: any) => {
        const g = goalByUser.get(r.user_id) ?? { posts: 0, reels: 0, stories: 0 };
        g.posts += r.posts_goal ?? 0; g.reels += r.reels_goal ?? 0; g.stories += r.stories_goal ?? 0;
        goalByUser.set(r.user_id, g);
      });
    }

    if (userIds.length > 0) {
      const { data: assigns } = await supabaseAdmin
        .from("item_assignees").select("item_id, user_id").in("user_id", userIds);
      const itemUsers = new Map<string, string[]>();
      (assigns ?? []).forEach((a: any) => {
        const arr = itemUsers.get(a.item_id) ?? [];
        arr.push(a.user_id);
        itemUsers.set(a.item_id, arr);
      });
      const itemIds = [...itemUsers.keys()];
      if (itemIds.length > 0) {
        const { data: doneItems } = await supabaseAdmin
          .from("content_items").select("id, type")
          .in("id", itemIds).in("status", ["PRONTO_PARA_PUBLICAR", "FINALIZADO"])
          .gte("updated_at", start.toISOString()).lt("updated_at", end.toISOString());
        (doneItems ?? []).forEach((it: any) => {
          if (it.type !== "post" && it.type !== "reel") return;
          (itemUsers.get(it.id) ?? []).forEach((uid) => {
            const d = doneByUser.get(uid) ?? { posts: 0, reels: 0, stories: 0 };
            if (it.type === "post") d.posts++; else d.reels++;
            doneByUser.set(uid, d);
          });
        });
      }

      const { data: storyRows } = await supabaseAdmin
        .from("stories_schedule").select("user_id, day")
        .eq("org_id", context.orgId).in("user_id", userIds)
        .gte("day", start.toISOString().slice(0, 10)).lt("day", end.toISOString().slice(0, 10));
      (storyRows ?? []).forEach((r: any) => {
        const d = doneByUser.get(r.user_id) ?? { posts: 0, reels: 0, stories: 0 };
        d.stories++;
        doneByUser.set(r.user_id, d);
      });
    }

    const avatarMap = await signAvatarPaths(context.supabase, (profiles ?? []).map((p: any) => p.avatar_url));
    const ranking: any[] = [];
    const noGoal: any[] = [];
    (profiles ?? []).forEach((p: any) => {
      const goal = goalByUser.get(p.id) ?? { posts: 0, reels: 0, stories: 0 };
      const done = doneByUser.get(p.id) ?? { posts: 0, reels: 0, stories: 0 };
      const totalGoal = goal.posts + goal.reels + goal.stories;
      const base = {
        id: p.id, name: p.name, color: p.color, icon: p.icon,
        avatarUrl: p.avatar_url ? (avatarMap.get(p.avatar_url) ?? null) : null,
      };
      if (totalGoal === 0) { noGoal.push(base); return; }
      // Só credita o "feito" de uma categoria se ela tinha meta > 0 — sem
      // isso, entregas fora da meta configurada inflariam a % à toa.
      const totalDone =
        (goal.posts > 0 ? done.posts : 0) +
        (goal.reels > 0 ? done.reels : 0) +
        (goal.stories > 0 ? done.stories : 0);
      ranking.push({ ...base, pct: (totalDone / totalGoal) * 100, totalDone, totalGoal });
    });
    ranking.sort((a, b) => b.pct - a.pct || b.totalDone - a.totalDone);

    return { period: data.period, ranking, noGoal };
  });

/* ============== MEMBER FINALIZATIONS ============== */

export const getMemberFinalizations = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId: string; period: "month" | "3m" | "6m" | "year"; monthKey: string }) =>
    z.object({
      userId: z.string().uuid(),
      period: z.enum(["month", "3m", "6m", "year"]),
      monthKey: z.string().regex(/^\d{4}-\d{2}$/),
    }).parse(d))
  .handler(async ({ data, context }) => {
    // Membros só veem as próprias finalizações; adm vê de qualquer um.
    if (data.userId !== context.userId) {
      const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
      if (!isAdmin) throw new Error("Forbidden");
    }
    const [y, m] = data.monthKey.split("-").map(Number);
    const end = new Date(Date.UTC(y, m, 1));
    let start: Date;
    if (data.period === "month") start = new Date(Date.UTC(y, m - 1, 1));
    else if (data.period === "3m") start = new Date(Date.UTC(y, m - 3, 1));
    else if (data.period === "6m") start = new Date(Date.UTC(y, m - 6, 1));
    else start = new Date(Date.UTC(y, 0, 1));

    const { data: rows, error } = await context.supabase
      .from("finalizations")
      .select(
        "finalized_at, content_items!inner(id, type, idx, title, activity_quantity, months!inner(key, clients!months_client_id_fkey!inner(id, name, color, category)))"
      )
      .eq("user_id", data.userId)
      .gte("finalized_at", start.toISOString())
      .lt("finalized_at", end.toISOString())
      .order("finalized_at", { ascending: false });
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r: any) => ({
      itemId: r.content_items.id as string,
      type: r.content_items.type as ContentType,
      title: r.content_items.title as string,
      activityQuantity: (r.content_items.activity_quantity ?? null) as number | null,
      finalizedAt: r.finalized_at as string,
      clientId: r.content_items.months.clients.id as string,
      clientName: r.content_items.months.clients.name as string,
      clientColor: r.content_items.months.clients.color as string,
      clientCategory: (r.content_items.months.clients.category ?? "Social Media") as string,
    }));
  });

/* ============== ADMIN REPORT ============== */

const reportFiltersSchema = z.object({
  userId: z.string().uuid().optional().nullable(),
  from: z.string(),
  to: z.string(),
  type: z.enum(["all", "post", "reel", "outros", "gravacao", "roteiro", "sistema", "stories", "cleaning"]).optional(),
  clientId: z.string().uuid().optional().nullable(),
});

/** Quem anexou cada arquivo (upload direto ou vindo do Drive) num período
 * curto — pensado pra conferir rápido, por exemplo, quem realmente mexeu
 * num reel quando o editor esquece de se atribuir. Cobre `item_files.kind`
 * "media" (arquivo principal) e "briefing" (imagem de referência). */
export type FileUploadRow = {
  id: string;
  createdAt: string;
  fileName: string;
  mimeType: string | null;
  fileKind: "media" | "briefing";
  userId: string;
  userName: string;
  userColor: string;
  itemId: string | null;
  itemTitle: string | null;
  itemIdx: number | null;
  itemType: string | null;
  clientId: string | null;
  clientName: string | null;
  clientColor: string | null;
};

export const getFileUploadsReport = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { days: 7 | 15 | 30; type?: string }) =>
    z.object({
      days: z.union([z.literal(7), z.literal(15), z.literal(30)]),
      type: z.enum(["all", "post", "reel", "story", "outros", "gravacao", "roteiro", "sistema"]).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) {
      const { data: allowed } = await context.supabase.rpc("has_setor_permission", { _user_id: context.userId, _perm: "team_reports" });
      if (!allowed) throw new Error("Forbidden");
    }

    const type = data.type ?? "reel";
    const start = new Date(Date.now() - data.days * 86400000).toISOString();
    let q = context.supabase
      .from("item_files")
      .select("id, name, mime_type, added_by, created_at, kind, content_items!inner(id, type, title, idx, months!inner(client_id, clients!months_client_id_fkey!inner(id, name, color)))")
      .gte("created_at", start)
      .order("created_at", { ascending: false });
    if (type !== "all") q = q.eq("content_items.type", type);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const { data: profiles } = await context.supabase.from("profiles").select("id, name, color");
    const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    const items: FileUploadRow[] = (rows ?? []).map((r: any) => {
      const it = r.content_items;
      const c = it?.months?.clients;
      const p = r.added_by ? profileById.get(r.added_by) : null;
      return {
        id: r.id,
        createdAt: r.created_at,
        fileName: r.name,
        mimeType: r.mime_type,
        fileKind: (r.kind ?? "media") as "media" | "briefing",
        userId: r.added_by,
        userName: p?.name ?? "Membro removido",
        userColor: p?.color ?? "#888",
        itemId: it?.id ?? null,
        itemTitle: it?.title ?? null,
        itemIdx: it?.idx ?? null,
        itemType: it?.type ?? null,
        clientId: c?.id ?? null,
        clientName: c?.name ?? null,
        clientColor: c?.color ?? null,
      };
    });

    const byMemberMap = new Map<string, { userId: string; userName: string; userColor: string; count: number }>();
    items.forEach((r) => {
      const cur = byMemberMap.get(r.userId) ?? { userId: r.userId, userName: r.userName, userColor: r.userColor, count: 0 };
      cur.count++;
      byMemberMap.set(r.userId, cur);
    });
    const byMember = [...byMemberMap.values()].sort((a, b) => b.count - a.count);

    return { days: data.days, type, rows: items, byMember };
  });

/** PostgREST caps unbounded selects at 1000 rows by default, silently (no
 * error) — getReport's date-range queries (finalizations, status_transitions,
 * activity_log, etc.) now regularly exceed that as the org's history grows,
 * which was quietly dropping rows with no ordering guarantee on which ones
 * survived (this is what caused real, active items/members to show as
 * "removido" in Histórico — not actually removed, just never fetched).
 * Pages through with .range() until a page comes back short. `buildQuery`
 * must return a FRESH query each call — a supabase-js builder can't be
 * re-awaited for a second page. */
async function fetchAllPaginated<T>(buildQuery: () => any, pageSize = 1000): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await buildQuery().range(offset, offset + pageSize - 1);
    if (error) { console.error("fetchAllPaginated error:", error.message); break; }
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

/** Entregas finalizadas por mês, últimos 6 meses (fixo — não segue os
 * filtros do relatório) — alimenta o gráfico de tendência em Relatórios. */
export const getDeliveryTrend = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) {
      const { data: allowed } = await context.supabase.rpc("has_setor_permission", { _user_id: context.userId, _perm: "team_reports" });
      if (!allowed) throw new Error("Forbidden");
    }
    const now = new Date();
    const months: { key: string; label: string; start: Date; end: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      months.push({
        key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
        label: start.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        start, end,
      });
    }
    const rangeStart = months[0].start.toISOString();
    const rangeEnd = months[months.length - 1].end.toISOString();
    const rows = await fetchAllPaginated(() => context.supabase
      .from("finalizations")
      .select("finalized_at")
      .gte("finalized_at", rangeStart)
      .lt("finalized_at", rangeEnd)
      .not("item_id", "is", null));
    const counts = new Map(months.map((m) => [m.key, 0]));
    (rows ?? []).forEach((r: any) => {
      const d = new Date(r.finalized_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return months.map((m) => ({ key: m.key, label: m.label, count: counts.get(m.key) ?? 0 }));
  });

export const getReport = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: any) => reportFiltersSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) {
      const { data: allowed } = await context.supabase.rpc("has_setor_permission", { _user_id: context.userId, _perm: "team_reports" });
      if (!allowed) throw new Error("Forbidden");
    }

    const fromISO = new Date(data.from).toISOString();
    const toISO = new Date(data.to).toISOString();
    const filterUser = data.userId || null;
    const filterType = data.type ?? "all";
    const filterClient = data.clientId || null;

    // ---- profiles map ----
    const { data: profiles } = await context.supabase
      .from("profiles").select("id, name, color, icon, active");
    const profileById = new Map<string, any>();
    (profiles ?? []).forEach((p: any) => profileById.set(p.id, p));
    const { data: roleRows } = await context.supabase.from("user_roles").select("user_id, role");
    const roleByUser = new Map<string, string>();
    (roleRows ?? []).forEach((r: any) => roleByUser.set(r.user_id, r.role));

    // ---- content finalizations (posts/reels/outros) ----
    const finRows = await fetchAllPaginated(() => {
      let fq = context.supabase
        .from("finalizations")
        .select(
          "id, user_id, finalized_at, content_items!inner(id, type, title, editor_id, reel_type, due_date, activity_quantity, months!inner(client_id, key, clients!months_client_id_fkey!inner(id, name, color, category)))"
        )
        .gte("finalized_at", fromISO)
        .lt("finalized_at", toISO);
      if (filterUser) fq = fq.eq("user_id", filterUser);
      return fq;
    });

    type HistRow = {
      kind: "content" | "stories" | "cleaning";
      finalizedAt: string;
      userId: string;
      type: "post" | "reel" | "outros" | "gravacao" | "roteiro" | "sistema" | "stories" | "cleaning";
      title: string;
      clientId: string | null;
      clientName: string | null;
      clientColor: string | null;
      clientCategory: string | null;
      reelType: string | null;
      editorId: string | null;
      lateDays: number;
      activityQuantity: number | null;
      itemId: string | null;
    };
    const history: HistRow[] = [];
    (finRows ?? []).forEach((r: any) => {
      const it = r.content_items;
      if (!it) return;
      const c = it.months?.clients;
      const category = c?.category ?? "Social Media";
      if (filterClient && c?.id !== filterClient) return;
      if (filterType !== "all" && filterType !== "stories" && filterType !== "cleaning" && it.type !== filterType) return;
      if ((filterType === "stories" || filterType === "cleaning") && true) return; // skip content for stories/cleaning filter
      const lateDays = computeLateDays(it.due_date, r.finalized_at);
      history.push({
        kind: "content",
        finalizedAt: r.finalized_at,
        userId: r.user_id,
        type: it.type,
        title: it.title,
        clientId: c?.id ?? null,
        clientName: c?.name ?? null,
        clientColor: c?.color ?? null,
        clientCategory: category,
        reelType: it.reel_type ?? null,
        editorId: it.editor_id ?? null,
        lateDays,
        activityQuantity: it.activity_quantity ?? null,
        itemId: it.id ?? null,
      });
    });

    // ---- stories ----
    if (filterType === "all" || filterType === "stories") {
      const fromDay = data.from.slice(0, 10);
      const toDay = data.to.slice(0, 10);
      let sq = context.supabase
        .from("stories_schedule")
        .select("day, user_id, updated_at, client_id, clients(name, color)")
        .gte("day", fromDay).lt("day", toDay)
        .not("user_id", "is", null);
      if (filterUser) sq = sq.eq("user_id", filterUser);
      if (filterClient) sq = sq.eq("client_id", filterClient);
      const { data: storyRows } = await sq;
      (storyRows ?? []).forEach((s: any) => {
        history.push({
          kind: "stories",
          finalizedAt: s.updated_at ?? new Date(s.day + "T12:00:00Z").toISOString(),
          userId: s.user_id,
          type: "stories",
          title: `Stories ${new Date(s.day + "T12:00:00Z").toLocaleDateString("pt-BR")}`,
          clientId: s.client_id ?? null, clientName: s.clients?.name ?? "STORIES", clientColor: s.clients?.color ?? "#7EFFD9", clientCategory: "Stories",
          reelType: null, editorId: null, lateDays: 0, activityQuantity: null, itemId: null,
        });
      });
    }

    // ---- cleaning ----
    if (!filterClient && (filterType === "all" || filterType === "cleaning")) {
      let cq = context.supabase
        .from("cleaning_schedule")
        .select("task_id, weekday, user_id, updated_at, cleaning_tasks(name)")
        .not("user_id", "is", null)
        .gte("updated_at", fromISO).lt("updated_at", toISO);
      if (filterUser) cq = cq.eq("user_id", filterUser);
      const { data: cleanRows } = await cq;
      (cleanRows ?? []).forEach((c: any) => {
        history.push({
          kind: "cleaning",
          finalizedAt: c.updated_at ?? new Date().toISOString(),
          userId: c.user_id,
          type: "cleaning",
          title: `Limpeza · ${c.cleaning_tasks?.name ?? "tarefa"} (dia ${c.weekday})`,
          clientId: null, clientName: "LIMPEZA", clientColor: "#4A9EFF", clientCategory: "Limpeza",
          reelType: null, editorId: null, lateDays: 0, activityQuantity: null, itemId: null,
        });
      });
    }

    history.sort((a, b) => b.finalizedAt.localeCompare(a.finalizedAt));

    // ---- broad activity feed (comments, files, status moves, item events) ----
    // Kept separate from `history` above: that array drives goal/finalization
    // stats (summary/byMember/etc.) and must stay finalization-only. This one
    // is the raw "everything that happened" feed for the Histórico display.
    type ActivityEntry = {
      kind: "finalized" | "status" | "comment" | "file" | "created" | "due_date" | "rated";
      at: string;
      userId: string;
      clientId: string | null;
      clientName: string | null;
      clientColor: string | null;
      itemId: string | null;
      itemTitle: string | null;
      itemType: string | null;
      description: string;
    };
    const activityFeed: ActivityEntry[] = [];

    const statusRows = await fetchAllPaginated(() => {
      let stq = context.supabase
        .from("status_transitions")
        .select("item_id, from_status, to_status, actor_id, at")
        .gte("at", fromISO).lt("at", toISO);
      if (filterUser) stq = stq.eq("actor_id", filterUser);
      return stq;
    });

    const commentRows = await fetchAllPaginated(() => {
      let cmq = context.supabase
        .from("comments")
        .select("item_id, author_id, text, created_at")
        .eq("is_system", false)
        .gte("created_at", fromISO).lt("created_at", toISO);
      if (filterUser) cmq = cmq.eq("author_id", filterUser);
      return cmq;
    });

    const fileRows = await fetchAllPaginated(() => {
      let ifq = context.supabase
        .from("item_files")
        .select("item_id, name, mime_type, added_by, created_at")
        .gte("created_at", fromISO).lt("created_at", toISO);
      if (filterUser) ifq = ifq.eq("added_by", filterUser);
      return ifq;
    });

    const logRows = await fetchAllPaginated(() => {
      let alq = context.supabase
        .from("activity_log")
        .select("entity_id, actor_id, action, meta, at")
        .eq("entity_type", "content_item")
        .in("action", ["created", "due_date_changed", "rated"])
        .gte("at", fromISO).lt("at", toISO);
      if (filterUser) alq = alq.eq("actor_id", filterUser);
      return alq;
    });

    const touchedItemIds = new Set<string>();
    (statusRows ?? []).forEach((r: any) => touchedItemIds.add(r.item_id));
    (commentRows ?? []).forEach((r: any) => touchedItemIds.add(r.item_id));
    (fileRows ?? []).forEach((r: any) => touchedItemIds.add(r.item_id));
    (logRows ?? []).forEach((r: any) => touchedItemIds.add(r.entity_id));

    const itemInfoById = new Map<string, any>();
    if (touchedItemIds.size > 0) {
      // .in() com centenas/milhares de ids vira uma URL longa demais e a
      // query falha silenciosamente (o erro nunca era checado) — batela em
      // grupos menores pra não estourar o limite.
      const idBatches: string[][] = [];
      const idList = [...touchedItemIds];
      for (let i = 0; i < idList.length; i += 150) idBatches.push(idList.slice(i, i + 150));
      const batchResults = await Promise.all(idBatches.map((batch) =>
        context.supabase
          .from("content_items")
          .select("id, type, title, months!inner(client_id, key, clients!months_client_id_fkey!inner(id, name, color, category))")
          .in("id", batch)
      ));
      batchResults.forEach(({ data: itemsInfo, error }: any) => {
        if (error) console.error("getReport itemsInfo batch error", error);
        (itemsInfo ?? []).forEach((it: any) => itemInfoById.set(it.id, it));
      });
    }

    function pushActivity(kind: ActivityEntry["kind"], itemId: string | null, userId: string | null, at: string, description: string) {
      if (!userId) return;
      if (filterType === "stories" || filterType === "cleaning") return;
      const it = itemId ? itemInfoById.get(itemId) : null;
      const c = it?.months?.clients;
      if (filterClient && c?.id !== filterClient) return;
      if (filterType !== "all" && it && it.type !== filterType) return;
      activityFeed.push({
        kind, at, userId,
        clientId: c?.id ?? null, clientName: c?.name ?? null, clientColor: c?.color ?? null,
        itemId, itemTitle: it?.title ?? null, itemType: it?.type ?? null,
        description,
      });
    }

    (statusRows ?? []).forEach((r: any) => {
      const fromLabel = r.from_status ? (STATUS_META[r.from_status as Status]?.label ?? r.from_status) : null;
      const toLabel = STATUS_META[r.to_status as Status]?.label ?? r.to_status;
      const isFinal = r.to_status === "PRONTO_PARA_PUBLICAR" || r.to_status === "CONCLUIDO" || r.to_status === "FINALIZADO";
      const desc = fromLabel ? `Mudou o status de "${fromLabel}" para "${toLabel}"` : `Definiu o status como "${toLabel}"`;
      pushActivity(isFinal ? "finalized" : "status", r.item_id, r.actor_id, r.at, desc);
    });
    (commentRows ?? []).forEach((r: any) => {
      const text = (r.text ?? "").length > 100 ? r.text.slice(0, 100) + "…" : (r.text ?? "");
      pushActivity("comment", r.item_id, r.author_id, r.created_at, `Comentou: "${text}"`);
    });
    (fileRows ?? []).forEach((r: any) => {
      const mime = r.mime_type ?? "";
      const verb = mime.startsWith("image/") ? "Adicionou a foto" : mime.startsWith("video/") ? "Adicionou o vídeo" : "Anexou o arquivo";
      pushActivity("file", r.item_id, r.added_by, r.created_at, `${verb} "${r.name}"`);
    });
    (logRows ?? []).forEach((r: any) => {
      if (r.action === "created") {
        pushActivity("created", r.entity_id, r.actor_id, r.at, `Criou "${r.meta?.title ?? ""}"`);
      } else if (r.action === "due_date_changed") {
        const to = r.meta?.to ? new Date(r.meta.to + "T12:00:00").toLocaleDateString("pt-BR") : "sem prazo";
        pushActivity("due_date", r.entity_id, r.actor_id, r.at, `Alterou o prazo para ${to}`);
      } else if (r.action === "rated") {
        const rating = r.meta?.rating ?? "?";
        pushActivity("rated", r.entity_id, r.actor_id, r.at, `Avaliou com ${rating} estrela${rating === 1 ? "" : "s"}`);
      }
    });

    const enrichedActivity = activityFeed
      .map((a) => ({
        ...a,
        userName: profileById.get(a.userId)?.name ?? "Membro removido",
        userColor: profileById.get(a.userId)?.color ?? "#888",
      }))
      .sort((a, b) => b.at.localeCompare(a.at));

    // ---- summary ----
    const contentHist = history.filter((h) => h.kind === "content");
    const summary = {
      total: history.length,
      posts: contentHist.filter((h) => h.type === "post").length,
      reels: contentHist.filter((h) => h.type === "reel").length,
      outros: contentHist.filter((h) => h.type === "outros").length,
      stories: history.filter((h) => h.kind === "stories").length,
      cleaning: history.filter((h) => h.kind === "cleaning").length,
    };

    // ---- by member ----
    const memberAgg = new Map<string, { posts: number; reels: number; outros: number; stories: number; cleaning: number; lateCount: number; lateDaysSum: number }>();
    history.forEach((h) => {
      const k = h.userId;
      const row = memberAgg.get(k) ?? { posts: 0, reels: 0, outros: 0, stories: 0, cleaning: 0, lateCount: 0, lateDaysSum: 0 };
      if (h.type === "post") row.posts++;
      else if (h.type === "reel") row.reels++;
      else if (h.type === "outros") row.outros++;
      else if (h.type === "stories") row.stories++;
      else if (h.type === "cleaning") row.cleaning++;
      if (h.kind === "content" && h.lateDays > 0) { row.lateCount++; row.lateDaysSum += h.lateDays; }
      memberAgg.set(k, row);
    });
    const byMember = [...memberAgg.entries()].map(([userId, v]) => {
      const p = profileById.get(userId);
      const total = v.posts + v.reels + v.outros + v.stories + v.cleaning;
      const { lateDaysSum, ...rest } = v;
      return {
        userId,
        name: p?.name ?? "—",
        color: p?.color ?? "#888",
        icon: p?.icon ?? null,
        role: roleByUser.get(userId) ?? "member",
        ...rest,
        avgLateDays: v.lateCount > 0 ? Math.round((lateDaysSum / v.lateCount) * 10) / 10 : 0,
        total,
      };
    }).sort((a, b) => b.total - a.total);
    const teamTotal = byMember.reduce((a, b) => a + b.total, 0);
    const byMemberWithPct = byMember.map((m) => ({ ...m, pct: teamTotal ? Math.round((m.total / teamTotal) * 100) : 0 }));

    // ---- activities (gravação/roteiro/sistema/outros) — separate from post/reel productivity ----
    // Gravação pontua pela quantidade de vídeos gravados, não por item.
    const activityWeight = (h: HistRow) =>
      h.type === "gravacao" && h.activityQuantity && h.activityQuantity > 0 ? h.activityQuantity : 1;
    const activityHist = contentHist.filter((h) => h.type !== "post" && h.type !== "reel");
    const activitySummary = {
      gravacao: activityHist.filter((h) => h.type === "gravacao").reduce((a, h) => a + activityWeight(h), 0),
      roteiro: activityHist.filter((h) => h.type === "roteiro").length,
      sistema: activityHist.filter((h) => h.type === "sistema").length,
      outros: activityHist.filter((h) => h.type === "outros").length,
    };
    const activityAgg = new Map<string, { gravacao: number; roteiro: number; sistema: number; outros: number }>();
    activityHist.forEach((h) => {
      const row = activityAgg.get(h.userId) ?? { gravacao: 0, roteiro: 0, sistema: 0, outros: 0 };
      (row as any)[h.type] += activityWeight(h);
      activityAgg.set(h.userId, row);
    });
    const activityByMember = [...activityAgg.entries()].map(([userId, v]) => {
      const p = profileById.get(userId);
      return {
        userId, name: p?.name ?? "—", color: p?.color ?? "#888", icon: p?.icon ?? null,
        ...v, total: v.gravacao + v.roteiro + v.sistema + v.outros,
      };
    }).sort((a, b) => b.total - a.total);

    // ---- by editor / format ----
    // Um item pode gerar várias linhas em `finalizations` — uma por
    // retrabalho (reaprovado de novo no mês) e também uma por cada
    // item_assignees daquele item (o trigger record_finalizations credita
    // todo mundo atribuído, não só o editor). Contar por linha inflava o
    // total de um editor pelo número de vezes que o item foi reaprovado
    // MULTIPLICADO pelo número de pessoas atribuídas — um reel com 3
    // atribuídos e reaprovado 1x já virava 3 no total. Cada item entra uma
    // única vez por editor, não uma vez por linha de finalização.
    const fmtAgg = new Map<string, { lofi: number; facil: number; basico: number; avancado: number }>();
    const itemsByEditor = new Map<string, { itemId: string; title: string; clientName: string | null; clientColor: string | null }[]>();
    contentHist.forEach((h) => {
      if (h.type !== "reel" || !h.itemId) return;
      const eid = h.editorId ?? "__none__";
      const list = itemsByEditor.get(eid) ?? [];
      if (list.some((it) => it.itemId === h.itemId)) return;
      list.push({ itemId: h.itemId, title: h.title, clientName: h.clientName, clientColor: h.clientColor });
      itemsByEditor.set(eid, list);
      const row = fmtAgg.get(eid) ?? { lofi: 0, facil: 0, basico: 0, avancado: 0 };
      const rt = (h.reelType as any) as "lofi" | "facil" | "basico" | "avancado" | null;
      if (rt && row[rt] !== undefined) row[rt]++;
      fmtAgg.set(eid, row);
    });
    const byEditorFormat = [...fmtAgg.entries()].map(([editorId, v]) => {
      const p = editorId === "__none__" ? null : profileById.get(editorId);
      const total = v.lofi + v.facil + v.basico + v.avancado;
      return {
        editorId: editorId === "__none__" ? null : editorId,
        name: p?.name ?? "— Sem editor",
        color: p?.color ?? "#555",
        icon: p?.icon ?? null,
        ...v,
        total,
        items: itemsByEditor.get(editorId) ?? [],
      };
    }).sort((a, b) => b.total - a.total);
    const formatTotals = byEditorFormat.reduce(
      (a, r) => ({ lofi: a.lofi + r.lofi, facil: a.facil + r.facil, basico: a.basico + r.basico, avancado: a.avancado + r.avancado }),
      { lofi: 0, facil: 0, basico: 0, avancado: 0 },
    );

    // ---- enrich history with names ----
    const enriched = history.map((h) => ({
      ...h,
      userName: profileById.get(h.userId)?.name ?? "—",
      userColor: profileById.get(h.userId)?.color ?? "#888",
      editorName: h.editorId ? (profileById.get(h.editorId)?.name ?? null) : null,
    }));

    return { summary, byMember: byMemberWithPct, byEditorFormat, formatTotals, history: enriched, activitySummary, activityByMember, activityFeed: enrichedActivity };
  });

export const getMemberReportDetail = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId: string; from: string; to: string }) =>
    z.object({ userId: z.string().uuid(), from: z.string(), to: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) {
      const { data: allowed } = await context.supabase.rpc("has_setor_permission", { _user_id: context.userId, _perm: "team_reports" });
      if (!allowed) throw new Error("Forbidden");
    }

    const fromISO = new Date(data.from).toISOString();
    const toISO = new Date(data.to).toISOString();

    // Monthly (last 6 months from `to`)
    const to = new Date(data.to);
    const monthly: { key: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - i, 1));
      monthly.push({ key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, count: 0 });
    }
    const monthlyStart = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 5, 1)).toISOString();

    const { data: finRows } = await context.supabase
      .from("finalizations")
      .select("finalized_at, content_items!inner(id, type, title, editor_id, reel_type, due_date, months!inner(key, clients!months_client_id_fkey!inner(id, name, color, category)))")
      .eq("user_id", data.userId)
      .gte("finalized_at", monthlyStart);

    (finRows ?? []).forEach((r: any) => {
      const d = new Date(r.finalized_at);
      const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const h = monthly.find((x) => x.key === k);
      if (h) h.count++;
    });

    // Lists within [from, to)
    const inRange = (r: any) => r.finalized_at >= fromISO && r.finalized_at < toISO;
    const baseList = (finRows ?? []).filter(inRange).map((r: any) => ({
      finalizedAt: r.finalized_at,
      itemId: r.content_items.id,
      type: r.content_items.type as "post" | "reel" | "outros",
      title: r.content_items.title,
      reelType: r.content_items.reel_type ?? null,
      editorId: r.content_items.editor_id ?? null,
      clientId: r.content_items.months.clients.id,
      clientName: r.content_items.months.clients.name,
      clientColor: r.content_items.months.clients.color,
      lateDays: computeLateDays(r.content_items.due_date, r.finalized_at),
    }));

    // Reels edited by this user (editor_id) — exclui os que ele também é
    // responsável (já contam em "reels" acima, pra não listar a mesma
    // entrega duas vezes) e deduplica por item: um reel com vários
    // responsáveis gera uma linha de finalizations por responsável, e
    // todas batem com o filtro de editor_id do mesmo jeito.
    const ownReelIds = new Set(baseList.filter((x) => x.type === "reel").map((x) => x.itemId));
    const seenEditedIds = new Set<string>();
    const { data: editedRows } = await context.supabase
      .from("finalizations")
      .select("finalized_at, content_items!inner(id, type, title, editor_id, reel_type, due_date, months!inner(clients!months_client_id_fkey!inner(id, name, color)))")
      .eq("content_items.editor_id", data.userId)
      .gte("finalized_at", fromISO)
      .lt("finalized_at", toISO);
    const editedReels = (editedRows ?? [])
      .filter((r: any) => r.content_items?.type === "reel")
      .filter((r: any) => !ownReelIds.has(r.content_items.id))
      .filter((r: any) => {
        if (seenEditedIds.has(r.content_items.id)) return false;
        seenEditedIds.add(r.content_items.id);
        return true;
      })
      .map((r: any) => ({
        finalizedAt: r.finalized_at,
        itemId: r.content_items.id,
        title: r.content_items.title,
        reelType: r.content_items.reel_type ?? null,
        clientId: r.content_items.months.clients.id,
        clientName: r.content_items.months.clients.name,
        clientColor: r.content_items.months.clients.color,
        lateDays: computeLateDays(r.content_items.due_date, r.finalized_at),
      }));

    // Stories / cleaning in range
    const fromDay = data.from.slice(0, 10);
    const toDay = data.to.slice(0, 10);
    const { data: storyRows } = await context.supabase
      .from("stories_schedule").select("day, updated_at")
      .eq("user_id", data.userId)
      .gte("day", fromDay).lt("day", toDay);
    const stories = (storyRows ?? []).map((s: any) => ({
      day: s.day,
      finalizedAt: s.updated_at ?? new Date(s.day + "T12:00:00Z").toISOString(),
    }));

    const { data: cleanRows } = await context.supabase
      .from("cleaning_schedule").select("weekday, updated_at, cleaning_tasks(name)")
      .eq("user_id", data.userId)
      .gte("updated_at", fromISO).lt("updated_at", toISO);
    const cleaning = (cleanRows ?? []).map((c: any) => ({
      taskName: (c.cleaning_tasks?.name ?? "") as string, weekday: c.weekday, finalizedAt: c.updated_at,
    }));

    return {
      monthly,
      posts: baseList.filter((x) => x.type === "post").sort((a, b) => b.finalizedAt.localeCompare(a.finalizedAt)),
      reels: baseList.filter((x) => x.type === "reel").sort((a, b) => b.finalizedAt.localeCompare(a.finalizedAt)),
      outros: baseList.filter((x) => x.type === "outros").sort((a, b) => b.finalizedAt.localeCompare(a.finalizedAt)),
      editedReels: editedReels.sort((a, b) => b.finalizedAt.localeCompare(a.finalizedAt)),
      stories: stories.sort((a, b) => b.finalizedAt.localeCompare(a.finalizedAt)),
      cleaning: cleaning.sort((a, b) => b.finalizedAt.localeCompare(a.finalizedAt)),
    };
  });

/* ============================================================
 * VELOCIDADE INDIVIDUAL — lead time por membro e tipo
 * ============================================================ */

export type MemberVelocityRow = {
  userId: string;
  name: string;
  color: string;
  icon: string | null;
  avatarUrl: string | null;
  totalFinished: number;
  avgLeadTimeDays: number | null;
  byType: {
    post: { count: number; avgDays: number | null };
    reel: { count: number; avgDays: number | null };
    outros: { count: number; avgDays: number | null };
  };
};

export const getMemberVelocity = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { from: string; to: string }) =>
    z.object({ from: z.string(), to: z.string() }).parse(d))
  .handler(async ({ data, context }): Promise<MemberVelocityRow[]> => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) {
      const { data: allowed } = await context.supabase.rpc("has_setor_permission", { _user_id: context.userId, _perm: "team_reports" });
      if (!allowed) throw new Error("Forbidden");
    }

    const { data: profiles } = await context.supabase
      .from("profiles").select("id, name, color, icon, avatar_url").eq("active", true);

    if (!profiles?.length) return [];

    // Finished items in range with lead time data and assignees
    const { data: items } = await context.supabase
      .from("content_items")
      .select("id, type, started_at, finished_at, item_assignees(user_id)")
      .in("status", ["PRONTO_PARA_PUBLICAR", "FINALIZADO", "CONCLUIDO"])
      .not("started_at", "is", null)
      .not("finished_at", "is", null)
      .gte("finished_at", data.from)
      .lt("finished_at", data.to);

    const avatarMap = await signAvatarPaths(context.supabase, (profiles ?? []).map((p: any) => p.avatar_url));

    return (profiles ?? []).map((p: any) => {
      const myItems = (items ?? []).filter((it: any) =>
        (it.item_assignees ?? []).some((a: any) => a.user_id === p.id)
      );

      function calcAvg(subset: any[]) {
        if (!subset.length) return null;
        const daysArr = subset.map((it: any) => {
          const ms = new Date(it.finished_at).getTime() - new Date(it.started_at).getTime();
          return ms / 86_400_000;
        });
        return Math.round((daysArr.reduce((a, b) => a + b, 0) / daysArr.length) * 10) / 10;
      }

      const posts = myItems.filter((i: any) => i.type === "post");
      const reels = myItems.filter((i: any) => i.type === "reel");
      const outros = myItems.filter((i: any) => i.type === "outros");

      return {
        userId: p.id, name: p.name, color: p.color, icon: p.icon,
        avatarUrl: p.avatar_url ? (avatarMap.get(p.avatar_url) ?? null) : null,
        totalFinished: myItems.length,
        avgLeadTimeDays: calcAvg(myItems),
        byType: {
          post: { count: posts.length, avgDays: calcAvg(posts) },
          reel: { count: reels.length, avgDays: calcAvg(reels) },
          outros: { count: outros.length, avgDays: calcAvg(outros) },
        },
      };
    }).filter((r) => r.totalFinished > 0)
      .sort((a, b) => (a.avgLeadTimeDays ?? 999) - (b.avgLeadTimeDays ?? 999));
  });