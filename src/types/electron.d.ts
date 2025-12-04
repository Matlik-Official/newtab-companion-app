export interface NowPlaying {
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  progressMs: number;
  durationMs: number;
  isPlaying: boolean;
  source: "spotify" | "cider" | "none";
}

export interface Settings {
  preferSpotify: boolean;
  preferCider: boolean;
  autostart: boolean;
  apiPort: number;
}

export interface ElectronAPI {
  ping: () => Promise<string>;
  getSettings: () => Promise<Settings>;
  updateSettings: (payload: Partial<Settings>) => Promise<Settings>;
  getNowPlaying: () => Promise<NowPlaying>;
  startSpotifyLogin: () => Promise<{ accessToken: string; refreshToken?: string; expiresAt?: number }>;
  spotifyStatus: () => Promise<{ connected: boolean }>;
  spotifyLogout: () => Promise<{ ok: boolean }>;
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowClose: () => Promise<void>;
  onNowPlaying: (cb: (data: NowPlaying) => void) => () => void;
  onSettingsUpdated: (cb: (data: Settings) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
