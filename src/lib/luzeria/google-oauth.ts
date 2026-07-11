const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Exchange a stored refresh_token for a fresh access_token. */
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
