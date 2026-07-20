import { authHttp } from "./http";
import type { SafeCustomer } from "../types/customer";

export type SearchCustomersQuery = { search?: string; phone?: string };

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
