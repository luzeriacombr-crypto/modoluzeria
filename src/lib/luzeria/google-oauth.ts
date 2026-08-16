const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

/** Exchange a stored refresh_token for a fresh access_token. Shared by any Google integration (Drive, Calendar, ...). */
export async function refreshGoogleAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: params.refreshToken,
      client_id: params.clientId,
      client_secret: params.clientSecret,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Erro ao renovar token do Google (${res.status}): ${t.slice(0, 200)}`);
  }
  const json: any = await res.json();
  return { accessToken: json.access_token, expiresIn: json.expires_in };
}

/** Exchange an OAuth `code` (authorization_code grant) for tokens — used by first-time consent flows. */
export async function exchangeGoogleAuthCode(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Erro ao trocar código do Google (${res.status}): ${t.slice(0, 200)}`);
  }
  const json: any = await res.json();
  return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresIn: json.expires_in };
}

/** Look up the email of the Google account behind an access_token. */
export async function fetchGoogleUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const json: any = await res.json();
  return json.email ?? null;
}
