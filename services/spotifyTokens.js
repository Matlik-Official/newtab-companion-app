import fs from "node:fs/promises";
import path from "node:path";
import axios from "axios";
import { app } from "electron";

const TOKEN_FILENAME = "spotify-tokens.json";

function tokenFilePath() {
  return path.join(app.getPath("userData"), TOKEN_FILENAME);
}

export async function saveTokens(payload) {
  try {
    await fs.writeFile(tokenFilePath(), JSON.stringify(payload, null, 2), "utf8");
  } catch (err) {
    console.warn("[spotify] failed to save tokens:", err);
  }
}

export async function getStoredTokens() {
  try {
    const file = tokenFilePath();
    const content = await fs.readFile(file, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function hasTokens() {
  const t = await getStoredTokens();
  return !!t?.accessToken;
}

export async function ensureAccessToken({ clientId }) {
  const tokens = await getStoredTokens();
  if (!tokens) return null;

  const { accessToken, refreshToken, expiresAt } = tokens;
  const now = Date.now();

  // If still valid → return directly
  if (accessToken && expiresAt && expiresAt > now + 15_000) {
    return accessToken;
  }

  if (!refreshToken) return accessToken || null;

  // Refresh using Spotify
  try {
    const form = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId
    });

    const resp = await axios.post("https://accounts.spotify.com/api/token", form);

    const nextAccess = resp.data.access_token;
    const nextRefresh = resp.data.refresh_token || refreshToken;
    const nextExpires = resp.data.expires_in
      ? Date.now() + resp.data.expires_in * 1000
      : null;

    await saveTokens({
      accessToken: nextAccess,
      refreshToken: nextRefresh,
      expiresAt: nextExpires
    });

    return nextAccess;
  } catch (err) {
    console.warn("[spotify] refresh failed:", err.response?.status, err.response?.data);
    return null;
  }
}

export async function clearTokens() {
  try {
    await fs.unlink(tokenFilePath());
  } catch {}
}
