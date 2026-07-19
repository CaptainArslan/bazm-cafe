export const SOCKET_ROOMS = {
  OPERATIONS: "operations",
  guestSession: (sessionUuid: string) => `guest-session:${sessionUuid}`,
} as const;

export const SOCKET_EVENTS = {
  ORDER_CREATED: "order:created",
  ORDER_ACCEPTED: "order:accepted",
  ORDER_REJECTED: "order:rejected",
  ORDER_STATUS_UPDATED: "order:status-updated",
  ORDER_CANCELLED: "order:cancelled",
  ORDER_PAYMENT_UPDATED: "order:payment-updated",
  ORDER_COMPLETED: "order:completed",
  TABLE_OCCUPIED: "table:occupied",
  TABLE_RELEASED: "table:released",
  GUEST_SESSION_EXPIRED: "guest-session:expired",
  GUEST_SESSION_CLOSED: "guest-session:closed",
  GUEST_SESSION_FORCE_CLOSED: "guest-session:force-closed",
} as const;

export type OrderSocketPayload = {
  orderId: string;
  orderNumber: string;
  /** @deprecated Prefer orderStatus */
  status: string;
  orderStatus: string;
  paymentStatus?: string;
  paidAmount?: string;
  remainingAmount?: string;
  changedAt: string;
  summary?: string;
};

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
