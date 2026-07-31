import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function ok(data: unknown) {
  return json({ success: true, data });
}

function fail(error: string, status = 400) {
  return json({ success: false, error }, status);
}

// Same fixed id as in the app (src/lib/luzeria/api.functions.ts) and in the
// SQL migrations — can't share a real import across the Deno/Vercel boundary.
const LUZERIA_ORG_ID = "00000000-0000-0000-0000-000000000001";

async function getProfileOrgId(supabaseAdmin: any, userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("profiles").select("org_id").eq("id", userId).maybeSingle();
  return (data?.org_id as string | null) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return fail("Method not allowed", 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ANON_KEY =
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    return fail("Server misconfigured: missing Supabase env vars", 500);
  }

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return fail("Unauthorized", 401);

  const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !userData?.user) return fail("Unauthorized", 401);
  const callerId = userData.user.id;

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: isMaster, error: masterErr } = await supabaseAdmin.rpc("is_master", {
    _user_id: callerId,
  });
  if (masterErr) return fail(masterErr.message, 500);
  if (!isMaster) return fail("Forbidden: master role required", 403);

  const callerOrgId = await getProfileOrgId(supabaseAdmin, callerId);
  const callerIsPlatformAdmin = callerOrgId === LUZERIA_ORG_ID;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body");
  }
  const { operation, ...params } = body ?? {};
  if (!operation || typeof operation !== "string") return fail("Missing 'operation'");

  try {
    switch (operation) {
      case "createUser": {
        const { email, password, name, role, orgId } = params;
        if (!email || !password) return fail("email and password required");
        if (!orgId) return fail("orgId required");
        if (orgId !== callerOrgId && !callerIsPlatformAdmin) {
          return fail("Forbidden: cannot create users for another organization", 403);
        }
        // Pre-register the org (and role/name) for this email so the
        // handle_new_user() DB trigger stamps the right org_id on the new
        // profile — it looks this table up by email on every signup.
        const { error: assignErr } = await supabaseAdmin
          .from("email_role_assignments")
          .upsert(
            { email, name: name || email.split("@")[0], role: role || "member", org_id: orgId },
            { onConflict: "email" },
          );
        if (assignErr) return fail(`Failed to assign organization: ${assignErr.message}`, 500);

        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: name ? { name } : undefined,
        });
        if (error) return fail(error.message, 400);
        return ok({ user: data.user });
      }

      case "deleteUser": {
        const { targetUserId } = params;
        if (!targetUserId) return fail("targetUserId required");
        const targetOrgId = await getProfileOrgId(supabaseAdmin, targetUserId);
        if (targetOrgId !== callerOrgId && !callerIsPlatformAdmin) {
          return fail("Forbidden: cannot manage users from another organization", 403);
        }
        const { data, error } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
        if (error) return fail(error.message, 400);
        return ok(data);
      }

      case "sendPasswordReset": {
        const { email } = params;
        if (!email) return fail("email required");
        const { data: targetProfile } = await supabaseAdmin
          .from("profiles").select("org_id").eq("email", email).maybeSingle();
        if ((targetProfile?.org_id ?? null) !== callerOrgId && !callerIsPlatformAdmin) {
          return fail("Forbidden: cannot manage users from another organization", 403);
        }
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email,
        });
        if (error) return fail(error.message, 400);
        return ok(data);
      }

      case "updateUser": {
        const { targetUserId, email, password, name } = params;
        if (!targetUserId) return fail("targetUserId required");
        const targetOrgId = await getProfileOrgId(supabaseAdmin, targetUserId);
        if (targetOrgId !== callerOrgId && !callerIsPlatformAdmin) {
          return fail("Forbidden: cannot manage users from another organization", 403);
        }
        const attrs: Record<string, unknown> = {};
        if (email) attrs.email = email;
        if (password) attrs.password = password;
        if (name) attrs.user_metadata = { name };
        if (Object.keys(attrs).length === 0) return fail("Nothing to update");
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
          targetUserId,
          attrs,
        );
        if (error) return fail(error.message, 400);
        return ok({ user: data.user });
      }

      default:
        return fail(`Unknown operation: ${operation}`);
    }
  } catch (e: any) {
    return fail(e?.message ?? "Internal error", 500);
  }
});