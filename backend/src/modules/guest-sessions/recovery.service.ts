import { randomBytes } from "node:crypto";

import { prisma } from "../../config/database.js";
import { HTTP_STATUS } from "../../constants/http-status.js";
import { AppError } from "../../errors/app-error.js";
import { AUDIT_ACTIONS, writeAuditLog } from "../audit/audit.service.js";
import {
  generateOpaqueToken,
  hashOpaqueToken,
} from "../auth/token.service.js";
import { GUEST_SESSION_MESSAGES } from "./guest-session.constants.js";
import { findGuestSessionByUuid } from "./guest-session.repository.js";
import type { SafeGuestSession } from "./guest-session.types.js";
import { RECOVERY_CODE_TTL_MINUTES } from "./session-lifecycle.js";

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRecoveryCode(): string {
  const bytes = randomBytes(8);
  let code = "";

  for (let index = 0; index < 8; index += 1) {
    code += RECOVERY_ALPHABET[bytes[index]! % RECOVERY_ALPHABET.length]!;
  }

  return code;
}

function isSessionActive(session: {
  closedAt: Date | null;
  expiresAt: Date;
}): boolean {
  return session.closedAt === null && session.expiresAt > new Date();
}

function toSafeGuestSession(session: {
  uuid: string;
  orderType: SafeGuestSession["orderType"];
  expiresAt: Date;
  lastActivityAt: Date;
  closedAt: Date | null;
  restaurantTable: { uuid: string; tableNumber: string } | null;
  customer: { uuid: string } | null;
}): SafeGuestSession {
  return {
    id: session.uuid,
    orderType: session.orderType,
    tableId: session.restaurantTable?.uuid ?? null,
    tableNumber: session.restaurantTable?.tableNumber ?? null,
    customerId: session.customer?.uuid ?? null,
    expiresAt: session.expiresAt,
    lastActivityAt: session.lastActivityAt,
    closedAt: session.closedAt,
    isActive: isSessionActive(session),
  };
}

export async function createRecoveryCodeRecord(
  sessionId: string,
  generatedByUserId: bigint,
): Promise<{ recoveryCode: string; expiresAt: Date }> {
  const session = await findGuestSessionByUuid(sessionId);

  if (session === null) {
    throw new AppError(
      GUEST_SESSION_MESSAGES.INVALID,
      HTTP_STATUS.NOT_FOUND,
      "GUEST_SESSION_NOT_FOUND",
    );
  }

  if (!isSessionActive(session)) {
    throw new AppError(
      GUEST_SESSION_MESSAGES.RECOVERY_SESSION_INACTIVE,
      HTTP_STATUS.CONFLICT,
      "GUEST_SESSION_INACTIVE",
    );
  }

  const recoveryCode = generateRecoveryCode();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + RECOVERY_CODE_TTL_MINUTES * 60 * 1000,
  );

  await prisma.$transaction(async (tx) => {
    await tx.guestSessionRecoveryCode.updateMany({
      where: {
        guestSessionId: session.id,
        usedAt: null,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    await tx.guestSessionRecoveryCode.create({
      data: {
        guestSessionId: session.id,
        codeHash: hashOpaqueToken(recoveryCode.toUpperCase()),
        generatedByUserId,
        expiresAt,
      },
    });

    await writeAuditLog({
      tx,
      action: AUDIT_ACTIONS.RECOVERY_CODE_GENERATED,
      actorUserId: generatedByUserId,
      actorGuestSessionId: session.id,
      entityType: "guest_session",
      entityId: session.uuid,
      newValues: {
        expiresAt: expiresAt.toISOString(),
      },
    });
  });

  return { recoveryCode, expiresAt };
}

export async function redeemRecoveryCodeRecord(
  recoveryCode: string,
): Promise<{ rawToken: string; session: SafeGuestSession }> {
  const codeHash = hashOpaqueToken(recoveryCode.trim().toUpperCase());
  const rawToken = generateOpaqueToken();
  const tokenHash = hashOpaqueToken(rawToken);

  const session = await prisma.$transaction(async (tx) => {
    const record = await tx.guestSessionRecoveryCode.findFirst({
      where: {
        codeHash,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (record === null) {
      throw new AppError(
        GUEST_SESSION_MESSAGES.RECOVERY_CODE_INVALID,
        HTTP_STATUS.UNAUTHORIZED,
        "RECOVERY_CODE_INVALID",
      );
    }

    const guestSession = await tx.guestSession.findUniqueOrThrow({
      where: { id: record.guestSessionId },
      select: {
        id: true,
        uuid: true,
        orderType: true,
        expiresAt: true,
        lastActivityAt: true,
        closedAt: true,
        restaurantTable: {
          select: { uuid: true, tableNumber: true },
        },
        customer: {
          select: { uuid: true },
        },
      },
    });

    if (!isSessionActive(guestSession)) {
      throw new AppError(
        GUEST_SESSION_MESSAGES.RECOVERY_SESSION_INACTIVE,
        HTTP_STATUS.CONFLICT,
        "GUEST_SESSION_INACTIVE",
      );
    }

    await tx.guestSessionRecoveryCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    const updated = await tx.guestSession.update({
      where: { id: guestSession.id },
      data: {
        tokenHash,
        lastActivityAt: new Date(),
      },
      select: {
        uuid: true,
        orderType: true,
        expiresAt: true,
        lastActivityAt: true,
        closedAt: true,
        restaurantTable: {
          select: { uuid: true, tableNumber: true },
        },
        customer: {
          select: { uuid: true },
        },
      },
    });

    await writeAuditLog({
      tx,
      action: AUDIT_ACTIONS.RECOVERY_CODE_REDEEMED,
      actorGuestSessionId: guestSession.id,
      entityType: "guest_session",
      entityId: guestSession.uuid,
    });

    return updated;
  });

  return {
    rawToken,
    session: toSafeGuestSession(session),
  };
}
