import { GuestSessionClosureType } from "../generated/prisma/enums.js";
import { prisma } from "../config/database.js";
import {
  publishGuestSessionExpired,
  publishTableReleased,
} from "../realtime/realtime.publisher.js";
import { AUDIT_ACTIONS, writeAuditLog } from "../modules/audit/audit.service.js";
import { findEmptyInactiveSessions } from "../modules/guest-sessions/guest-session.repository.js";
import { closeGuestSessionIfSafeInTx } from "../modules/guest-sessions/session-close.js";
import { EMPTY_SESSION_INACTIVITY_MINUTES } from "../modules/guest-sessions/session-lifecycle.js";

const INTERVAL_MS = 60_000;

async function expireEmptySessions(): Promise<void> {
  const cutoff = new Date(
    Date.now() - EMPTY_SESSION_INACTIVITY_MINUTES * 60 * 1000,
  );

  const sessions = await findEmptyInactiveSessions(cutoff);

  for (const session of sessions) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        return closeGuestSessionIfSafeInTx(tx, session.id, {
          closureType: GuestSessionClosureType.EXPIRED,
          reason: "Empty session inactive beyond inactivity window.",
        });
      });

      if (!result.closed) {
        continue;
      }

      await writeAuditLog({
        action: AUDIT_ACTIONS.GUEST_SESSION_EXPIRED,
        actorGuestSessionId: session.id,
        entityType: "guest_session",
        entityId: session.uuid,
        reason: "Empty session inactive beyond inactivity window.",
      });

      publishGuestSessionExpired({
        guestSessionId: session.uuid,
        closureType: GuestSessionClosureType.EXPIRED,
        tableId: session.restaurantTable?.uuid,
        changedAt: new Date().toISOString(),
      });

      if (session.restaurantTable) {
        publishTableReleased({
          tableId: session.restaurantTable.uuid,
          tableNumber: session.restaurantTable.tableNumber,
          guestSessionId: session.uuid,
          changedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error(
        `Failed to expire empty guest session ${session.uuid}:`,
        error,
      );
    }
  }
}

export function startEmptySessionExpiryJob(): NodeJS.Timeout {
  void expireEmptySessions();

  return setInterval(() => {
    void expireEmptySessions();
  }, INTERVAL_MS);
}
