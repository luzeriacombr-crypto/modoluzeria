// Public, unauthenticated server functions for the self-service signup flow
// at /assinar. No requireActiveProfile middleware — there is no logged-in
// user yet. Writes go through supabaseAdmin (service role) since RLS has
// nothing to authenticate against at this point.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getPublicPlans = createServerFn({ method: "GET" })
  .handler(async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
    const { data, error } = await supabase.from("plans").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []).map((p: any) => ({
      id: p.id as string,
      name: p.name as string,
      priceCents: p.price_cents as number | null,
      maxClients: p.max_clients as number | null,
      maxCollaborators: p.max_collaborators as number | null,
      sortOrder: p.sort_order as number,
    }));
  });

const TRIAL_DAYS = 7;

export const publicSignup = createServerFn({ method: "POST" })
  .inputValidator((d: {
    agencyName: string; name: string; email: string; password: string;
    planId: string; taxId: string; website?: string;
  }) =>
    z.object({
      agencyName: z.string().trim().min(2).max(80),
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().toLowerCase().email(),
      password: z.string().min(6).max(72),
      planId: z.string().min(1),
      taxId: z.string().trim().regex(/^\d{11}$|^\d{14}$/, "CNPJ ou CPF inválido."),
      website: z.string().max(0).optional().or(z.literal("")), // honeypot — must stay empty
    }).parse(d))
  .handler(async ({ data }) => {
    if (data.website) {
      // Bot filled the honeypot field — pretend success, do nothing.
      return { invoiceUrl: null };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: plan } = await supabaseAdmin
      .from("plans").select("id, name, price_cents").eq("id", data.planId).maybeSingle();
    if (!plan) throw new Error("Plano não encontrado.");
    if (plan.price_cents == null) throw new Error("Este plano é sob consulta — fale com a gente pra contratar.");

    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    if (existing?.users?.some((u) => u.email?.toLowerCase() === data.email)) {
      throw new Error("Já existe uma conta com esse e-mail.");
    }

    const slugBase = data.agencyName.trim().toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "agencia";
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("orgs")
      .insert({
        name: data.agencyName.trim(),
        slug: `${slugBase}-${Date.now().toString(36)}`,
        plan_id: plan.id,
        subscription_status: "trialing",
        trial_ends_at: trialEndsAt.toISOString(),
        tax_id: data.taxId,
      })
      .select("id").single();
    if (orgErr) throw new Error(orgErr.message);

    try {
      const { error: earErr } = await supabaseAdmin.from("email_role_assignments").insert({
        email: data.email, role: "master", name: data.name.trim(), org_id: org.id,
      });
      if (earErr) throw new Error(earErr.message);

      const { data: created, error: userErr } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: false,
        user_metadata: { name: data.name.trim() },
      });
      if (userErr || !created?.user) throw new Error(userErr?.message ?? "Não foi possível criar sua conta.");

      const { createAsaasCustomer, createAsaasSubscription } = await import("./asaas.server");
      const customer = await createAsaasCustomer({ name: data.agencyName.trim(), cpfCnpj: data.taxId, email: data.email });
      const { subscriptionId, invoiceUrl } = await createAsaasSubscription({
        customerId: customer.id,
        valueCents: plan.price_cents,
        description: `Modo Criador — Plano ${plan.name}`,
        billingType: "CREDIT_CARD",
        trialDays: TRIAL_DAYS,
      });

      await supabaseAdmin.from("orgs")
        .update({ asaas_customer_id: customer.id, asaas_subscription_id: subscriptionId })
        .eq("id", org.id);

      return { invoiceUrl };
    } catch (e) {
      // Best-effort cleanup so a failed signup doesn't leave an orphaned org behind.
      await supabaseAdmin.from("orgs").delete().eq("id", org.id);
      await supabaseAdmin.from("email_role_assignments").delete().eq("email", data.email);
      throw e;
    }
  });
