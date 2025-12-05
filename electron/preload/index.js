const { contextBridge, ipcRenderer } = require("electron");

const createListener = (channel) => (callback) => {
  if (!callback) return () => {};
  const listener = (_event, data) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld("electronAPI", {
  ping: () => ipcRenderer.invoke("ping"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (payload) => ipcRenderer.invoke("settings:update", payload),
  getNowPlaying: () => ipcRenderer.invoke("now-playing:get"),
  startSpotifyLogin: () => ipcRenderer.invoke("spotify:login"),
  spotifyStatus: () => ipcRenderer.invoke("spotify:status"),
  spotifyLogout: () => ipcRenderer.invoke("spotify:logout"),
  appVersion: () => ipcRenderer.invoke("app:version"),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  openExternal: (url) => ipcRenderer.invoke("open:external", url),
  windowMinimize: () => ipcRenderer.invoke("window:minimize"),
  windowMaximize: () => ipcRenderer.invoke("window:maximize"),
  windowClose: () => ipcRenderer.invoke("window:close"),
  windowTrafficLights: () => ipcRenderer.invoke("window:traffic-lights"),
  windowSetTrafficLights: (payload) => ipcRenderer.invoke("window:set-traffic-lights", payload),
  windowToggleTrafficLights: () => ipcRenderer.invoke("window:toggle-traffic-lights"),
  windowIsFullscreen: () => ipcRenderer.invoke("window:fullscreen"),
  onNowPlaying: createListener("now-playing"),
  onSettingsUpdated: createListener("settings-updated"),
  onWindowTrafficLights: createListener("window-traffic-lights"),
  onWindowFullscreen: createListener("window-fullscreen"),
  onUpdateStatus: createListener("update-status")
});
