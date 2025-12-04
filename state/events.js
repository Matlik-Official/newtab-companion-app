import { EventEmitter } from "node:events";

export const eventBus = new EventEmitter();

export const EVENTS = {
  NOW_PLAYING: "now-playing",
  SETTINGS_UPDATED: "settings-updated"
};
