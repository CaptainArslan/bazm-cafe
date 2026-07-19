import { prisma } from "../../config/database.js";
import type { Prisma } from "../../generated/prisma/client.js";
import {
  CustomerType,
  GuestSessionClosureType,
} from "../../generated/prisma/enums.js";

const sessionSelect = {
  id: true,
  uuid: true,
  tokenHash: true,
  orderType: true,
  restaurantTableId: true,
  customerId: true,
  lastActivityAt: true,
  expiresAt: true,
  closedAt: true,
  closureType: true,
  closedByUserId: true,
  closureReason: true,
  createdAt: true,
  updatedAt: true,
  restaurantTable: {
    select: {
      uuid: true,
      tableNumber: true,
    },
  },
  customer: {
    select: {
      uuid: true,
    },
  },
} as const;

const sessionOrdersSelect = {
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
} as const;

export type GuestSessionRecord = Prisma.GuestSessionGetPayload<{
  select: typeof sessionSelect;
}>;

function client(tx?: Prisma.TransactionClient) {
  return tx ?? prisma;
}

export function findGuestSessionByTokenHash(tokenHash: string) {
  return prisma.guestSession.findUnique({
    where: { tokenHash },
    select: sessionSelect,
  });
}

export function findGuestSessionByUuid(uuid: string) {
  return prisma.guestSession.findUnique({
    where: { uuid },
    select: sessionSelect,
  });
}

export function findGuestSessionById(
  sessionId: bigint,
  tx?: Prisma.TransactionClient,
) {
  return client(tx).guestSession.findUnique({
    where: { id: sessionId },
    select: {
      ...sessionSelect,
      orders: {
        where: { deletedAt: null },
        select: sessionOrdersSelect,
      },
    },
  });
}

export function createGuestSession(
  data: {
    tokenHash: string;
    orderType: CustomerType;
    restaurantTableId?: bigint;
    customerId?: bigint;
    lastActivityAt: Date;
    expiresAt: Date;
  },
  tx?: Prisma.TransactionClient,
) {
  return client(tx).guestSession.create({
    data,
    select: sessionSelect,
  });
}

export function touchGuestSession(
  sessionId: bigint,
  lastActivityAt: Date,
  tx?: Prisma.TransactionClient,
) {
  return client(tx).guestSession.update({
    where: { id: sessionId },
    data: { lastActivityAt },
    select: sessionSelect,
  });
}

export function closeGuestSession(
  sessionId: bigint,
  data: {
    closureType: GuestSessionClosureType;
    closedByUserId?: bigint | null;
    closureReason?: string | null;
    closedAt?: Date;
  },
  tx?: Prisma.TransactionClient,
) {
  return client(tx).guestSession.update({
    where: { id: sessionId },
    data: {
      closedAt: data.closedAt ?? new Date(),
      closureType: data.closureType,
      closedByUserId: data.closedByUserId ?? null,
      closureReason: data.closureReason ?? null,
    },
    select: sessionSelect,
  });
}

export function closeGuestSessionIfOpen(sessionId: bigint) {
  return prisma.guestSession.updateMany({
    where: {
      id: sessionId,
      closedAt: null,
    },
    data: {
      closedAt: new Date(),
      closureType: GuestSessionClosureType.CLOSED,
    },
  });
}

export function clearTableActiveSession(
  sessionId: bigint,
  tx?: Prisma.TransactionClient,
) {
  return client(tx).restaurantTable.updateMany({
    where: { activeGuestSessionId: sessionId },
    data: { activeGuestSessionId: null },
  });
}

export function findOpenSessionOnTable(
  tableId: bigint,
  tx?: Prisma.TransactionClient,
) {
  return client(tx).guestSession.findFirst({
    where: {
      restaurantTableId: tableId,
      closedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: sessionSelect,
    orderBy: { createdAt: "desc" },
  });
}

export function setTableActiveSession(
  tableId: bigint,
  sessionId: bigint,
  tx?: Prisma.TransactionClient,
) {
  return client(tx).restaurantTable.update({
    where: { id: tableId },
    data: { activeGuestSessionId: sessionId },
    select: {
      id: true,
      uuid: true,
      activeGuestSessionId: true,
    },
  });
}

export function lockRestaurantTableForUpdate(
  tableId: bigint,
  tx: Prisma.TransactionClient,
) {
  return tx.$queryRaw<
    Array<{ id: bigint; active_guest_session_id: bigint | null }>
  >`
    SELECT id, active_guest_session_id
    FROM restaurant_tables
    WHERE id = ${tableId}
    FOR UPDATE
  `;
}

export function findEmptyInactiveSessions(cutoff: Date) {
  return prisma.guestSession.findMany({
    where: {
      closedAt: null,
      lastActivityAt: { lt: cutoff },
      orders: { none: { deletedAt: null } },
    },
    select: sessionSelect,
  });
}
