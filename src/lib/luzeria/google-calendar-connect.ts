/** Appends a fresh CSRF state to a Google auth URL and stashes it for the callback route to verify. */
export function withOAuthState(authUrl: string): string {
  const state = crypto.randomUUID();
  sessionStorage.setItem("lz_gcal_oauth_state", state);
  return `${authUrl}&state=${encodeURIComponent(state)}`;
}
