import { OrderPaymentStatus, OrderStatus } from "../types/enums";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: "Pending",
  [OrderStatus.ACCEPTED]: "Accepted",
  [OrderStatus.PREPARING]: "Preparing",
  [OrderStatus.READY]: "Ready",
  [OrderStatus.SERVED]: "Served",
  [OrderStatus.COMPLETED]: "Completed",
  [OrderStatus.REJECTED]: "Rejected",
  [OrderStatus.CANCELLED]: "Cancelled",
};

export const ORDER_STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: "bg-bz-amber-tint text-bz-ink-800",
  [OrderStatus.ACCEPTED]: "bg-bz-gold-100 text-bz-gold-800",
  [OrderStatus.PREPARING]: "bg-bz-gold-100 text-bz-gold-800",
  [OrderStatus.READY]: "bg-bz-green-tint text-bz-green-deep",
  [OrderStatus.SERVED]: "bg-bz-green-tint text-bz-green-deep",
  [OrderStatus.COMPLETED]: "bg-bz-green-tint text-bz-green-deep",
  [OrderStatus.REJECTED]: "bg-bz-red-tint text-bz-red",
  [OrderStatus.CANCELLED]: "bg-bz-red-tint text-bz-red",
};

export const ORDER_STATUS_TIMELINE: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.SERVED,
  OrderStatus.COMPLETED,
];

export const PAYMENT_STATUS_LABEL: Record<OrderPaymentStatus, string> = {
  [OrderPaymentStatus.UNPAID]: "Unpaid",
  [OrderPaymentStatus.PARTIALLY_PAID]: "Partially Paid",
  [OrderPaymentStatus.PAID]: "Paid",
  [OrderPaymentStatus.REFUNDED]: "Refunded",
};

export const PAYMENT_STATUS_BADGE_CLASS: Record<OrderPaymentStatus, string> = {
  [OrderPaymentStatus.UNPAID]: "bg-bz-red-tint text-bz-red",
  [OrderPaymentStatus.PARTIALLY_PAID]: "bg-bz-amber-tint text-bz-ink-800",
  [OrderPaymentStatus.PAID]: "bg-bz-green-tint text-bz-green-deep",
  [OrderPaymentStatus.REFUNDED]: "bg-bz-ink-100 text-bz-ink-700",
};
