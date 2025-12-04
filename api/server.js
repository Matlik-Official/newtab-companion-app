import http from "node:http";
import express from "express";
import { WebSocketServer } from "ws";
import { EVENTS } from "../state/events.js";

export function createApiServer({ eventBus, nowPlayingStore, settingsStore }) {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.get("/api/now-playing", (_req, res) => {
    res.json(nowPlayingStore.get());
  });

  app.get("/api/settings", async (_req, res) => {
    res.json(await settingsStore.get());
  });

  app.post("/api/settings", async (req, res) => {
    const updated = await settingsStore.update(req.body || {});
    res.json(updated);
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });

  function broadcast(payload) {
    const data = JSON.stringify({ type: "now-playing", payload });
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(data);
      }
    });
  }

  eventBus.on(EVENTS.NOW_PLAYING, broadcast);

  return {
    async start(port) {
      await new Promise((resolve) => server.listen(port, resolve));
      return port;
    },
    async stop() {
      await new Promise((resolve) => wss.close(() => resolve()));
      await new Promise((resolve) => server.close(() => resolve()));
    }
  };
}
