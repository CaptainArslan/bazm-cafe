import { endpoints } from "./endpoints";
import { API_BASE_URL, authHttp } from "./http";
import type { OrderPaymentStatus, OrderStatus } from "../types/enums";
import type { SafeOrder } from "../types/order";

export type StaffOrderFilters = {
  status?: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
};

export type AttachCustomerInput = { customerId: string } | { name: string; phone?: string };

function buildQuery(filters?: StaffOrderFilters): string {
  if (!filters) {
    return "";
  }
  const params = new URLSearchParams();
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.paymentStatus) {
    params.set("paymentStatus", filters.paymentStatus);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function listStaffOrders(filters?: StaffOrderFilters) {
  return authHttp.get<{ orders: SafeOrder[] }>(`${endpoints.orders.list}${buildQuery(filters)}`);
}

export function getStaffOrder(orderId: string) {
  return authHttp.get<{ order: SafeOrder }>(endpoints.orders.detail(orderId));
}

export function acceptOrder(orderId: string) {
  return authHttp.post<{ order: SafeOrder }>(endpoints.orders.accept(orderId));
}

export function startPreparingOrder(orderId: string) {
  return authHttp.post<{ order: SafeOrder }>(endpoints.orders.startPreparing(orderId));
}

export function markOrderReady(orderId: string) {
  return authHttp.post<{ order: SafeOrder }>(endpoints.orders.markReady(orderId));
}

export function markOrderServed(orderId: string) {
  return authHttp.post<{ order: SafeOrder }>(endpoints.orders.markServed(orderId));
}

export function rejectOrder(orderId: string, reason: string) {
  return authHttp.post<{ order: SafeOrder }>(endpoints.orders.reject(orderId), { reason });
}

export function cancelOrder(orderId: string, reason: string) {
  return authHttp.post<{ order: SafeOrder }>(endpoints.orders.cancel(orderId), { reason });
}

export function attachCustomerToOrder(orderId: string, input: AttachCustomerInput) {
  return authHttp.post<{ order: SafeOrder }>(endpoints.orders.attachCustomer(orderId), input);
}

export function getStaffReceiptUrl(orderId: string): string {
  return `${API_BASE_URL}${endpoints.orders.receipt(orderId)}`;
}
