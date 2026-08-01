import { endpoints } from "./endpoints";
import { authHttp } from "./http";
import type { PaymentMethod } from "../types/enums";
import type { SafeOrder } from "../types/order";
import type { SafePayment } from "../types/payment";

export type RecordPaymentInput = { amount: number; method: PaymentMethod; reference?: string; notes?: string };

export function listAdminPayments() {
  return authHttp.get<{ payments: SafePayment[] }>(endpoints.payments.list);
}

export function getPayment(paymentId: string) {
  return authHttp.get<{ payment: SafePayment }>(endpoints.payments.detail(paymentId));
}

export function listOrderPayments(orderId: string) {
  return authHttp.get<{ payments: SafePayment[] }>(endpoints.orders.payments(orderId));
}

export function recordPayment(orderId: string, input: RecordPaymentInput) {
  return authHttp.post<{ payment: SafePayment; order: SafeOrder; duplicated: boolean; sessionClosed: boolean; receiptRawToken: string | null }>(
    endpoints.orders.payments(orderId),
    input,
  );
}

export function reversePayment(paymentId: string, reason: string) {
  return authHttp.post<{ payment: SafePayment; order: SafeOrder }>(endpoints.payments.reverse(paymentId), { reason });
}
