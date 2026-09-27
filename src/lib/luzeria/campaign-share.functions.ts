// Link público "só pra ver" de uma campanha/projeto (ex: pra mandar pra
// uma influenciadora acompanhar o trabalho, sem ela precisar de login) —
// mesmo padrão de feed-share.functions.ts (token opaco, revogável), só
// que 1 link por campanha em vez de 1 por cliente.
import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";
import type { ContentType, Status } from "./types";

function randomToken(len = 22): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export const getOrCreateCampaignShareToken = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { campaignId: string }) => z.object({ campaignId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ token: string }> => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Apenas admins podem compartilhar o projeto.");
    const db: any = context.supabase;
    const { data: existing } = await db
      .from("campaign_share_tokens").select("token, revoked_at")
      .eq("campaign_id", data.campaignId).maybeSingle();
    if (existing && !existing.revoked_at) return { token: existing.token as string };

    const token = randomToken(22);
    if (existing) {
      const { error } = await db
        .from("campaign_share_tokens")
        .update({ token, revoked_at: null, created_by: context.userId })
        .eq("campaign_id", data.campaignId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db
        .from("campaign_share_tokens")
        .insert({ campaign_id: data.campaignId, token, created_by: context.userId });
      if (error) throw new Error(error.message);
    }
    return { token };
  });

export const rotateCampaignShareToken = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { campaignId: string }) => z.object({ campaignId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ token: string }> => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Apenas admins podem compartilhar o projeto.");
    const token = randomToken(22);
    const db: any = context.supabase;
    const { error } = await db
      .from("campaign_share_tokens")
      .upsert({ campaign_id: data.campaignId, token, revoked_at: null, created_by: context.userId }, { onConflict: "campaign_id" });
    if (error) throw new Error(error.message);
    return { token };
  });

export type PublicCampaignPayload = {
  campaign: { name: string; description: string | null; briefing: string | null; services: string | null; materials: string | null };
  clientName: string;
  orgName: string;
  items: { id: string; type: ContentType; title: string; status: Status }[];
};

export const getPublicCampaign = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().min(8).max(60) }).parse(d))
  .handler(async ({ data }): Promise<PublicCampaignPayload | null> => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
    );
    const { data: result, error } = await (supabase as any).rpc("get_public_campaign", { _token: data.token });
    if (error || !result) return null;
    return result as unknown as PublicCampaignPayload;
  });
