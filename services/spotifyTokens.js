import keytar from "keytar";
import axios from "axios";

const TOKEN_SERVICE = "newtab-companion-spotify";
const TOKEN_ACCOUNT = "spotify-credentials";

function envTokens() {
  const accessToken = process.env.SPOTIFY_TOKEN || process.env.SPOTIFY_ACCESS_TOKEN;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  return accessToken ? { accessToken, refreshToken, expiresAt: null } : null;
}

export async function saveTokens(payload) {
  await keytar.setPassword(TOKEN_SERVICE, TOKEN_ACCOUNT, JSON.stringify(payload));
}

export async function getStoredTokens() {
  const env = envTokens();
  if (env) return env;
  try {
    const raw = await keytar.getPassword(TOKEN_SERVICE, TOKEN_ACCOUNT);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn("[spotify] failed to read tokens", err);
    return null;
  }
}

export async function ensureAccessToken({ clientId }) {
  const tokens = await getStoredTokens();
  if (!tokens) return null;

  const { accessToken, refreshToken, expiresAt } = tokens;
  const now = Date.now();
  if (accessToken && (!expiresAt || expiresAt > now + 15_000)) {
    return accessToken;
  }

  if (!refreshToken) return accessToken || null;

  try {
    const form = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId
    });
    const resp = await axios.post("https://accounts.spotify.com/api/token", form);
    const nextAccess = resp.data.access_token;
    const nextRefresh = resp.data.refresh_token || refreshToken;
    const expiresAtNew = resp.data.expires_in
      ? Date.now() + resp.data.expires_in * 1000
      : null;
    await saveTokens({
      accessToken: nextAccess,
      refreshToken: nextRefresh,
      expiresAt: expiresAtNew
    });
    return nextAccess;
  } catch (err) {
    console.warn("[spotify] refresh failed", err?.response?.status, err?.response?.data);
    return null;
  }
}
