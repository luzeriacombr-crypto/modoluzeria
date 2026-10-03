// Processa o que a Meta manda pro webhook do WhatsApp (rota
// /api/whatsapp/webhook): status das mensagens enviadas (entregue/lido/
// falhou) e mensagens recebidas no número do Modo Criador.
//
// Mensagem recebida:
// - do Junior (WHATSAPP_ADMIN_PHONE) respondendo um alerta → a resposta vai
//   pra conversa do Chat do Modo Criador (e pro WhatsApp da agência) ou pro
//   número que escreveu, conforme o alerta;
// - de qualquer outra pessoa → SAIR/VOLTAR mexem na lista de envio; o resto
//   é repassado pro Junior como alerta, pra ele poder responder do celular.
import {
  ACTIVATION_CAMPAIGNS, alertAdmin, isAdminPhone, isOptInText, isOptOutText, isOptedOut, pauseCampaign, phoneKey,
  sendTemplate, sendText, WA_TEMPLATES,
  type ActivationKey,
} from "./whatsapp.server";

const STATUS_RANK: Record<string, number> = { sent: 0, delivered: 1, read: 2 };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function handleWhatsappWebhook(payload: any) {
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      if (change?.field !== "messages") continue;
      const value = change.value ?? {};
      for (const status of value.statuses ?? []) {
        await handleStatus(status).catch((e) => console.error("[whatsapp-webhook] status:", e));
      }
      const contacts: any[] = value.contacts ?? [];
      for (const msg of value.messages ?? []) {
        const contactName = contacts.find((c) => c.wa_id === msg.from)?.profile?.name ?? null;
        await handleInbound(msg, contactName).catch((e) => console.error("[whatsapp-webhook] mensagem:", e));
      }
    }
  }
}

async function handleStatus(status: any) {
  const db = await admin();
  const { data: row } = await db.from("whatsapp_messages").select("id, status").eq("wamid", status.id).maybeSingle();
  if (!row) return;
  if (status.status === "failed") {
    const err = status.errors?.[0];
    await db.from("whatsapp_messages").update({
      status: "failed",
      error: err?.error_data?.details ?? err?.title ?? err?.message ?? "Falhou",
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    return;
  }
  // Os status podem chegar fora de ordem — nunca volta de "lido" pra "entregue".
  if (!(status.status in STATUS_RANK) || row.status === "failed") return;
  if ((STATUS_RANK[status.status] ?? -1) <= (STATUS_RANK[row.status] ?? -1)) return;
  await db.from("whatsapp_messages").update({ status: status.status, updated_at: new Date().toISOString() }).eq("id", row.id);
}

function inboundText(msg: any): string {
  if (msg.type === "text") return msg.text?.body ?? "";
  if (msg.type === "button") return msg.button?.text ?? "";
  if (msg.type === "interactive") return msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? "";
  const labels: Record<string, string> = {
    audio: "[áudio]", image: "[imagem]", video: "[vídeo]", document: "[documento]", sticker: "[figurinha]", location: "[localização]",
  };
  const caption = msg[msg.type]?.caption;
  return `${labels[msg.type] ?? `[${msg.type}]`}${caption ? ` ${caption}` : ""}`;
}

async function handleInbound(msg: any, contactName: string | null) {
  const db = await admin();
  const from: string = msg.from;
  const text = inboundText(msg).trim();

  // A Meta às vezes entrega o mesmo evento mais de uma vez — o wamid é
  // UNIQUE, então a segunda tentativa de gravar falha e a gente ignora.
  const { error: dupErr } = await db.from("whatsapp_messages").insert({
    direction: "in", phone: from, kind: "inbound", body: text, wamid: msg.id, status: "received",
  });
  if (dupErr) return;

  if (isAdminPhone(from)) {
    await handleAdminReply(msg, text);
    return;
  }

  // Toque num botão das campanhas de ativação (payload "act|<campanha>|<ação>|<org>").
  const payload: string | undefined = msg.button?.payload ?? msg.interactive?.button_reply?.id;
  if (payload?.startsWith("act|")) {
    await handleActivationButton(payload, from, contactName);
    return;
  }

  if (isOptOutText(text)) {
    await db.from("whatsapp_opt_outs").upsert({ phone_key: phoneKey(from) });
    await sendText(from, "Pronto, você não vai mais receber mensagens do Modo Criador por aqui. Se mudar de ideia, é só mandar VOLTAR.", { kind: "text" });
    return;
  }
  if (isOptInText(text)) {
    await db.from("whatsapp_opt_outs").delete().eq("phone_key", phoneKey(from));
    await sendText(from, "Prontinho, você voltou a receber as mensagens do Modo Criador por aqui. 😊", { kind: "text" });
    return;
  }

  const { data: orgs } = await db.from("orgs").select("id, name, whatsapp").not("whatsapp", "is", null);
  const org = (orgs ?? []).find((o: any) => phoneKey(o.whatsapp) === phoneKey(from)) ?? null;
  if (org) await db.from("whatsapp_messages").update({ org_id: org.id }).eq("wamid", msg.id);

  await alertAdmin({
    label: `${contactName ?? `+${from}`} (${org?.name ?? "não é agência cadastrada"}) pelo WhatsApp`,
    message: text || "(mensagem vazia)",
    orgId: org?.id ?? null,
    replyToPhone: from,
  });
}

async function handleAdminReply(msg: any, text: string) {
  const db = await admin();
  const adminPhone = msg.from as string;
  const reply = (t: string) => sendText(adminPhone, t, { kind: "text", contextWamid: msg.id });

  const contextId: string | undefined = msg.context?.id;
  if (!contextId) {
    await reply("Pra responder alguém, arrasta pro lado a mensagem de alerta e escreve a resposta. 😉");
    return;
  }
  const { data: alert } = await db
    .from("whatsapp_messages")
    .select("support_thread_id, reply_to_phone, reply_label, org_id")
    .eq("wamid", contextId).eq("kind", "support_alert").maybeSingle();
  if (!alert) {
    await reply("Não achei pra quem vai essa resposta. Arrasta pro lado uma mensagem de alerta (🆘) e responde nela.");
    return;
  }
  if (msg.type !== "text" || !text) {
    await reply("Por enquanto só consigo repassar texto. Manda a resposta escrita, por favor.");
    return;
  }

  const label = alert.reply_label ?? "a pessoa";

  if (alert.support_thread_id) {
    const { deliverSupportReply } = await import("./support-reply.server");
    const r = await deliverSupportReply(alert.support_thread_id, text);
    await reply(`✅ Resposta enviada pra ${label} no Chat do app${r.whatsappSent ? " e no WhatsApp" : ""}.`);
    return;
  }

  if (alert.reply_to_phone) {
    if (await isOptedOut(alert.reply_to_phone)) {
      await reply(`⚠️ ${label} pediu pra não receber mais mensagens por aqui (respondeu SAIR). Não enviei.`);
      return;
    }
    // Texto livre só passa dentro das 24h desde a última mensagem da
    // pessoa; fora disso (erro 131047) vai pelo modelo de resposta.
    let r = await sendText(alert.reply_to_phone, text, { kind: "support_reply", orgId: alert.org_id });
    if (!r.ok && r.code === 131047) {
      r = await sendTemplate(alert.reply_to_phone, WA_TEMPLATES.supportReply, ["tudo bem", text], {
        kind: "support_reply", orgId: alert.org_id,
      });
    }
    await reply(r.ok ? `✅ Resposta enviada pra ${label}.` : `❌ Não consegui enviar pra ${label}: ${r.error}`);
    return;
  }

  await reply(`Essa solicitação não deixou WhatsApp. Responde pelo app, em Central de Ajuda.`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "Já fiz" / "Preciso de ajuda" / "Agora não": pausa a campanha pra essa
 * agência, responde (texto livre, dentro da janela de 24h — de graça) e, se
 * pediu ajuda, avisa o Junior no WhatsApp pra ele responder arrastando. */
async function handleActivationButton(payload: string, from: string, contactName: string | null) {
  const [, key, action, orgId] = payload.split("|");
  const campaign = ACTIVATION_CAMPAIGNS[key as ActivationKey];
  if (!campaign || !UUID_RE.test(orgId ?? "") || !["done", "help", "later"].includes(action)) return;

  const db = await admin();
  const { data: org } = await db.from("orgs").select("id, name").eq("id", orgId).maybeSingle();
  await db.from("whatsapp_messages").update({ org_id: orgId }).eq("phone", from).eq("kind", "inbound").is("org_id", null);
  await pauseCampaign(orgId, key as ActivationKey, action as "done" | "help" | "later");

  if (action === "done") {
    await sendText(from, campaign.doneReply, { kind: "text", orgId });
  } else if (action === "later") {
    await sendText(from, "Tudo bem! 😊 Quando quiser, é só entrar em modocriador.com.br. Qualquer dúvida, é só chamar por aqui.", { kind: "text", orgId });
  } else {
    await sendText(from, "Claro! 🙋 Já avisei o Junior, do Modo Criador, e ele te responde por aqui em breve.", { kind: "text", orgId });
    await alertAdmin({
      label: `${contactName ?? `+${from}`} (${org?.name ?? "agência"})`,
      message: `Pediu ajuda na mensagem de ${campaign.label}.`,
      orgId, replyToPhone: from, force: true,
    });
  }
}
