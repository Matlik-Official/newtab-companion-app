import WebSocket from "ws";
import { default as cuid } from "cuid";

export function createCiderService() {
  let socket = null;
  let isHealthy = false;

  async function connect() {
    return new Promise((resolve) => {
      try {
        socket = new WebSocket("ws://localhost:10767");
        socket.on("open", () => {
          isHealthy = true;
          resolve(true);
        });
        socket.on("close", () => {
          isHealthy = false;
        });
        socket.on("error", () => {
          isHealthy = false;
          resolve(false);
        });
      } catch (err) {
        isHealthy = false;
        resolve(false);
      }
    });
  }

  return {
    id: "cider",
    async isAvailable() {
      if (isHealthy) return true;
      return connect();
    },
    async getNowPlaying() {
      if (!socket || socket.readyState !== WebSocket.OPEN) return null;
      // Minimal request/response cycle for now; extend with proper RPC later.
      return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(null), 600);
        const request = JSON.stringify({ action: "track:info", id: cuid() });
        socket.once("message", (msg) => {
          clearTimeout(timeout);
          try {
            const parsed = JSON.parse(msg.toString());
            const data = parsed.data || parsed.payload || {};
            resolve({
              title: data.title || "",
              artist: data.artist || data.artists?.join(", ") || "",
              album: data.album || "",
              artworkUrl: data.artworkUrl || "",
              progressMs: data.position ?? 0,
              durationMs: data.duration ?? 0,
              isPlaying: data.isPlaying ?? false,
              source: "cider"
            });
          } catch {
            resolve(null);
          }
        });
        socket.send(request);
      });
    }
  };
}
