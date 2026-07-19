import type { Prisma } from "../../generated/prisma/client.js";
import { GuestSessionClosureType } from "../../generated/prisma/enums.js";
import { generateOpaqueToken, hashOpaqueToken } from "../auth/token.service.js";
import {
  isSessionSafelyCloseable,
  RECEIPT_ACCESS_TTL_HOURS,
  type SessionOrderSnapshot,
} from "./session-lifecycle.js";

async function loadSessionOrders(
  tx: Prisma.TransactionClient,
  guestSessionId: bigint,
): Promise<SessionOrderSnapshot[]> {
  return tx.order.findMany({
    where: { guestSessionId, deletedAt: null },
    select: {
      status: true,
      paymentStatus: true,
      totalAmount: true,
      payments: {
        select: {
          amount: true,
          status: true,
          voidedAt: true,
        },
      },
    },
  });
}

export async function closeGuestSessionIfSafeInTx(
  tx: Prisma.TransactionClient,
  guestSessionId: bigint,
  options: {
    closureType: GuestSessionClosureType;
    closedByUserId?: bigint | null;
    reason?: string | null;
    force?: boolean;
  },
): Promise<{ closed: boolean; receiptRawToken: string | null }> {
  const session = await tx.guestSession.findUniqueOrThrow({
    where: { id: guestSessionId },
  });

  if (session.closedAt !== null) {
    return { closed: false, receiptRawToken: null };
  }

  const orders = await loadSessionOrders(tx, guestSessionId);

  if (options.force !== true && !isSessionSafelyCloseable(orders)) {
    return { closed: false, receiptRawToken: null };
  }

  const now = new Date();

  await tx.guestSession.update({
    where: { id: guestSessionId },
    data: {
      closedAt: now,
      closureType: options.closureType,
      closedByUserId: options.closedByUserId ?? null,
      closureReason: options.reason ?? null,
    },
  });

  await tx.restaurantTable.updateMany({
    where: { activeGuestSessionId: guestSessionId },
    data: { activeGuestSessionId: null },
  });

  const receiptRawToken = generateOpaqueToken();

  await tx.receiptAccessToken.create({
    data: {
      tokenHash: hashOpaqueToken(receiptRawToken),
      guestSessionId,
      expiresAt: new Date(
        now.getTime() + RECEIPT_ACCESS_TTL_HOURS * 60 * 60 * 1000,
      ),
    },
  });

  return { closed: true, receiptRawToken };
}
