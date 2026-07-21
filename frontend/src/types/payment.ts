import type { PaymentMethod, PaymentStatus } from "./enums";

export type SafePayment = {
  id: string;
  paymentNumber: string;
  orderId: string;
  amount: string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string | null;
  notes: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
};
