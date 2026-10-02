// Entrega uma resposta do Junior numa conversa do Chat do Modo Criador —
// usado tanto pelo painel admin (replyToSupportThread) quanto pela resposta
// que ele manda direto do WhatsApp (webhook). Sempre via supabaseAdmin: quem
// responde não é o dono da thread, então a RLS normal não libera.

export async function deliverSupportReply(threadId: string, text: string): Promise<{ userName: string | null; whatsappSent: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const { data: thread } = await admin
    .from("support_threads").select("id, user_id, org_id").eq("id", threadId).maybeSingle();
  if (!thread) throw new Error("Conversa não encontrada.");

  const { error: insErr } = await admin
    .from("support_messages").insert({ thread_id: threadId, role: "admin", content: text });
  if (insErr) throw new Error(insErr.message);

  await admin
    .from("support_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);

  const { error: notifErr } = await admin.from("notifications").insert({
    user_id: thread.user_id,
    type: "support_chat_reply",
    message: "Você tem uma resposta nova no Chat do Modo Criador.",
  });
  if (notifErr) console.error("[deliverSupportReply] falha ao notificar usuário:", notifErr);

  // Também manda pro WhatsApp da agência — mas orgs.whatsapp é o número de
  // quem cadastrou a agência, então só vai quando quem perguntou é master
  // (se foi alguém da equipe, o número seria de outra pessoa). Respeita
  // quem respondeu SAIR.
  const [{ data: profile }, { data: org }, { data: isMaster }] = await Promise.all([
    admin.from("profiles").select("name").eq("id", thread.user_id).maybeSingle(),
    admin.from("orgs").select("whatsapp").eq("id", thread.org_id).maybeSingle(),
    admin.rpc("is_master", { _user_id: thread.user_id }),
  ]);
  let whatsappSent = false;
  if (isMaster && org?.whatsapp) {
    try {
      const wa = await import("./whatsapp.server");
      if (wa.whatsappConfigured() && (await wa.autoMessagesEnabled()) && !(await wa.isOptedOut(org.whatsapp))) {
        const firstName = profile?.name?.trim().split(" ")[0] || "tudo bem";
        const r = await wa.sendTemplate(org.whatsapp, wa.WA_TEMPLATES.supportReply, [firstName, text], {
          kind: "support_reply", orgId: thread.org_id, supportThreadId: threadId,
        });
        whatsappSent = r.ok;
        if (!r.ok) console.error("[deliverSupportReply] falha no WhatsApp:", r.error);
      }
    } catch (e) {
      console.error("[deliverSupportReply] falha no WhatsApp:", e);
    }
  }

  return { userName: profile?.name ?? null, whatsappSent };
}
