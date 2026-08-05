// Tracks (client-side only, per-browser) whether this device has ever
// successfully signed in — separate from the current Supabase session, which
// expires. Lets "/" skip the sales pitch for returning users even after
// their session lapses, instead of only for currently-logged-in ones.
const KEY = "mc:has-signed-in";

export function markSignedInDevice() {
  try { localStorage.setItem(KEY, "1"); } catch { /* private browsing, etc. */ }
}

export function hasSignedInBefore(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}
