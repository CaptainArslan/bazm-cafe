import { OrderStatus } from "../types/enums";

export const ORDER_STATUS_LABELS: Record<OrderStatus, { label: string; color: string }> = {
  [OrderStatus.PENDING]: { label: "Pending", color: "bz-amber" },
  [OrderStatus.ACCEPTED]: { label: "Accepted", color: "bz-blue" },
  [OrderStatus.PREPARING]: { label: "Preparing", color: "bz-blue" },
  [OrderStatus.READY]: { label: "Ready", color: "bz-teal" },
  [OrderStatus.SERVED]: { label: "Served", color: "bz-teal" },
  [OrderStatus.COMPLETED]: { label: "Completed", color: "bz-green" },
  [OrderStatus.REJECTED]: { label: "Rejected", color: "bz-red" },
  [OrderStatus.CANCELLED]: { label: "Cancelled", color: "bz-red" },
};
