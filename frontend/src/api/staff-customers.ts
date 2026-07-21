import { authHttp } from "./http";
import type { CustomerDetail, SafeCustomer } from "../types/customer";

export type SearchCustomersQuery = { search?: string; phone?: string };
export type CreateCustomerInput = { name: string; phone?: string; imagePath?: string };
export type UpdateCustomerInput = { name?: string; phone?: string | null; imagePath?: string | null };

function buildQuery(query: SearchCustomersQuery): string {
  const params = new URLSearchParams();
  if (query.search) {
    params.set("search", query.search);
  }
  if (query.phone) {
    params.set("phone", query.phone);
  }
  const built = params.toString();
  return built ? `?${built}` : "";
}

export function searchCustomers(query: SearchCustomersQuery) {
  return authHttp.get<{ customers: SafeCustomer[] }>(`/customers${buildQuery(query)}`);
}

export function getCustomerRecord(customerId: string) {
  return authHttp.get<{ customer: CustomerDetail }>(`/customers/${customerId}`);
}

export function createCustomerRecord(input: CreateCustomerInput) {
  return authHttp.post<{ customer: SafeCustomer; matchedByPhone: SafeCustomer[] }>("/customers", input);
}

export function updateCustomerRecord(customerId: string, input: UpdateCustomerInput) {
  return authHttp.patch<{ customer: SafeCustomer }>(`/customers/${customerId}`, input);
}
