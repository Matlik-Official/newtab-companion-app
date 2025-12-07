import { defaultNowPlaying } from "./types.js";

/**
 * @param {object} params
 * @param {{getNowPlaying: () => Promise<import("./types.js").NowPlaying|null>, isAvailable: () => Promise<boolean>}[]} params.services
 * @param {import("./nowPlayingStore.js").createNowPlayingStore} params.nowPlayingStore
 * @param {() => Promise<import("./types.js").Settings>} params.getSettings
 * @param {number} [params.intervalMs]
 */
export function createPlaybackEngine({
  services,
  nowPlayingStore,
  getSettings,
  intervalMs = 5000
}) {
  let timer = null;
  let lastServiceId = null;

  function buildServiceOrder(settings) {
    const wantsSystem = !!settings.useSystemMediaSession;
    const wantsSpotify = !!settings.preferSpotify;
    const wantsCider = !!settings.preferCider;

    const ids = [];
    if (wantsSystem) ids.push("system");

    if (wantsSpotify || wantsCider) {
      const preferCiderFirst = wantsCider && !wantsSpotify;
      if (preferCiderFirst) {
        if (wantsCider) ids.push("cider");
        if (wantsSpotify) ids.push("spotify");
      } else {
        if (wantsSpotify) ids.push("spotify");
        if (wantsCider) ids.push("cider");
      }
    }

    const seen = new Set();
    const ordered = [];

    for (const id of ids) {
      if (seen.has(id)) continue;
      const svc = services.find((s) => s.id === id);
      if (svc) {
        ordered.push(svc);
        seen.add(id);
      }
    }

    for (const svc of services) {
      if (seen.has(svc.id)) continue;
      if (svc.id === "system" && !wantsSystem) continue;
      if (svc.id === "spotify" && !wantsSpotify) continue;
      if (svc.id === "cider" && !wantsCider) continue;
      ordered.push(svc);
      seen.add(svc.id);
    }

    return ordered;
  }

  async function tick() {
    const settings = await getSettings();
    const order = buildServiceOrder(settings);

    let updated = false;

    for (const svc of order) {
      if (!svc) continue;
      try {
        const ok = await svc.isAvailable();
        if (!ok) continue;

        if (svc.id !== lastServiceId) {
          console.log("[engine] active service ->", svc.id);
          lastServiceId = svc.id;
        }

        const np = await svc.getNowPlaying();
        if (np) {
          nowPlayingStore.set({ ...np, source: svc.id });
          updated = true;
          break;
        }
      } catch (err) {
        console.error(`[engine] now playing fetch failed for ${svc.id}`, err);
      }
    }

    if (!updated) {
      nowPlayingStore.set({ ...defaultNowPlaying, source: "none" });
      lastServiceId = null;
    }
  }

  return {
    start() {
      if (timer) return;
      timer = setInterval(tick, intervalMs);
      tick();
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }
  };
}
