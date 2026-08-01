import { endpoints } from "./endpoints";
import { authHttp } from "./http";
import type { CreateStaffInput, SafeStaff, UpdateStaffInput } from "../types/staff";

export type ListStaffQuery = { search?: string; isActive?: boolean };

function buildQuery(query?: ListStaffQuery): string {
  if (!query) return "";
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.isActive !== undefined) params.set("isActive", String(query.isActive));
  const built = params.toString();
  return built ? `?${built}` : "";
}

export function listStaff(query?: ListStaffQuery) {
  return authHttp.get<{ staff: SafeStaff[] }>(`${endpoints.staff.list}${buildQuery(query)}`);
}

export function getStaffMember(staffId: string) {
  return authHttp.get<{ staff: SafeStaff }>(endpoints.staff.detail(staffId));
}

export function createStaff(input: CreateStaffInput) {
  return authHttp.post<{ staff: SafeStaff }>(endpoints.staff.list, input);
}

export function updateStaff(staffId: string, input: UpdateStaffInput) {
  return authHttp.patch<{ staff: SafeStaff }>(endpoints.staff.detail(staffId), input);
}

export function updateStaffStatus(staffId: string, isActive: boolean) {
  return authHttp.patch<{ staff: SafeStaff }>(endpoints.staff.status(staffId), { isActive });
}

export function updateStaffPassword(staffId: string, password: string) {
  return authHttp.patch<{ staff: SafeStaff }>(endpoints.staff.password(staffId), { password });
}
