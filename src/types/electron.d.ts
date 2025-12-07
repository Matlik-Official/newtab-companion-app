export interface NowPlaying {
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  progressMs: number;
  durationMs: number;
  isPlaying: boolean;
  source: "spotify" | "cider" | "system" | "none";
}

export interface Settings {
  preferSpotify: boolean;
  preferCider: boolean;
  useSystemMediaSession: boolean;
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
  windowTrafficLights: () => Promise<{ visible: boolean; position: { x: number; y: number } | null }>;
  windowSetTrafficLights: (payload: {
    position?: { x: number; y: number };
    visible?: boolean;
  }) => Promise<{ ok: boolean; message?: string; visible?: boolean; position?: { x: number; y: number } | null }>;
  windowToggleTrafficLights: () => Promise<{ ok: boolean; message?: string; visible?: boolean; position?: { x: number; y: number } | null }>;
  windowIsFullscreen: () => Promise<{ fullscreen: boolean }>;
  onNowPlaying: (cb: (data: NowPlaying) => void) => () => void;
  onSettingsUpdated: (cb: (data: Settings) => void) => () => void;
  onWindowTrafficLights: (cb: (data: { visible: boolean; position: { x: number; y: number } | null }) => void) => () => void;
  onWindowFullscreen: (cb: (data: { fullscreen: boolean }) => void) => () => void;
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
