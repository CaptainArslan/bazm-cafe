export const CustomerType = {
  DINE_IN: "DINE_IN",
  TAKEAWAY: "TAKEAWAY",
} as const;
export type CustomerType = (typeof CustomerType)[keyof typeof CustomerType];

export const OrderStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  PREPARING: "PREPARING",
  READY: "READY",
  SERVED: "SERVED",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const OrderPaymentStatus = {
  UNPAID: "UNPAID",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
  REFUNDED: "REFUNDED",
} as const;
export type OrderPaymentStatus = (typeof OrderPaymentStatus)[keyof typeof OrderPaymentStatus];

export const PaymentMethod = {
  CASH: "CASH",
  CARD: "CARD",
  EASYPAISA: "EASYPAISA",
  JAZZCASH: "JAZZCASH",
  BANK_TRANSFER: "BANK_TRANSFER",
  OTHER: "OTHER",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];
