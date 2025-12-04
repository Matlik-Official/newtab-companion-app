import fs from "node:fs/promises";
import path from "node:path";
import { EVENTS } from "./events.js";
import { defaultSettings } from "./types.js";

/**
 * @param {object} params
 * @param {string} params.storageDir
 * @param {import("node:events").EventEmitter} params.eventBus
 */
export function createSettingsStore({ storageDir, eventBus }) {
  const filePath = path.join(storageDir, "settings.json");
  /** @type {import("./types.js").Settings} */
  let cached = { ...defaultSettings };

  async function load() {
    try {
      const buf = await fs.readFile(filePath, "utf8");
      cached = { ...defaultSettings, ...JSON.parse(buf) };
    } catch (err) {
      cached = { ...defaultSettings };
      await save(cached);
    }
    return cached;
  }

  async function save(settings) {
    cached = { ...defaultSettings, ...settings };
    await fs.mkdir(storageDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(cached, null, 2), "utf8");
    eventBus.emit(EVENTS.SETTINGS_UPDATED, cached);
    return cached;
  }

  return {
    async get() {
      return cached;
    },
    async load() {
      return load();
    },
    /**
     * @param {Partial<import("./types.js").Settings>} next
     */
    async update(next) {
      return save({ ...cached, ...next });
    },
    path: filePath
  };
}
