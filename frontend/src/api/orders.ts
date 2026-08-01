import { endpoints } from "./endpoints";
import { API_BASE_URL, http } from "./http";
import type { SafeOrder } from "../types/order";

export type CreateGuestOrderInput = {
  items: Array<{ productId: string; quantity: number; notes?: string }>;
  customerNotes?: string;
  customerName?: string;
  customerPhone?: string;
};

export function createGuestOrder(input: CreateGuestOrderInput) {
  return http.post<{ order: SafeOrder }>(endpoints.guestOrders.list, input);
}

export function listGuestOrders() {
  return http.get<{ orders: SafeOrder[] }>(endpoints.guestOrders.list);
}

export function getGuestOrder(orderPublicId: string) {
  return http.get<{ order: SafeOrder }>(endpoints.guestOrders.detail(orderPublicId));
}

export function getGuestReceiptUrl(orderPublicId: string) {
  return `${API_BASE_URL}${endpoints.guestOrders.receipt(orderPublicId)}`;
}
