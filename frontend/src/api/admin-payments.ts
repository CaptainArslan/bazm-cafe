import { authHttp } from "./http";
import type { PaymentMethod } from "../types/enums";
import type { SafeOrder } from "../types/order";
import type { SafePayment } from "../types/payment";

export type RecordPaymentInput = { amount: number; method: PaymentMethod; reference?: string; notes?: string };

export function listAdminPayments() {
  return authHttp.get<{ payments: SafePayment[] }>("/payments");
}

export function getPayment(paymentId: string) {
  return authHttp.get<{ payment: SafePayment }>(`/payments/${paymentId}`);
}

export function listOrderPayments(orderId: string) {
  return authHttp.get<{ payments: SafePayment[] }>(`/orders/${orderId}/payments`);
}

export function recordPayment(orderId: string, input: RecordPaymentInput) {
  return authHttp.post<{ payment: SafePayment; order: SafeOrder; duplicated: boolean; sessionClosed: boolean; receiptRawToken: string | null }>(
    `/orders/${orderId}/payments`,
    input,
  );
}

export function reversePayment(paymentId: string, reason: string) {
  return authHttp.post<{ payment: SafePayment; order: SafeOrder }>(`/payments/${paymentId}/reverse`, { reason });
}
