import http from "node:http";
import express from "express";
import { WebSocketServer } from "ws";
import { EVENTS } from "../state/events.js";

export function createApiServer({ eventBus, nowPlayingStore, settingsStore }) {
  const app = express();
  app.use(express.json());

  //
  // BASIC CORS
  //
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  //
  // STANDARD HTTP API ROUTES
  //
  app.get("/api/now-playing", (_req, res) => {
    res.json(nowPlayingStore.get());
  });

  app.get("/api/settings", async (_req, res) => {
    res.json(await settingsStore.get());
  });
  
  app.get("/api/widget", async (_req, res) => {
    res.send(`<p style="color: red;">haha</p>`);
  });

  app.post("/api/settings", async (req, res) => {
    const updated = await settingsStore.update(req.body || {});
    res.json(updated);
  });

  //
  // HTTP SERVER WRAPPER
  //
  const server = http.createServer(app);

  //
  // ALL WEBSOCKET ENDPOINT DEFINITIONS
  //
  const socketDefs = [
    { path: "/ws", server: new WebSocketServer({ noServer: true }) },
    { path: "/api/now-playing/ws", server: new WebSocketServer({ noServer: true }) }
  ];

  //
  // ATTACH WS LOGIC (connection + initial send)
  //
  socketDefs.forEach(({ path: wsPath, server: wss }) => {
    wss.on("error", (err) => {
      console.warn(`[ws] server error on ${wsPath}`, err?.message || err);
    });

    wss.on("connection", (client) => {
      console.log(`[ws] client connected on ${wsPath}`);

      //
      // HEARTBEAT: keep the socket alive
      //
      client.isAlive = true;

      client.on("pong", () => {
        client.isAlive = true;
      });

      client.on("error", (err) => {
        console.warn("[ws] client error", err?.message || err);
      });

      //
      // SEND INITIAL PAYLOAD IMMEDIATELY
      //
      try {
        const payload = nowPlayingStore.get();
        client.send(JSON.stringify({ type: "now-playing", payload }));
      } catch (err) {
        console.warn("[ws] initial send failed", err);
      }
    });
  });

  //
  // FIXED & ROBUST UPGRADE HANDLER
  //
  server.on("upgrade", (req, socket, head) => {
    const { pathname } = new URL(req.url, "http://localhost");
    console.log("[ws] upgrade request:", pathname);

    const match = socketDefs.find(({ path }) => path === pathname);

    if (!match) {
      console.warn("[ws] no WS handler for path:", pathname);
      socket.destroy();
      return;
    }

    match.server.handleUpgrade(req, socket, head, (ws) => {
      match.server.emit("connection", ws, req);
    });
  });

  //
  // BROADCAST NOW-PLAYING UPDATES
  //
  function broadcast(payload) {
    const data = JSON.stringify({ type: "now-playing", payload });

    socketDefs.forEach(({ server: wss }) => {
      wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(data);
        }
      });
    });
  }

  eventBus.on(EVENTS.NOW_PLAYING, broadcast);

  //
  // HEARTBEAT TIMER
  //
  setInterval(() => {
    socketDefs.forEach(({ server: wss }) => {
      wss.clients.forEach((client) => {
        if (!client.isAlive) {
          console.log("[ws] terminating dead client");
          return client.terminate();
        }
        client.isAlive = false;
        client.ping();
      });
    });
  }, 30000);

  //
  // EXPORTED SERVER CONTROL
  //
  return {
    async start(port) {
      await new Promise((resolve) => server.listen(port, resolve));
      console.log(`[api] server started on port ${port}`);
      return port;
    },

    async stop() {
      console.log("[api] shutting down…");

      for (const { server: wss } of socketDefs) {
        await new Promise((resolve) => wss.close(resolve));
      }

      await new Promise((resolve) => server.close(resolve));

      console.log("[api] server stopped");
    }
  };
}
