import { getSocketServer } from "./socket.server.js";
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type GuestSessionSocketPayload,
  type OrderSocketPayload,
  type TableSocketPayload,
} from "./socket.constants.js";

type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

function withOrderStatus(payload: OrderSocketPayload): OrderSocketPayload {
  const orderStatus = payload.orderStatus ?? payload.status;
  return {
    ...payload,
    status: orderStatus,
    orderStatus,
  };
}

function safeEmit(
  room: string,
  event: SocketEventName,
  payload: OrderSocketPayload | TableSocketPayload | GuestSessionSocketPayload,
): void {
  try {
    const server = getSocketServer();
    // Event/payload pairs are enforced at call sites; Socket.IO's emit overload
    // cannot narrow a shared helper across order/table/session payload unions.
    (server.to(room) as { emit: (event: string, data: unknown) => void }).emit(
      event,
      payload,
    );
  } catch {
    // Socket server may be unavailable in isolated scripts; never fail domain flow.
  }
}

export function publishOrderCreated(payload: OrderSocketPayload): void {
  safeEmit(
    SOCKET_ROOMS.OPERATIONS,
    SOCKET_EVENTS.ORDER_CREATED,
    withOrderStatus(payload),
  );
}

export function publishOrderAccepted(
  guestSessionUuid: string,
  payload: OrderSocketPayload,
): void {
  const normalized = withOrderStatus(payload);
  safeEmit(SOCKET_ROOMS.OPERATIONS, SOCKET_EVENTS.ORDER_ACCEPTED, normalized);
  safeEmit(
    SOCKET_ROOMS.guestSession(guestSessionUuid),
    SOCKET_EVENTS.ORDER_ACCEPTED,
    normalized,
  );
  safeEmit(
    SOCKET_ROOMS.OPERATIONS,
    SOCKET_EVENTS.ORDER_STATUS_UPDATED,
    normalized,
  );
  safeEmit(
    SOCKET_ROOMS.guestSession(guestSessionUuid),
    SOCKET_EVENTS.ORDER_STATUS_UPDATED,
    normalized,
  );
}

export function publishOrderRejected(
  guestSessionUuid: string,
  payload: OrderSocketPayload,
): void {
  const normalized = withOrderStatus(payload);
  safeEmit(SOCKET_ROOMS.OPERATIONS, SOCKET_EVENTS.ORDER_REJECTED, normalized);
  safeEmit(
    SOCKET_ROOMS.guestSession(guestSessionUuid),
    SOCKET_EVENTS.ORDER_REJECTED,
    normalized,
  );
  safeEmit(
    SOCKET_ROOMS.OPERATIONS,
    SOCKET_EVENTS.ORDER_STATUS_UPDATED,
    normalized,
  );
  safeEmit(
    SOCKET_ROOMS.guestSession(guestSessionUuid),
    SOCKET_EVENTS.ORDER_STATUS_UPDATED,
    normalized,
  );
}

export function publishOrderStatusUpdated(
  guestSessionUuid: string,
  payload: OrderSocketPayload,
): void {
  const normalized = withOrderStatus(payload);
  safeEmit(
    SOCKET_ROOMS.OPERATIONS,
    SOCKET_EVENTS.ORDER_STATUS_UPDATED,
    normalized,
  );
  safeEmit(
    SOCKET_ROOMS.guestSession(guestSessionUuid),
    SOCKET_EVENTS.ORDER_STATUS_UPDATED,
    normalized,
  );
}

export function publishOrderCancelled(
  guestSessionUuid: string,
  payload: OrderSocketPayload,
): void {
  const normalized = withOrderStatus(payload);
  safeEmit(SOCKET_ROOMS.OPERATIONS, SOCKET_EVENTS.ORDER_CANCELLED, normalized);
  safeEmit(
    SOCKET_ROOMS.guestSession(guestSessionUuid),
    SOCKET_EVENTS.ORDER_CANCELLED,
    normalized,
  );
  safeEmit(
    SOCKET_ROOMS.OPERATIONS,
    SOCKET_EVENTS.ORDER_STATUS_UPDATED,
    normalized,
  );
  safeEmit(
    SOCKET_ROOMS.guestSession(guestSessionUuid),
    SOCKET_EVENTS.ORDER_STATUS_UPDATED,
    normalized,
  );
}

export function publishOrderPaymentUpdated(
  guestSessionUuid: string,
  payload: OrderSocketPayload,
): void {
  const normalized = withOrderStatus(payload);
  safeEmit(
    SOCKET_ROOMS.OPERATIONS,
    SOCKET_EVENTS.ORDER_PAYMENT_UPDATED,
    normalized,
  );
  safeEmit(
    SOCKET_ROOMS.guestSession(guestSessionUuid),
    SOCKET_EVENTS.ORDER_PAYMENT_UPDATED,
    normalized,
  );
}

export function publishOrderCompleted(
  guestSessionUuid: string,
  payload: OrderSocketPayload,
): void {
  const normalized = withOrderStatus(payload);
  safeEmit(SOCKET_ROOMS.OPERATIONS, SOCKET_EVENTS.ORDER_COMPLETED, normalized);
  safeEmit(
    SOCKET_ROOMS.guestSession(guestSessionUuid),
    SOCKET_EVENTS.ORDER_COMPLETED,
    normalized,
  );
  safeEmit(
    SOCKET_ROOMS.OPERATIONS,
    SOCKET_EVENTS.ORDER_STATUS_UPDATED,
    normalized,
  );
  safeEmit(
    SOCKET_ROOMS.guestSession(guestSessionUuid),
    SOCKET_EVENTS.ORDER_STATUS_UPDATED,
    normalized,
  );
}

export function publishTableOccupied(payload: TableSocketPayload): void {
  safeEmit(SOCKET_ROOMS.OPERATIONS, SOCKET_EVENTS.TABLE_OCCUPIED, payload);
}

export function publishTableReleased(payload: TableSocketPayload): void {
  safeEmit(SOCKET_ROOMS.OPERATIONS, SOCKET_EVENTS.TABLE_RELEASED, payload);
}

export function publishGuestSessionExpired(
  payload: GuestSessionSocketPayload,
): void {
  safeEmit(
    SOCKET_ROOMS.OPERATIONS,
    SOCKET_EVENTS.GUEST_SESSION_EXPIRED,
    payload,
  );
  safeEmit(
    SOCKET_ROOMS.guestSession(payload.guestSessionId),
    SOCKET_EVENTS.GUEST_SESSION_EXPIRED,
    payload,
  );
}

export function publishGuestSessionClosed(
  payload: GuestSessionSocketPayload,
): void {
  safeEmit(
    SOCKET_ROOMS.OPERATIONS,
    SOCKET_EVENTS.GUEST_SESSION_CLOSED,
    payload,
  );
  safeEmit(
    SOCKET_ROOMS.guestSession(payload.guestSessionId),
    SOCKET_EVENTS.GUEST_SESSION_CLOSED,
    payload,
  );
}

export function publishGuestSessionForceClosed(
  payload: GuestSessionSocketPayload,
): void {
  safeEmit(
    SOCKET_ROOMS.OPERATIONS,
    SOCKET_EVENTS.GUEST_SESSION_FORCE_CLOSED,
    payload,
  );
  safeEmit(
    SOCKET_ROOMS.guestSession(payload.guestSessionId),
    SOCKET_EVENTS.GUEST_SESSION_FORCE_CLOSED,
    payload,
  );
}
