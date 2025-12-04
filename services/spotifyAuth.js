import crypto from "node:crypto";
import http from "node:http";
import { shell } from "electron";
import axios from "axios";
import { default as cuid } from "cuid";
import { saveTokens } from "./spotifyTokens.js";
import { ENV } from "../electron/env.js";

let inflightAuth = null;
let activeServer = null;

function base64url(input) {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function generateVerifier() {
  return base64url(crypto.randomBytes(64));
}

function challenge(verifier) {
  return base64url(crypto.createHash("sha256").update(verifier).digest());
}

function successHtml() {
  return `
    <html><body style="background:#0b1021;color:#e0f2fe;font-family:sans-serif;padding:24px;">
      <h2>Spotify linked</h2>
      <p>You can close this window and return to the app.</p>
    </body></html>`;
}

function errorHtml(message) {
  return `
    <html><body style="background:#0b1021;color:#fecdd3;font-family:sans-serif;padding:24px;">
      <h2>Spotify linking failed</h2>
      <p>${message}</p>
    </body></html>`;
}

export async function startSpotifyAuth() {
  if (inflightAuth) {
    return inflightAuth;
  }

  const clientId = ENV.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    throw new Error("Missing SPOTIFY_CLIENT_ID env variable");
  }

  const parsedPort = ENV.SPOTIFY_REDIRECT_PORT;
  const redirectPort =
    Number.isFinite(parsedPort) && parsedPort > 0 && parsedPort < 65536
      ? parsedPort
      : 4370;
  const redirectHost = process.env.SPOTIFY_REDIRECT_HOST || "localhost";
  const redirectUri = ENV.SPOTIFY_REDIRECT_URL;
  const verifier = generateVerifier();
  const codeChallenge = challenge(verifier);
  const state = cuid();

  const scope = [
    "user-read-playback-state",
    "user-read-currently-playing",
    "user-read-recently-played"
  ].join(" ");

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("code_challenge", codeChallenge);

  inflightAuth = new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url) return;
      const url = new URL(req.url, `http://localhost:${redirectPort}`);
      if (url.pathname !== "/callback") return;
      const receivedState = url.searchParams.get("state");
      const authCode = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(errorHtml(error));
        server.close();
        activeServer = null;
        inflightAuth = null;
        return reject(new Error(error));
      }
      if (receivedState !== state || !authCode) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(errorHtml("State mismatch or missing code."));
        server.close();
        activeServer = null;
        inflightAuth = null;
        return reject(new Error("State mismatch"));
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(successHtml());
      server.close();
      activeServer = null;
      inflightAuth = null;
      resolve(authCode);
    });

    server.on("error", (err) => {
      activeServer = null;
      inflightAuth = null;
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Redirect port ${redirectPort} already in use. Close the other process or change SPOTIFY_REDIRECT_PORT/URI.`
          )
        );
      } else {
        reject(err);
      }
    });

    activeServer = server;
    server.listen(redirectPort, () => {
      console.log("[spotify] redirect URI:", redirectUri);
      shell.openExternal(authUrl.toString());
    });
  });

  const code = await inflightAuth;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier
  });

  const resp = await axios.post("https://accounts.spotify.com/api/token", body);
  const accessToken = resp.data.access_token;
  const refreshToken = resp.data.refresh_token;
  const expiresAt = resp.data.expires_in
    ? Date.now() + resp.data.expires_in * 1000
    : null;

  await saveTokens({ accessToken, refreshToken, expiresAt });

  return { accessToken, refreshToken, expiresAt };
}
