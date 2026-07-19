import { http } from "./http";
import type { CustomerType } from "../types/enums";
import type { ResolvedTable, SafeGuestSession } from "../types/session";

export function resolveTable(tableToken: string) {
  return http.post<{ table: ResolvedTable }>("/guest/tables/resolve", { tableToken });
}

export function createGuestSession(input: { orderType: CustomerType; tableToken?: string }) {
  return http.post<{ session: SafeGuestSession; reclaimed: boolean }>(
    "/guest/sessions",
    input,
  );
}

export function getCurrentGuestSession() {
  return http.get<{ session: SafeGuestSession }>("/guest/sessions/current");
}

export function closeGuestSession() {
  return http.post<{ session: SafeGuestSession; receiptAccessExpiresAt: string | null }>(
    "/guest/sessions/close",
  );
}

export function recoverGuestSession(recoveryCode: string) {
  return http.post<{ session: SafeGuestSession }>("/guest/sessions/recover", {
    recoveryCode,
  });
}
