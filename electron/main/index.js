import "dotenv/config";
import { app, BrowserWindow, ipcMain } from "electron";
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.VITE_DEV_SERVER_URL;

let mainWindow;
const nowPlayingStore = createNowPlayingStore(eventBus);
const spotify = createSpotifyService();
const cider = createCiderService();
const services = [spotify, cider];
let settingsStore;
let apiServer;
let currentPort;

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
      devTools: true
    }
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexPath = path.join(__dirname, "..", "..", "dist", "index.html");
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
    getSettings: () => settingsStore.get()
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

  eventBus.on(EVENTS.NOW_PLAYING, (payload) => {
    BrowserWindow.getAllWindows().forEach((win) =>
      win.webContents.send("now-playing", payload)
    );
  });

  eventBus.on(EVENTS.SETTINGS_UPDATED, async (next) => {
    BrowserWindow.getAllWindows().forEach((win) =>
      win.webContents.send("settings-updated", next)
    );
    if (next.apiPort && next.apiPort !== currentPort) {
      await startApi(next.apiPort);
    }
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
