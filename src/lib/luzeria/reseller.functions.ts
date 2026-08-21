// Revenda white label — Fase 2. Um revendedor aprovado provisiona
// instâncias novas (orgs com reseller_org_id apontando pra ele), cada uma
// já nascendo com marca própria pro cliente final dele. A gente nunca
// cobra o cliente final: o revendedor paga uma assinatura única no Asaas,
// cujo valor é a soma do preço de atacado de cada instância ativa dele —
// recalculada toda vez que ele cria uma instância nova.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { LUZERIA_ORG_ID } from "./api.functions";

/** Soma o atacado de tudo que esse revendedor já revendeu e sincroniza a
 * assinatura Asaas dele (cria na primeira vez, atualiza valor depois) —
 * chamada depois de toda ação que muda o total (criar OU cancelar
 * instância). Se o total zerar (cancelou a última instância) e já existia
 * assinatura, cancela ela — sem isso o revendedor continuaria sendo
 * cobrado por uma instância que não existe mais. */
async function syncResellerWholesaleBill(supabase: any, resellerOrgId: string) {
  const { data: reseller } = await supabase
    .from("orgs").select("name, tax_id, asaas_customer_id, asaas_subscription_id").eq("id", resellerOrgId).maybeSingle();
  if (!reseller) return;

  const { data: resoldOrgs } = await supabase
    .from("orgs").select("plan_id").eq("reseller_org_id", resellerOrgId);
  const { data: wholesalePrices } = await supabase
    .from("reseller_wholesale_prices").select("plan_id, wholesale_price_cents").eq("reseller_org_id", resellerOrgId);
  const priceByPlan = new Map<string, number>((wholesalePrices ?? []).map((p: any) => [p.plan_id, p.wholesale_price_cents]));
  const totalCents = (resoldOrgs ?? []).reduce((sum: number, o: any) => sum + (priceByPlan.get(o.plan_id) ?? 0), 0);

  const { createAsaasCustomer, createAsaasSubscription, updateAsaasSubscriptionValue, getNextPendingPayment, updateAsaasPaymentValue, cancelAsaasSubscription } =
    await import("./asaas.server");

  if (totalCents === 0) {
    if (reseller.asaas_subscription_id) {
      await cancelAsaasSubscription(reseller.asaas_subscription_id);
      await supabase.from("orgs").update({ asaas_subscription_id: null }).eq("id", resellerOrgId);
    }
    return;
  }

  if (!reseller.asaas_subscription_id) {
    if (!reseller.tax_id) throw new Error("Preencha o CNPJ/CPF da sua agência em Configurações antes de criar a primeira instância revendida.");
    let customerId = reseller.asaas_customer_id as string | null;
    if (!customerId) {
      const customer = await createAsaasCustomer({ name: reseller.name, cpfCnpj: reseller.tax_id });
      customerId = customer.id;
    }
    const { subscriptionId } = await createAsaasSubscription({
      customerId,
      valueCents: totalCents,
      description: `Modo Criador — Revenda (${reseller.name})`,
    });
    await supabase.from("orgs").update({ asaas_customer_id: customerId, asaas_subscription_id: subscriptionId }).eq("id", resellerOrgId);
  } else {
    await updateAsaasSubscriptionValue(reseller.asaas_subscription_id, totalCents);
    try {
      const pending = await getNextPendingPayment(reseller.asaas_subscription_id);
      if (pending) await updateAsaasPaymentValue(pending.id, totalCents);
    } catch {
      // Melhor esforço — a fatura atual pode já ter sido paga ou não existir
      // ainda; a próxima cobrança já sai com o valor certo de qualquer jeito.
    }
  }
}

export const getMyResellerProgram = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data: org } = await context.supabase
      .from("orgs").select("is_reseller, tax_id, asaas_subscription_id").eq("id", context.orgId).maybeSingle();
    if (!org?.is_reseller) return { isReseller: false as const };

    const { data: wholesaleRows } = await context.supabase
      .from("reseller_wholesale_prices").select("plan_id, wholesale_price_cents").eq("reseller_org_id", context.orgId);
    const { data: plans } = await context.supabase.from("plans").select("id, name").not("price_cents", "is", null).order("sort_order");
    const nameByPlan = new Map((plans ?? []).map((p: any) => [p.id, p.name as string]));
    const wholesalePrices = (wholesaleRows ?? []).map((w: any) => ({
      planId: w.plan_id as string,
      planName: nameByPlan.get(w.plan_id) ?? w.plan_id,
      wholesalePriceCents: w.wholesale_price_cents as number,
    }));
    const priceByPlan = new Map(wholesalePrices.map((w) => [w.planId, w.wholesalePriceCents]));

    const { data: resoldOrgs } = await context.supabase
      .from("orgs").select("id, name, plan_id, created_at").eq("reseller_org_id", context.orgId).order("created_at", { ascending: false });
    const resold = (resoldOrgs ?? []).map((o: any) => ({
      id: o.id as string,
      name: o.name as string,
      planId: o.plan_id as string,
      planName: nameByPlan.get(o.plan_id) ?? o.plan_id,
      wholesalePriceCents: priceByPlan.get(o.plan_id) ?? 0,
      createdAt: o.created_at as string,
    }));
    const monthlyWholesaleTotalCents = resold.reduce((sum, o) => sum + o.wholesalePriceCents, 0);

    return {
      isReseller: true as const,
      taxId: org.tax_id as string | null,
      hasAsaasSubscription: !!org.asaas_subscription_id,
      wholesalePrices,
      resoldOrgs: resold,
      monthlyWholesaleTotalCents,
    };
  });

export const createResoldOrg = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { name: string; planId: string; ownerName: string; ownerEmail: string }) =>
    z.object({
      name: z.string().trim().min(2).max(80),
      planId: z.string().min(1),
      ownerName: z.string().trim().min(2).max(80),
      ownerEmail: z.string().trim().toLowerCase().email(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Apenas o Adm Master pode criar instâncias revendidas.");
    const { data: myOrg } = await context.supabase.from("orgs").select("is_reseller").eq("id", context.orgId).maybeSingle();
    if (!myOrg?.is_reseller) throw new Error("Sua agência ainda não foi aprovada como revendedora.");

    const { data: wholesale } = await context.supabase
      .from("reseller_wholesale_prices").select("plan_id").eq("reseller_org_id", context.orgId).eq("plan_id", data.planId).maybeSingle();
    if (!wholesale) throw new Error("Não há preço de parceiro configurado pra esse plano — fale com a Luzeria.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existingAssignment } = await supabaseAdmin
      .from("email_role_assignments").select("email").eq("email", data.ownerEmail).maybeSingle();
    if (existingAssignment) throw new Error("Já existe uma conta com esse e-mail.");

    const slugBase = data.name.trim().toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "agencia";

    const { data: newOrg, error: orgErr } = await supabaseAdmin
      .from("orgs")
      .insert({
        name: data.name.trim(),
        slug: `${slugBase}-${Date.now().toString(36)}`,
        plan_id: data.planId,
        subscription_status: "active",
        reseller_org_id: context.orgId,
      })
      .select("id").single();
    if (orgErr) throw new Error(orgErr.message);

    const { seedJourneyStagesForOrg } = await import("./journey-stages.functions");
    await seedJourneyStagesForOrg(supabaseAdmin, newOrg.id);

    const { error: earErr } = await supabaseAdmin.from("email_role_assignments").insert({
      email: data.ownerEmail, role: "master", name: data.ownerName.trim(), org_id: newOrg.id,
    });
    if (earErr) throw new Error(earErr.message);

    // O dono da instância revendida nunca escolheu uma senha (foi o
    // revendedor que cadastrou o e-mail dele) — generateLink com type
    // "invite" cria o usuário E devolve um link pra ele mesmo definir a
    // senha, sem precisar de um "reenviar confirmação" que pressupõe senha
    // já conhecida.
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email: data.ownerEmail,
      options: { data: { name: data.ownerName.trim() } },
    });
    if (linkErr || !linkData?.user) throw new Error(linkErr?.message ?? "Não foi possível criar o acesso do cliente.");

    const actionLink = (linkData.properties as any)?.action_link as string | undefined;
    if (actionLink) {
      const { sendEmail } = await import("./resend.server");
      await sendEmail({
        to: data.ownerEmail,
        subject: `Seu acesso ao ${data.name.trim()} está pronto`,
        html: `
          <p>Olá, ${data.ownerName.trim()}!</p>
          <p>Sua conta em <strong>${data.name.trim()}</strong> foi criada. Clique no link abaixo pra definir sua senha e acessar:</p>
          <p><a href="${actionLink}">Criar minha senha</a></p>
        `,
      }).catch((e) => console.error("Falha ao enviar e-mail de convite:", e.message));
    }

    await syncResellerWholesaleBill(context.supabase, context.orgId);

    return { orgId: newOrg.id as string };
  });

/** O revendedor cancela uma instância que ele mesmo criou — apaga a
 * instância inteira (clientes, posts, arquivos, equipe) e recalcula a
 * assinatura dele pra parar de cobrar por ela. Mesmo nível de confirmação
 * (digitar o nome) e mesma sequência de apagar do deleteOrg (Luzeria-only),
 * só que escopado: só funciona se a instância pertence a quem está
 * chamando (reseller_org_id = a própria org do revendedor) — nunca deixa
 * um revendedor apagar instância de outro. */
export const cancelResoldOrg = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { orgId: string; confirmName: string }) =>
    z.object({ orgId: z.string().uuid(), confirmName: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Apenas o Adm Master pode cancelar uma instância revendida.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("orgs").select("id, name, reseller_org_id").eq("id", data.orgId).maybeSingle();
    if (orgErr || !org) throw new Error("Instância não encontrada.");
    if ((org as any).reseller_org_id !== context.orgId) throw new Error("Forbidden");
    if ((org as any).name.trim().toLowerCase() !== data.confirmName.trim().toLowerCase()) {
      throw new Error("O nome digitado não confere com o nome da instância.");
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

    await syncResellerWholesaleBill(context.supabase, context.orgId);

    return { ok: true };
  });

/** Platform-admin only (Luzeria): cadastra uma revenda do zero — cria a org
 * dela, convida o responsável por e-mail (mesmo fluxo de convite usado em
 * createResoldOrg) e já aprova como revendedora com o desconto de atacado
 * combinado. Existe pra fechar o caso comum: alguém chama no WhatsApp
 * pedindo pra revender, mas ainda não tem nenhuma conta no Modo Criador —
 * sem isso, approveReseller sozinho não serve porque exige uma org já
 * existente. */
export const createResellerOrg = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { name: string; planId: string; ownerName: string; ownerEmail: string; wholesaleDiscountPercent?: number }) =>
    z.object({
      name: z.string().trim().min(2).max(80),
      planId: z.string().min(1),
      ownerName: z.string().trim().min(2).max(80),
      ownerEmail: z.string().trim().toLowerCase().email(),
      wholesaleDiscountPercent: z.number().min(0).max(95).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existingAssignment } = await supabaseAdmin
      .from("email_role_assignments").select("email").eq("email", data.ownerEmail).maybeSingle();
    if (existingAssignment) throw new Error("Já existe uma conta com esse e-mail.");

    const slugBase = data.name.trim().toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "agencia";

    const { data: newOrg, error: orgErr } = await supabaseAdmin
      .from("orgs")
      .insert({
        name: data.name.trim(),
        slug: `${slugBase}-${Date.now().toString(36)}`,
        plan_id: data.planId,
        subscription_status: "active",
        is_reseller: true,
      })
      .select("id").single();
    if (orgErr) throw new Error(orgErr.message);

    const { seedJourneyStagesForOrg } = await import("./journey-stages.functions");
    await seedJourneyStagesForOrg(supabaseAdmin, newOrg.id);

    const { error: earErr } = await supabaseAdmin.from("email_role_assignments").insert({
      email: data.ownerEmail, role: "master", name: data.ownerName.trim(), org_id: newOrg.id,
    });
    if (earErr) throw new Error(earErr.message);

    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email: data.ownerEmail,
      options: { data: { name: data.ownerName.trim() } },
    });
    if (linkErr || !linkData?.user) throw new Error(linkErr?.message ?? "Não foi possível criar o acesso da revenda.");

    const actionLink = (linkData.properties as any)?.action_link as string | undefined;
    if (actionLink) {
      const { sendEmail } = await import("./resend.server");
      await sendEmail({
        to: data.ownerEmail,
        subject: `Seu acesso de revendedor ${data.name.trim()} está pronto`,
        html: `
          <p>Olá, ${data.ownerName.trim()}!</p>
          <p>Sua conta de revenda white label em <strong>${data.name.trim()}</strong> foi criada. Clique no link abaixo pra definir sua senha e acessar:</p>
          <p><a href="${actionLink}">Criar minha senha</a></p>
        `,
      }).catch((e) => console.error("Falha ao enviar e-mail de convite de revenda:", e.message));
    }

    const discount = data.wholesaleDiscountPercent ?? 60;
    const { data: plans } = await supabaseAdmin.from("plans").select("id, price_cents").not("price_cents", "is", null);
    for (const plan of plans ?? []) {
      const wholesaleCents = Math.round(((plan as any).price_cents as number) * (1 - discount / 100));
      await supabaseAdmin.from("reseller_wholesale_prices").upsert(
        { reseller_org_id: newOrg.id, plan_id: (plan as any).id, wholesale_price_cents: wholesaleCents },
        { onConflict: "reseller_org_id,plan_id" },
      );
    }

    return { orgId: newOrg.id as string };
  });

/** Platform-admin only (Luzeria): aprova uma agência como revendedora e
 * semeia o preço de atacado de cada plano com o desconto combinado (60%
 * por padrão). Rodar de novo com outro desconto sobrescreve os valores. */
export const approveReseller = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { orgId: string; wholesaleDiscountPercent?: number }) =>
    z.object({
      orgId: z.string().uuid(),
      wholesaleDiscountPercent: z.number().min(0).max(95).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");

    const discount = data.wholesaleDiscountPercent ?? 60;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: updErr } = await supabaseAdmin.from("orgs").update({ is_reseller: true }).eq("id", data.orgId);
    if (updErr) throw new Error(updErr.message);

    const { data: plans } = await supabaseAdmin.from("plans").select("id, price_cents").not("price_cents", "is", null);
    for (const plan of plans ?? []) {
      const wholesaleCents = Math.round(((plan as any).price_cents as number) * (1 - discount / 100));
      await supabaseAdmin.from("reseller_wholesale_prices").upsert(
        { reseller_org_id: data.orgId, plan_id: (plan as any).id, wholesale_price_cents: wholesaleCents },
        { onConflict: "reseller_org_id,plan_id" },
      );
    }
    return { ok: true };
  });
