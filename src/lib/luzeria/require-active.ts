import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Enforces server-side that the calling user's profile is active.
 * New sign-ups land with active=false until a master approves them; without
 * this check, an unapproved JWT could still call every server function.
 */
export const requireActiveProfile = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("active")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Unauthorized");
    if (!data || data.active !== true) {
      throw new Error("Unauthorized: account pending approval or deactivated");
    }
    return next();
  });