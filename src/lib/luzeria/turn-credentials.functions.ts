import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";

const METERED_DOMAIN = "modocriador.metered.live";

/** Short-lived TURN relay credentials for the video-call feature (see
 * use-screen-share-call.ts). The account's secret key must never reach the
 * browser — Metered's docs are explicit about that — so this always goes
 * through the server, which holds METERED_TURN_SECRET as an env var. Falls
 * back to STUN-only (no relay) if the secret isn't configured or the
 * request fails, since a call between two peers that can reach each other
 * directly still works without TURN. */
export const getTurnCredentials = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async (): Promise<RTCIceServer[]> => {
    const fallback: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
    const secret = process.env.METERED_TURN_SECRET;
    if (!secret) return fallback;
    try {
      const res = await fetch(
        `https://${METERED_DOMAIN}/api/v1/turn/credentials?apiKey=${encodeURIComponent(secret)}`,
      );
      if (!res.ok) return fallback;
      const servers = await res.json();
      if (!Array.isArray(servers) || servers.length === 0) return fallback;
      return servers;
    } catch {
      return fallback;
    }
  });
