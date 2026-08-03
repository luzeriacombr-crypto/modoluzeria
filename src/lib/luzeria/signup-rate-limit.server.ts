// Server-only module — isolated from signup.functions.ts so the getRequest()
// import never gets pulled into the client bundle graph for the public /assinar
// page (that file is imported eagerly by SalesPage.tsx, unlike api.functions.ts's
// callAdminEdgeFn which only loads behind authenticated, lazily-split routes).
const SIGNUP_LIMIT_PER_HOUR = 5;

export async function checkSignupRateLimit(supabaseAdmin: any) {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  const ip = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request?.headers.get("x-real-ip")
    || "unknown";

  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("signup_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", windowStart);
  if ((count ?? 0) >= SIGNUP_LIMIT_PER_HOUR) {
    throw new Error("Muitas tentativas de cadastro. Tente novamente em algumas horas.");
  }
  await supabaseAdmin.from("signup_attempts").insert({ ip });
}
