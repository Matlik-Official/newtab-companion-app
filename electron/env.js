// electron/env.js
import path from "node:path";
import dotenv from "dotenv";

// Load local env files for development. .env.local overrides .env if present.
dotenv.config({ path: path.join(process.cwd(), ".env") });
dotenv.config({ path: path.join(process.cwd(), ".env.local"), override: true });

export const ENV = {
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID || "",
  SPOTIFY_REDIRECT_URL: process.env.SPOTIFY_REDIRECT_URL || "http://127.0.0.1:4370/callback",
  SPOTIFY_REDIRECT_PORT: Number(process.env.SPOTIFY_REDIRECT_PORT) || 4370
};
