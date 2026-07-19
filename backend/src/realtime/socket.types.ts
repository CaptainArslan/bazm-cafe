import type { OrderSocketPayload } from "./socket.constants.js";

export type TableSocketPayload = {
  tableId: string;
  tableNumber: string;
  guestSessionId?: string;
  changedAt: string;
};

export type GuestSessionSocketPayload = {
  guestSessionId: string;
  closureType?: string;
  tableId?: string;
  changedAt: string;
};

export interface ClientToServerEvents {
  "connection:ping": (
    acknowledgement: (response: {
      success: true;
      timestamp: string;
    }) => void,
  ) => void;
}

export interface ServerToClientEvents {
  "connection:ready": (payload: {
    socketId: string;
    message: string;
    connectedAt: string;
    room: string | null;
  }) => void;
  "order:created": (payload: OrderSocketPayload) => void;
  "order:accepted": (payload: OrderSocketPayload) => void;
  "order:rejected": (payload: OrderSocketPayload) => void;
  "order:status-updated": (payload: OrderSocketPayload) => void;
  "order:cancelled": (payload: OrderSocketPayload) => void;
  "order:payment-updated": (payload: OrderSocketPayload) => void;
  "order:completed": (payload: OrderSocketPayload) => void;
  "table:occupied": (payload: TableSocketPayload) => void;
  "table:released": (payload: TableSocketPayload) => void;
  "guest-session:expired": (payload: GuestSessionSocketPayload) => void;
  "guest-session:closed": (payload: GuestSessionSocketPayload) => void;
  "guest-session:force-closed": (payload: GuestSessionSocketPayload) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  connectedAt: Date;
  user?: {
    uuid: string;
    role: "ADMIN" | "STAFF";
  };
  guestSessionId?: string;
}
