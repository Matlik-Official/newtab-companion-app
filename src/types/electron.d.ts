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
  appVersion: () => Promise<string>;
  checkForUpdates: () => Promise<{ ok: boolean; info?: unknown; message?: string }>;
  installUpdate: () => Promise<{ ok: boolean; message?: string }>;
  openExternal: (url: string) => Promise<{ ok: boolean; message?: string }>;
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowClose: () => Promise<void>;
  onNowPlaying: (cb: (data: NowPlaying) => void) => () => void;
  onSettingsUpdated: (cb: (data: Settings) => void) => () => void;
  onUpdateStatus: (cb: (data: unknown) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}


export interface ImageTypes {
  id: number;
  title: string;
  description: string;
  tags: string;
  original_image: string;
  thumbnail_image: string;
  pixelated_image: string;
  author: string;
  author_profile: string;
}