import type {
  CustomerType,
  OrderPaymentStatus,
  OrderStatus,
} from "../../generated/prisma/enums.js";

export type SafeOrderItem = {
  productId: string | null;
  productNameSnapshot: string;
  /** @deprecated Prefer productNameSnapshot */
  name: string;
  unitPriceSnapshot: string;
  /** @deprecated Prefer unitPriceSnapshot */
  unitPrice: string;
  preparationTimeMinutesSnapshot: number;
  quantity: number;
  lineTotal: string;
  notes: string | null;
};

export type SafeOrder = {
  id: string;
  orderNumber: string;
  billNumber: string;
  orderType: CustomerType;
  orderStatus: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  tableId: string | null;
  tableNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  subtotal: string;
  taxAmount: string;
  serviceChargeAmount: string;
  discountAmount: string;
  totalAmount: string;
  paidAmount: string;
  remainingAmount: string;
  estimatedPreparationMinutes: number;
  estimatedReadyAt: Date | null;
  customerNotes: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  receiptImagePath: string | null;
  receiptImageUrl: string | null;
  items: SafeOrderItem[];
  acceptedAt: Date | null;
  preparingAt: Date | null;
  readyAt: Date | null;
  servedAt: Date | null;
  completedAt: Date | null;
  rejectedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
