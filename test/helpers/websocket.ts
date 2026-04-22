import { env } from "cloudflare:test";

export async function openSessionSocket(sessionId: string): Promise<WebSocket> {
  const id = env.POKER_SESSION.idFromName(sessionId);
  const stub = env.POKER_SESSION.get(id);
  const response = await stub.fetch(`http://example.com/ws/${sessionId}`, {
    headers: { Upgrade: "websocket" },
  });

  if (response.status !== 101 || !response.webSocket) {
    throw new Error(`Expected websocket upgrade, got ${response.status}`);
  }

  const socket = response.webSocket;
  socket.accept();
  return socket;
}

export function nextJsonMessage(socket: WebSocket): Promise<any> {
  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      socket.removeEventListener("message", handleMessage);
      socket.removeEventListener("error", handleError as EventListener);
      resolve(JSON.parse(String(event.data)));
    };
    const handleError = (event: Event) => {
      socket.removeEventListener("message", handleMessage);
      reject(event);
    };

    socket.addEventListener("message", handleMessage);
    socket.addEventListener("error", handleError as EventListener, { once: true });
  });
}
