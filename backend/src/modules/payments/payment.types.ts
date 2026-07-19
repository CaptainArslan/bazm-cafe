export type SafePayment = {
  id: string;
  paymentNumber: string;
  orderId: string;
  amount: string;
  method: string;
  status: string;
  reference: string | null;
  notes: string | null;
  paidAt: Date | null;
  voidedAt: Date | null;
  voidReason: string | null;
  createdAt: Date;
};
