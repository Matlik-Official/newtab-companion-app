// --- spotifyTokens.js (SAFE FILE STORAGE VERSION) ---
import fs from "fs";
import path from "path";
import axios from "axios";
import { app } from "electron";

const TOKEN_PATH = path.join(app.getPath("userData"), "spotify-tokens.json");

function readTokenFile() {
  try {
    if (!fs.existsSync(TOKEN_PATH)) return null;
    const raw = fs.readFileSync(TOKEN_PATH, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn("[spotify] failed to read token file", err);
    return null;
  }
}

function writeTokenFile(data) {
  try {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.warn("[spotify] failed to write token file", err);
  }
}

export async function saveTokens({ accessToken, refreshToken, expiresAt }) {
  writeTokenFile({ accessToken, refreshToken, expiresAt });
}

export async function getStoredTokens() {
  return readTokenFile();
}

export async function hasTokens() {
  const t = readTokenFile();
  return !!t?.accessToken;
}

export async function clearTokens() {
  try {
    fs.unlinkSync(TOKEN_PATH);
  } catch (_) {
    /* ignore */
  }
}

export async function ensureAccessToken({ clientId }) {
  const tokens = readTokenFile();
  if (!tokens) return null;

  const { accessToken, refreshToken, expiresAt } = tokens;

  // still valid
  if (accessToken && (!expiresAt || expiresAt > Date.now() + 15000)) {
    return accessToken;
  }

  if (!refreshToken) return accessToken || null;

  try {
    const form = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId
    });

    const resp = await axios.post(
      "https://accounts.spotify.com/api/token",
      form
    );

    const nextAccess = resp.data.access_token;
    const nextRefresh = resp.data.refresh_token || refreshToken;
    const nextExpiresAt = resp.data.expires_in
      ? Date.now() + resp.data.expires_in * 1000
      : null;

    writeTokenFile({
      accessToken: nextAccess,
      refreshToken: nextRefresh,
      expiresAt: nextExpiresAt
    });

    return nextAccess;
  } catch (err) {
    console.warn("[spotify] refresh failed", err?.response?.status, err?.response?.data);
    return null;
  }
}
