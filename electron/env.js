import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env in dev and from resources/ when packaged.
dotenv.config({ path: path.join(__dirname, "..", ".env") });
const resourcesEnv = path.join(process.resourcesPath || __dirname, ".env");
dotenv.config({ path: resourcesEnv, override: true });

export const CLIENT_ID = process.env.VITE_SPOTIFY_CLIENT_ID || "";
export const REDIRECT_URL = process.env.VITE_SPOTIFY_REDIRECT_URL || "http://127.0.0.1:4370/callback";
export const REDIRECT_PORT = Number(process.env.VITE_SPOTIFY_REDIRECT_PORT) || 4370;

export const ENV = {
  VITE_SPOTIFY_CLIENT_ID: CLIENT_ID,
  SPOTIFY_REDIRECT_URL: REDIRECT_URL,
  SPOTIFY_REDIRECT_PORT: REDIRECT_PORT
};
