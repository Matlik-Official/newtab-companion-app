import { EVENTS } from "./events.js";

/**
 * Broadcast a playback payload through the shared event bus.
 * @param {import("node:events").EventEmitter} eventBus
 * @param {import("./types.js").NowPlaying} payload
 */
export function emitPlaybackUpdate(eventBus, payload) {
  eventBus.emit(EVENTS.NOW_PLAYING, payload);
}
