import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;
let authToken: string | null = null;

function buildSocket(): Socket {
  return io({
    path: "/socket.io",
    withCredentials: true,
    autoConnect: false,
    transports: ["websocket", "polling"],
    auth: authToken ? { token: authToken } : {},
  });
}

export function getSocket(): Socket {
  if (socket) {
    return socket;
  }

  socket = buildSocket();
  return socket;
}

export function connectSocket(): Socket {
  const instance = getSocket();

  if (!instance.connected) {
    instance.connect();
  }

  return instance;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}

export function setSocketAuthToken(token: string | null): void {
  if (authToken === token) {
    return;
  }
  authToken = token;

  const wasConnected = socket?.connected ?? false;
  socket?.disconnect();
  socket = buildSocket();

  if (wasConnected) {
    socket.connect();
  }
}
