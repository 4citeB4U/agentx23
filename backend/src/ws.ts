import { WebSocket, WebSocketServer } from "ws";
import { messageRouter } from "./services/router.js";

export function setupWebSocket(port: number) {
  const wss = new WebSocketServer({ port });

  wss.on("error", (error: any) => {
    if (error?.code === "EADDRINUSE") {
      console.error(
        `[ws] Port ${port} is already in use. WebSocket bridge disabled for this process.`,
      );
      return;
    }
    console.error("[ws] WebSocket server error:", error?.message || error);
  });

  console.log(`[ws] Neural Bridge WebSocket active on port ${port}`);

  // Subscribe to router for outgoing broadcasts
  messageRouter.subscribe((message) => {
    const broadcastData = JSON.stringify(message);
    const clients = Array.from(wss.clients ?? ([] as any));
    clients.forEach((client: any) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(broadcastData);
      }
    });
  });

  wss.on("connection", (ws: WebSocket) => {
    console.log("[ws] Client connected to neural bridge");

    ws.on("message", async (data: string) => {
      try {
        const message = JSON.parse(data.toString());

        // Route through central bus
        const response = await messageRouter.routeMessage({
          text: message.text,
          source: message.source || "voice",
          id: message.id,
        });

        if (response) {
          ws.send(JSON.stringify(response));
        }
      } catch (error: any) {
        console.error("[ws] Message error:", error.message);
        ws.send(JSON.stringify({ error: error.message }));
      }
    });

    ws.on("close", () => {
      console.log("[ws] Client disconnected from neural bridge");
    });
  });

  return wss;
}
