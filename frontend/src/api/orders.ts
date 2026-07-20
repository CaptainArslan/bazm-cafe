import { API_BASE_URL, http } from "./http";
import type { SafeOrder } from "../types/order";

export type CreateGuestOrderInput = {
  items: Array<{ productId: string; quantity: number; notes?: string }>;
  customerNotes?: string;
  customerName?: string;
  customerPhone?: string;
};

export function createGuestOrder(input: CreateGuestOrderInput) {
  return http.post<{ order: SafeOrder }>("/guest/orders", input);
}

export function listGuestOrders() {
  return http.get<{ orders: SafeOrder[] }>("/guest/orders");
}

export function getGuestOrder(orderPublicId: string) {
  return http.get<{ order: SafeOrder }>(`/guest/orders/${orderPublicId}`);
}

export function getGuestReceiptUrl(orderPublicId: string) {
  return `${API_BASE_URL}/guest/orders/${orderPublicId}/receipt`;
}
