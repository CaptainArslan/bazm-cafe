import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./socket.types.js";
import type { Socket } from "socket.io";
import { verifyAccessToken } from "../modules/auth/token.service.js";
import { getCurrentUser } from "../modules/auth/auth.service.js";
import { getGuestSessionFromRawToken } from "../modules/guest-sessions/guest-session.service.js";
import { GUEST_SESSION_CONSTANTS } from "../modules/guest-sessions/guest-session.constants.js";
import { SOCKET_EVENTS, SOCKET_ROOMS } from "./socket.constants.js";
import type { OrderSocketPayload } from "./socket.constants.js";

type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

function parseCookieHeader(
  cookieHeader: string | undefined,
): Record<string, string> {
  if (cookieHeader === undefined) {
    return {};
  }

  return Object.fromEntries(
    cookieHeader.split(";").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, decodeURIComponent(rest.join("="))];
    }),
  );
}

export function registerSocketEvents(socket: AppSocket): void {
  socket.data.connectedAt = new Date();

  void (async () => {
    try {
      const authToken =
        typeof socket.handshake.auth?.token === "string"
          ? socket.handshake.auth.token
          : undefined;

      if (authToken !== undefined) {
        const claims = verifyAccessToken(authToken);
        const user = await getCurrentUser(BigInt(claims.sub), claims.sid);

        socket.data.user = {
          uuid: user.id,
          role: user.role,
        };

        await socket.join(SOCKET_ROOMS.OPERATIONS);
      } else {
        const cookies = parseCookieHeader(socket.handshake.headers.cookie);
        const guestToken = cookies[GUEST_SESSION_CONSTANTS.COOKIE_NAME];

        if (guestToken !== undefined) {
          const { context } = await getGuestSessionFromRawToken(guestToken);
          socket.data.guestSessionId = context.id;
          await socket.join(SOCKET_ROOMS.guestSession(context.id));
        }
      }

      socket.emit("connection:ready", {
        socketId: socket.id,
        message: "Socket connected to BAZM Cafe backend.",
        connectedAt: socket.data.connectedAt.toISOString(),
        room:
          socket.data.user !== undefined
            ? SOCKET_ROOMS.OPERATIONS
            : socket.data.guestSessionId !== undefined
              ? SOCKET_ROOMS.guestSession(socket.data.guestSessionId)
              : null,
      });
    } catch {
      socket.emit("connection:ready", {
        socketId: socket.id,
        message: "Socket connected without authorized rooms.",
        connectedAt: socket.data.connectedAt.toISOString(),
        room: null,
      });
    }
  })();

  socket.on("connection:ping", (acknowledgement) => {
    acknowledgement({
      success: true,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("disconnect", (reason) => {
    console.log(`Socket disconnected: ${socket.id} (${reason})`);
  });

  socket.on("error", (error) => {
    console.error(`Socket error: ${socket.id}`, error);
  });
}

export type { OrderSocketPayload };
export { SOCKET_EVENTS };
