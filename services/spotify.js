import psList from "ps-list";
import axios from "axios";
import { default as cuid } from "cuid";
import { ensureAccessToken } from "./spotifyTokens.js";

const debug = (...args) => {
  if (process.env.SPOTIFY_DEBUG === "1") {
    console.log("[spotify]", ...args);
  }
};

export function createSpotifyService() {
  return {
    id: "spotify",
    async isAvailable() {
      try {
        const processes = await psList();
        const found = processes.some((p) =>
          String(p.name).toLowerCase().includes("spotify")
        );
        debug("process check", found ? "found" : "not found");
        return found;
      } catch (err) {
        console.warn("[spotify] process check failed", err);
        return false;
      }
    },
    async getNowPlaying() {
      const token = await ensureAccessToken({
        clientId: process.env.VITE_SPOTIFY_CLIENT_ID
      });
      if (!token) {
        console.warn(
          "[spotify] no valid access token. Run Spotify login/link flow from the app."
        );
        return null;
      }

      try {
        debug("calling currently-playing");
        const resp = await axios.get(
          "https://api.spotify.com/v1/me/player/currently-playing",
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        if (resp.status === 204) {
          debug("no content (nothing playing)");
          return null;
        }
        if (!resp.data || !resp.data.item) return null;
        const item = resp.data.item;
        return {
          title: item.name,
          artist: item.artists?.map((a) => a.name).join(", ") || "",
          album: item.album?.name || "",
          artworkUrl: item.album?.images?.[0]?.url || "",
          progressMs: resp.data.progress_ms ?? 0,
          durationMs: item.duration_ms ?? 0,
          isPlaying: resp.data.is_playing ?? false,
          source: "spotify",
          id: cuid()
        };
      } catch (err) {
        const status = err?.response?.status;
        console.warn("[spotify] getNowPlaying failed", status, err?.response?.data);
        return null;
      }
    }
  };
}
