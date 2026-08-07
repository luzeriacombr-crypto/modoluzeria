// Server-only Asaas API client. Never imported at module scope from a
// .functions.ts or route file — always reached via dynamic import from
// inside a handler, so ASAAS_API_KEY never ends up in the client bundle.

function baseUrl() {
  return process.env.ASAAS_ENV === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

async function asaasFetch(path: string, init?: RequestInit) {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new Error("ASAAS_API_KEY não configurada.");
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.errors?.[0]?.description ?? `Asaas retornou ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

export async function createAsaasCustomer(params: { name: string; cpfCnpj: string; email?: string | null }) {
  return asaasFetch("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: params.name,
      cpfCnpj: params.cpfCnpj.replace(/\D/g, ""),
      email: params.email ?? undefined,
    }),
  }) as Promise<{ id: string }>;
}

export async function createAsaasSubscription(params: {
  customerId: string;
  valueCents: number;
  description: string;
  billingType?: "UNDEFINED" | "CREDIT_CARD";
  trialDays?: number;
}) {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (params.trialDays ?? 0));
  const nextDueDate = dueDate.toISOString().slice(0, 10);
  const subscription = (await asaasFetch("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      customer: params.customerId,
      billingType: params.billingType ?? "UNDEFINED",
      value: params.valueCents / 100,
      nextDueDate,
      cycle: "MONTHLY",
      description: params.description,
    }),
  })) as { id: string };

  const payments = (await asaasFetch(`/payments?subscription=${subscription.id}&limit=1`)) as {
    data?: { invoiceUrl?: string }[];
  };
  const invoiceUrl = payments.data?.[0]?.invoiceUrl ?? null;
  return { subscriptionId: subscription.id, invoiceUrl };
}

/** The next unpaid invoice for a subscription — the one a manually-applied
 * discount should land on, since past/paid invoices can't be changed. */
export async function getNextPendingPayment(asaasSubscriptionId: string) {
  const payments = (await asaasFetch(
    `/payments?subscription=${asaasSubscriptionId}&status=PENDING&limit=1`,
  )) as { data?: { id: string; value: number }[] };
  return payments.data?.[0] ?? null;
}

export async function updateAsaasPaymentValue(paymentId: string, valueCents: number) {
  return asaasFetch(`/payments/${paymentId}`, {
    method: "PUT",
    body: JSON.stringify({ value: valueCents / 100 }),
  }) as Promise<{ id: string; value: number }>;
}

/** Cancels a subscription in Asaas — stops future charges and removes any
 * still-pending (unpaid) invoice for it. Already-paid invoices stay in
 * Asaas's history untouched. */
export async function cancelAsaasSubscription(subscriptionId: string) {
  return asaasFetch(`/subscriptions/${subscriptionId}`, { method: "DELETE" }) as Promise<{ deleted: boolean }>;
}
