import axios from "axios";

const API_BASE = process.env.CIDER_API_BASE || "http://localhost:10767/api/v1";
const debug = (...args) => {
  if (process.env.CIDER_DEBUG === "1") {
    console.log("[cider]", ...args);
  }
};

function mapNowPlaying(info = {}) {
  const artTemplate = info.artwork?.url || "";
  const artworkUrl = artTemplate.replace("{w}", "512").replace("{h}", "512");
  const durationMs =
    typeof info.durationInMillis === "number" ? info.durationInMillis : 0;
  const progressMs =
    typeof info.currentPlaybackTime === "number"
      ? Math.max(0, Math.floor(info.currentPlaybackTime * 1000))
      : 0;
  return {
    title: info.name || "",
    artist: info.artistName || "",
    album: info.albumName || "",
    artworkUrl,
    progressMs,
    durationMs,
    isPlaying: info.remainingTime ? info.remainingTime > 0 : true,
    source: "cider"
  };
}

export function createCiderService() {
  async function fetchNowPlaying() {
    const url = `${API_BASE}/playback/now-playing`;
    const resp = await axios.get(url, { timeout: 1500 });
    if (resp.data?.status !== "ok" || !resp.data?.info) {
      debug("unexpected response", resp.data);
      return null;
    }
    return mapNowPlaying(resp.data.info);
  }

  return {
    id: "cider",
    async isAvailable() {
      try {
        const np = await fetchNowPlaying();
        return !!np;
      } catch (err) {
        debug("availability check failed", err?.message || err);
        return false;
      }
    },
    async getNowPlaying() {
      try {
        return await fetchNowPlaying();
      } catch (err) {
        debug("getNowPlaying failed", err?.message || err);
        return null;
      }
    }
  };
}
