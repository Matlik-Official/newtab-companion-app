import { EVENTS } from "./events.js";
import { defaultNowPlaying } from "./types.js";

export function createNowPlayingStore(eventBus) {
  /** @type {import("./types.js").NowPlaying} */
  let current = { ...defaultNowPlaying };

  return {
    get() {
      return current;
    },
    /**
     * @param {Partial<import("./types.js").NowPlaying>} next
     */
    set(next) {
      current = { ...current, ...next };
      eventBus.emit(EVENTS.NOW_PLAYING, current);
      return current;
    },
    reset() {
      current = { ...defaultNowPlaying };
      eventBus.emit(EVENTS.NOW_PLAYING, current);
      return current;
    }
  };
}
