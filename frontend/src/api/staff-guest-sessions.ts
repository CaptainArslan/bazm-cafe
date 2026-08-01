import { endpoints } from "./endpoints";
import { authHttp } from "./http";

export function generateRecoveryCode(sessionId: string) {
  return authHttp.post<{ recoveryCode: string; expiresAt: string }>(
    endpoints.guestSessions.recoveryCodes(sessionId),
  );
}
