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

  async function tick() {
    const settings = await getSettings();
    const order = settings.preferSpotify
      ? [services.find((s) => s.id === "spotify"), services.find((s) => s.id === "cider")]
      : [services.find((s) => s.id === "cider"), services.find((s) => s.id === "spotify")];

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
