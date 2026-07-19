import { env } from "../../config/environment.js";
import { HTTP_STATUS } from "../../constants/http-status.js";
import { AppError } from "../../errors/app-error.js";
import { prisma } from "../../config/database.js";
import {
  CustomerType,
  GuestSessionClosureType,
} from "../../generated/prisma/enums.js";
import {
  publishGuestSessionClosed,
  publishTableOccupied,
  publishTableReleased,
} from "../../realtime/realtime.publisher.js";
import { toMoneyString } from "../../utils/money.js";
import {
  generateOpaqueToken,
  hashOpaqueToken,
} from "../auth/token.service.js";
import { findTableByQrTokenHash } from "../tables/table.repository.js";
import { GUEST_SESSION_MESSAGES } from "./guest-session.constants.js";
import {
  createGuestSession,
  findGuestSessionById,
  findGuestSessionByTokenHash,
  lockRestaurantTableForUpdate,
  setTableActiveSession,
  touchGuestSession,
} from "./guest-session.repository.js";
import type {
  GuestSessionContext,
  SafeGuestSession,
} from "./guest-session.types.js";
import type { CreateGuestSessionInput } from "./guest-session.validation.js";
import { closeGuestSessionIfSafeInTx } from "./session-close.js";
import {
  formatOutstanding,
  isSessionSafelyCloseable,
  RECEIPT_ACCESS_TTL_HOURS,
} from "./session-lifecycle.js";

function isSessionActive(session: {
  closedAt: Date | null;
  expiresAt: Date;
}): boolean {
  if (session.closedAt !== null) {
    return false;
  }

  return session.expiresAt > new Date();
}

function toSafeGuestSession(
  session: {
    uuid: string;
    orderType: CustomerType;
    expiresAt: Date;
    lastActivityAt: Date;
    closedAt: Date | null;
    restaurantTable: { uuid: string; tableNumber: string } | null;
    customer: { uuid: string } | null;
  },
  extras?: { outstandingBalance?: string; orderCount?: number },
): SafeGuestSession {
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
    ...(extras?.outstandingBalance !== undefined && {
      outstandingBalance: extras.outstandingBalance,
    }),
    ...(extras?.orderCount !== undefined && {
      orderCount: extras.orderCount,
    }),
  };
}

function toGuestContext(session: {
  id: bigint;
  uuid: string;
  orderType: CustomerType;
  restaurantTableId: bigint | null;
  customerId: bigint | null;
  expiresAt: Date;
  closedAt: Date | null;
}): GuestSessionContext {
  return {
    databaseId: session.id,
    id: session.uuid,
    orderType: session.orderType,
    restaurantTableDatabaseId: session.restaurantTableId,
    customerDatabaseId: session.customerId,
    expiresAt: session.expiresAt,
    closedAt: session.closedAt,
  };
}

export async function resolveTableToken(tableToken: string) {
  const table = await findTableByQrTokenHash(hashOpaqueToken(tableToken));

  if (table === null) {
    throw new AppError(
      GUEST_SESSION_MESSAGES.TABLE_INVALID,
      HTTP_STATUS.NOT_FOUND,
      "TABLE_QR_INVALID",
    );
  }

  return {
    id: table.uuid,
    tableNumber: table.tableNumber,
    name: table.name,
    capacity: table.capacity,
  };
}

export async function createGuestSessionRecord(
  input: CreateGuestSessionInput,
  existingRawToken?: string,
): Promise<{
  rawToken: string;
  session: SafeGuestSession;
  reclaimed: boolean;
}> {
  if (input.orderType === CustomerType.TAKEAWAY) {
    const rawToken = generateOpaqueToken();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + env.GUEST_SESSION_EXPIRES_HOURS * 60 * 60 * 1000,
    );

    const session = await createGuestSession({
      tokenHash: hashOpaqueToken(rawToken),
      orderType: input.orderType,
      lastActivityAt: now,
      expiresAt,
    });

    return {
      rawToken,
      session: toSafeGuestSession(session),
      reclaimed: false,
    };
  }

  if (input.tableToken === undefined) {
    throw new AppError(
      GUEST_SESSION_MESSAGES.TABLE_REQUIRED,
      HTTP_STATUS.BAD_REQUEST,
      "TABLE_TOKEN_REQUIRED",
    );
  }

  const table = await findTableByQrTokenHash(hashOpaqueToken(input.tableToken));

  if (table === null) {
    throw new AppError(
      GUEST_SESSION_MESSAGES.TABLE_INVALID,
      HTTP_STATUS.NOT_FOUND,
      "TABLE_QR_INVALID",
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const lockedRows = await lockRestaurantTableForUpdate(table.id, tx);
    const locked = lockedRows[0];

    if (locked === undefined) {
      throw new AppError(
        GUEST_SESSION_MESSAGES.TABLE_INVALID,
        HTTP_STATUS.NOT_FOUND,
        "TABLE_QR_INVALID",
      );
    }

    if (locked.active_guest_session_id !== null) {
      const activeSession = await findGuestSessionById(
        locked.active_guest_session_id,
        tx,
      );

      if (activeSession !== null && isSessionActive(activeSession)) {
        if (
          existingRawToken !== undefined &&
          existingRawToken.length > 0 &&
          hashOpaqueToken(existingRawToken) === activeSession.tokenHash
        ) {
          const touched = await touchGuestSession(
            activeSession.id,
            new Date(),
            tx,
          );

          return {
            rawToken: existingRawToken,
            session: touched,
            reclaimed: true as const,
            tableUuid: table.uuid,
            tableNumber: table.tableNumber,
            occupied: false as const,
          };
        }

        throw new AppError(
          GUEST_SESSION_MESSAGES.TABLE_SESSION_ALREADY_ACTIVE,
          HTTP_STATUS.CONFLICT,
          "TABLE_SESSION_ALREADY_ACTIVE",
        );
      }
    }

    const rawToken = generateOpaqueToken();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + env.GUEST_SESSION_EXPIRES_HOURS * 60 * 60 * 1000,
    );

    const session = await createGuestSession(
      {
        tokenHash: hashOpaqueToken(rawToken),
        orderType: CustomerType.DINE_IN,
        restaurantTableId: table.id,
        lastActivityAt: now,
        expiresAt,
      },
      tx,
    );

    await setTableActiveSession(table.id, session.id, tx);

    return {
      rawToken,
      session,
      reclaimed: false as const,
      tableUuid: table.uuid,
      tableNumber: table.tableNumber,
      occupied: true as const,
    };
  });

  if (result.occupied) {
    publishTableOccupied({
      tableId: result.tableUuid,
      tableNumber: result.tableNumber,
      guestSessionId: result.session.uuid,
      changedAt: new Date().toISOString(),
    });
  }

  return {
    rawToken: result.rawToken,
    session: toSafeGuestSession(result.session),
    reclaimed: result.reclaimed,
  };
}

export async function getGuestSessionFromRawToken(
  rawToken: string,
): Promise<{ session: SafeGuestSession; context: GuestSessionContext }> {
  const session = await findGuestSessionByTokenHash(hashOpaqueToken(rawToken));

  if (session === null) {
    throw new AppError(
      GUEST_SESSION_MESSAGES.INVALID,
      HTTP_STATUS.UNAUTHORIZED,
      "GUEST_SESSION_INVALID",
    );
  }

  if (!isSessionActive(session)) {
    throw new AppError(
      session.closedAt !== null
        ? GUEST_SESSION_MESSAGES.CLOSED
        : GUEST_SESSION_MESSAGES.INVALID,
      HTTP_STATUS.UNAUTHORIZED,
      "GUEST_SESSION_INACTIVE",
    );
  }

  const touched = await touchGuestSession(session.id, new Date());

  return {
    session: toSafeGuestSession(touched),
    context: toGuestContext(touched),
  };
}

export async function getCurrentGuestSessionRecord(
  rawToken: string,
): Promise<SafeGuestSession> {
  const { session, context } = await getGuestSessionFromRawToken(rawToken);
  const withOrders = await findGuestSessionById(context.databaseId);
  const orders = withOrders?.orders ?? [];

  return {
    ...session,
    outstandingBalance: formatOutstanding(orders),
    orderCount: orders.length,
  };
}

export async function closeGuestSessionRecord(rawToken: string): Promise<{
  session: SafeGuestSession;
  receiptRawToken: string;
  receiptAccessExpiresAt: Date;
}> {
  const session = await findGuestSessionByTokenHash(hashOpaqueToken(rawToken));

  if (session === null) {
    throw new AppError(
      GUEST_SESSION_MESSAGES.INVALID,
      HTTP_STATUS.UNAUTHORIZED,
      "GUEST_SESSION_INVALID",
    );
  }

  if (session.closedAt !== null) {
    throw new AppError(
      GUEST_SESSION_MESSAGES.CLOSED,
      HTTP_STATUS.CONFLICT,
      "GUEST_SESSION_CLOSED",
    );
  }

  const withOrders = await findGuestSessionById(session.id);
  const orders = withOrders?.orders ?? [];

  if (!isSessionSafelyCloseable(orders)) {
    throw new AppError(
      GUEST_SESSION_MESSAGES.SESSION_NOT_RELEASABLE,
      HTTP_STATUS.CONFLICT,
      "SESSION_NOT_RELEASABLE",
    );
  }

  const closeResult = await prisma.$transaction(async (tx) => {
    return closeGuestSessionIfSafeInTx(tx, session.id, {
      closureType: GuestSessionClosureType.CLOSED,
    });
  });

  if (!closeResult.closed || closeResult.receiptRawToken === null) {
    throw new AppError(
      GUEST_SESSION_MESSAGES.SESSION_NOT_RELEASABLE,
      HTTP_STATUS.CONFLICT,
      "SESSION_NOT_RELEASABLE",
    );
  }

  const closed = await findGuestSessionById(session.id);
  const receiptAccessExpiresAt = new Date(
    Date.now() + RECEIPT_ACCESS_TTL_HOURS * 60 * 60 * 1000,
  );

  publishGuestSessionClosed({
    guestSessionId: session.uuid,
    closureType: GuestSessionClosureType.CLOSED,
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

  return {
    session: toSafeGuestSession(closed ?? session, {
      outstandingBalance: toMoneyString(0),
      orderCount: orders.length,
    }),
    receiptRawToken: closeResult.receiptRawToken,
    receiptAccessExpiresAt,
  };
}
