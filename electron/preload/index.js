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
  onNowPlaying: createListener("now-playing"),
  onSettingsUpdated: createListener("settings-updated")
});
