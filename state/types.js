/**
 * @typedef {Object} NowPlaying
 * @property {string} title
 * @property {string} artist
 * @property {string} album
 * @property {string} artworkUrl
 * @property {number} progressMs
 * @property {number} durationMs
 * @property {boolean} isPlaying
 * @property {"spotify"|"cider"|"none"} source
 */

/**
 * @typedef {Object} Settings
 * @property {boolean} preferSpotify
 * @property {boolean} preferCider
 * @property {boolean} autostart
 * @property {number} apiPort
 */

/** @type {NowPlaying} */
export const defaultNowPlaying = {
  title: "",
  artist: "",
  album: "",
  artworkUrl: "",
  progressMs: 0,
  durationMs: 0,
  isPlaying: false,
  source: "none"
};

/** @type {Settings} */
export const defaultSettings = {
  preferSpotify: true,
  preferCider: false,
  autostart: false,
  apiPort: 8787
};
