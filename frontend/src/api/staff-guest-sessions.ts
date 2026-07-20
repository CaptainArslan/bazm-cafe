import { authHttp } from "./http";

export function generateRecoveryCode(sessionId: string) {
  return authHttp.post<{ recoveryCode: string; expiresAt: string }>(
    `/guest-sessions/${sessionId}/recovery-codes`,
  );
}
