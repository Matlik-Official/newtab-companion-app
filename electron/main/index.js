import { ENV } from "../env.js";
import { app, BrowserWindow, ipcMain, Tray, Menu } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApiServer } from "../../api/server.js";
import { createCiderService } from "../../services/cider.js";
import { createSpotifyService } from "../../services/spotify.js";
import { startSpotifyAuth } from "../../services/spotifyAuth.js";
import { clearTokens, hasTokens } from "../../services/spotifyTokens.js";
import { createPlaybackEngine } from "../../state/engine.js";
import { eventBus, EVENTS } from "../../state/events.js";
import { createNowPlayingStore } from "../../state/nowPlayingStore.js";
import { createSettingsStore } from "../../state/settingsStore.js";

// Ensure process.env is populated for all downstream modules in production.
process.env.SPOTIFY_CLIENT_ID = ENV.SPOTIFY_CLIENT_ID;
process.env.SPOTIFY_REDIRECT_URL = ENV.SPOTIFY_REDIRECT_URL;
process.env.SPOTIFY_REDIRECT_PORT = String(ENV.SPOTIFY_REDIRECT_PORT);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !!process.env.VITE_DEV_SERVER_URL;

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const REDIRECT_URL = process.env.SPOTIFY_REDIRECT_URL;
const REDIRECT_PORT = parseInt(process.env.SPOTIFY_REDIRECT_PORT, 10) || 4370;

let mainWindow;
const nowPlayingStore = createNowPlayingStore(eventBus);
const spotify = createSpotifyService();
const cider = createCiderService();
const services = [spotify, cider];
let settingsStore;
let apiServer;
let currentPort;
let tray = null;

async function refreshTrayMenu() {
  if (!tray || !settingsStore) return;
  const settings = await settingsStore.get();
  const np = nowPlayingStore.get();
  const nowPlayingLabel = np?.title
    ? `${np.title} — ${np.artist || ""}`.trim()
    : "Nothing playing";
  const spotifyStatus = settings?.preferSpotify
    ? np?.source === "spotify"
      ? "Active"
      : "Enabled"
    : "Disabled";
  const ciderStatus = settings?.preferCider
    ? np?.source === "cider"
      ? "Active"
      : "Enabled"
    : "Disabled";

  const contextMenu = Menu.buildFromTemplate([
    { label: `Now: ${nowPlayingLabel}`, enabled: false },
    { label: `Spotify: ${spotifyStatus}`, enabled: false },
    { label: `Cider: ${ciderStatus}`, enabled: false },
    { type: "separator" },
    {
      label: "Show",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        }
      },
    },
    {
      label: "Hide",
      click: () => {
        if (mainWindow) {
          mainWindow.hide();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);
  tray.setToolTip(`Now Playing Companion — ${nowPlayingLabel}`);
  tray.setContextMenu(contextMenu);
}
async function refreshNowPlayingOnce() {
  try {
    const spotifyService = services.find((s) => s.id === "spotify");
    if (!spotifyService) return null;
    const np = await spotifyService.getNowPlaying();
    if (np) {
      nowPlayingStore.set({ ...np, source: spotifyService.id });
    }
    return np;
  } catch (err) {
    console.warn("[main] refresh now playing failed", err);
    return null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 600,
    minHeight: 800,
    backgroundColor: "#0b1021",
    icon: path.join(__dirname, "..", "assets", "logo.png"),
    frame: false,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true,
    },
  });

  mainWindow.on("minimize", (event) => {
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on("close", (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(__dirname, "..", "renderer", "index.html");
    mainWindow.loadFile(indexPath);
  }
}

async function bootstrap() {
  const storageDir = path.join(app.getPath("userData"), "settings");
  settingsStore = createSettingsStore({ storageDir, eventBus });
  await settingsStore.load();

  apiServer = createApiServer({ eventBus, nowPlayingStore, settingsStore });

  const engine = createPlaybackEngine({
    services,
    nowPlayingStore,
    getSettings: () => settingsStore.get(),
  });
  engine.start();

  const startApi = async (port) => {
    if (currentPort === port) return;
    if (currentPort) {
      await apiServer.stop();
    }
    await apiServer.start(port);
    currentPort = port;
    console.log(`[api] listening on ${port}`);
  };

  const settings = await settingsStore.get();
  await startApi(settings.apiPort);

  const trayIcon = path.join(__dirname, "..", "assets", "logo.png");
  tray = new Tray(trayIcon);
  await refreshTrayMenu();
  tray.on("click", () => {
    mainWindow.show();
  });

  eventBus.on(EVENTS.NOW_PLAYING, (payload) => {
    BrowserWindow.getAllWindows().forEach((win) =>
      win.webContents.send("now-playing", payload)
    );
    refreshTrayMenu();
  });

  eventBus.on(EVENTS.SETTINGS_UPDATED, async (next) => {
    BrowserWindow.getAllWindows().forEach((win) =>
      win.webContents.send("settings-updated", next)
    );
    if (next.apiPort && next.apiPort !== currentPort) {
      await startApi(next.apiPort);
    }
    refreshTrayMenu();
  });

  ipcMain.handle("ping", () => "Pong from Electron main process.");
  ipcMain.handle("settings:get", () => settingsStore.get());
  ipcMain.handle("settings:update", (_evt, data) => settingsStore.update(data));
  ipcMain.handle("now-playing:get", () => nowPlayingStore.get());
  ipcMain.handle("spotify:login", async () => {
    const tokens = await startSpotifyAuth();
    await refreshNowPlayingOnce();
    return tokens;
  });
  ipcMain.handle("spotify:status", async () => {
    return { connected: await hasTokens() };
  });
  ipcMain.handle("spotify:logout", async () => {
    await clearTokens();
    nowPlayingStore.reset();
    refreshTrayMenu();
    return { ok: true };
  });
  ipcMain.handle("window:minimize", () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.minimize();
  });
  ipcMain.handle("window:maximize", () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });
  ipcMain.handle("window:close", () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.close();
  });
}

app.whenReady().then(async () => {
  await bootstrap();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
