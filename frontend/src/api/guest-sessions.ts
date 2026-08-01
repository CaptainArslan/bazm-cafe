import { endpoints } from "./endpoints";
import { http } from "./http";
import type { CustomerType } from "../types/enums";
import type { ResolvedTable, SafeGuestSession } from "../types/session";

export function resolveTable(tableToken: string) {
  return http.post<{ table: ResolvedTable }>(endpoints.guestSessions.resolveTable, { tableToken });
}

export function createGuestSession(input: { orderType: CustomerType; tableToken?: string }) {
  return http.post<{ session: SafeGuestSession; reclaimed: boolean }>(
    endpoints.guestSessions.create,
    input,
  );
}

export function getCurrentGuestSession() {
  return http.get<{ session: SafeGuestSession }>(endpoints.guestSessions.current);
}

export function closeGuestSession() {
  return http.post<{ session: SafeGuestSession; receiptAccessExpiresAt: string | null }>(
    endpoints.guestSessions.close,
  );
}

export function recoverGuestSession(recoveryCode: string) {
  return http.post<{ session: SafeGuestSession }>(endpoints.guestSessions.recover, {
    recoveryCode,
  });
}
