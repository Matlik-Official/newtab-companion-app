import keytar from "keytar";
import axios from "axios";

const TOKEN_SERVICE = "newtab-companion-spotify";
const TOKEN_ACCOUNT = "spotify-credentials";

// REMOVE envTokens — Electron builds should NOT read tokens from env
// Always use keytar for stored tokens

export async function saveTokens(payload) {
  await keytar.setPassword(
    TOKEN_SERVICE,
    TOKEN_ACCOUNT,
    JSON.stringify(payload)
  );
}

export async function getStoredTokens() {
  try {
    const raw = await keytar.getPassword(TOKEN_SERVICE, TOKEN_ACCOUNT);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn("[spotify] failed to read tokens", err);
    return null;
  }
}

export async function hasTokens() {
  const tokens = await getStoredTokens();
  return !!tokens?.accessToken;
}

export async function ensureAccessToken({ clientId }) {
  const tokens = await getStoredTokens();
  if (!tokens) return null;

  const { accessToken, refreshToken, expiresAt } = tokens;
  const now = Date.now();

  if (accessToken && (!expiresAt || expiresAt > now + 15000)) {
    return accessToken;
  }

  if (!refreshToken) return accessToken || null;

  try {
    const form = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    });

    const resp = await axios.post(
      "https://accounts.spotify.com/api/token",
      form
    );
    const nextAccess = resp.data.access_token;
    const nextRefresh = resp.data.refresh_token || refreshToken;
    const expiresAtNew = resp.data.expires_in
      ? Date.now() + resp.data.expires_in * 1000
      : null;

    await saveTokens({
      accessToken: nextAccess,
      refreshToken: nextRefresh,
      expiresAt: expiresAtNew,
    });

    return nextAccess;
  } catch (err) {
    console.warn(
      "[spotify] refresh failed",
      err?.response?.status,
      err?.response?.data
    );
    return null;
  }
}

export async function clearTokens() {
  try {
    await keytar.deletePassword(TOKEN_SERVICE, TOKEN_ACCOUNT);
  } catch (err) {
    console.warn("[spotify] failed to clear tokens", err);
  }
}
