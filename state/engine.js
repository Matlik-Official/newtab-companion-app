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
  intervalMs = 750
}) {
  let timer = null;
  let lastServiceId = null;

  async function selectService(settings) {
    const order = settings.preferSpotify
      ? [services.find((s) => s.id === "spotify"), services.find((s) => s.id === "cider")]
      : [services.find((s) => s.id === "cider"), services.find((s) => s.id === "spotify")];

    for (const svc of order) {
      if (svc && (await svc.isAvailable())) {
        return svc;
      }
    }
    return null;
  }

  async function tick() {
    const settings = await getSettings();
    const service = await selectService(settings);
    if (!service) {
      nowPlayingStore.set({ ...defaultNowPlaying, source: "none" });
      return;
    }

    if (service.id !== lastServiceId) {
      console.log("[engine] active service ->", service.id);
      lastServiceId = service.id;
    }

    try {
      const np = await service.getNowPlaying();
      if (np) {
        nowPlayingStore.set({ ...np, source: service.id });
      } else {
        // keep last; do nothing
      }
    } catch (err) {
      console.error("[engine] now playing fetch failed", err);
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
