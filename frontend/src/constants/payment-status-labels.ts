import { OrderPaymentStatus } from "../types/enums";

export const PAYMENT_STATUS_LABELS: Record<OrderPaymentStatus, { label: string; color: string }> = {
  [OrderPaymentStatus.UNPAID]: { label: "Unpaid", color: "bz-red" },
  [OrderPaymentStatus.PARTIALLY_PAID]: { label: "Partially Paid", color: "bz-amber" },
  [OrderPaymentStatus.PAID]: { label: "Paid", color: "bz-green" },
  [OrderPaymentStatus.REFUNDED]: { label: "Refunded", color: "bz-ink-500" },
};
