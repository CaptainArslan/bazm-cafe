import { randomUUID } from "node:crypto";

import { env } from "../../config/environment.js";
import { prisma } from "../../config/database.js";
import { HTTP_STATUS } from "../../constants/http-status.js";
import { AppError } from "../../errors/app-error.js";
import {
  GuestSessionClosureType,
  TableOperationalStatus,
} from "../../generated/prisma/enums.js";
import {
  publishGuestSessionClosed,
  publishGuestSessionForceClosed,
  publishTableReleased,
} from "../../realtime/realtime.publisher.js";
import { generateTableQrImage } from "../../utils/qr-code.js";
import { deletePublicFile } from "../../utils/storage.js";
import { AUDIT_ACTIONS, writeAuditLog } from "../audit/audit.service.js";
import {
  generateOpaqueToken,
  hashOpaqueToken,
} from "../auth/token.service.js";
import { GUEST_SESSION_MESSAGES } from "../guest-sessions/guest-session.constants.js";
import { findGuestSessionById } from "../guest-sessions/guest-session.repository.js";
import { closeGuestSessionIfSafeInTx } from "../guest-sessions/session-close.js";
import { RECEIPT_ACCESS_TTL_HOURS } from "../guest-sessions/session-lifecycle.js";
import { TABLE_MESSAGES } from "./table.constants.js";
import {
  createTableRecord,
  findTableByNumber,
  findTableByUuid,
  listTables,
  updateTableRecord,
} from "./table.repository.js";
import type { SafeTable, TableApiStatus } from "./table.types.js";
import type {
  CreateTableInput,
  ForceReleaseTableInput,
  UpdateTableInput,
  UpdateTableStatusInput,
} from "./table.validation.js";

function toQrImageUrl(qrImagePath: string | null): string | null {
  if (qrImagePath === null) {
    return null;
  }

  return `${env.APP_URL}${qrImagePath}`;
}

function deriveStatus(options: {
  operationalStatus: TableOperationalStatus;
  isActive: boolean;
  isOccupied: boolean;
}): TableApiStatus {
  if (
    !options.isActive ||
    options.operationalStatus === TableOperationalStatus.OUT_OF_SERVICE
  ) {
    return "OUT_OF_SERVICE";
  }

  if (options.isOccupied) {
    return "OCCUPIED";
  }

  return "AVAILABLE";
}

function toSafeTable(
  table: {
    uuid: string;
    tableNumber: string;
    name: string | null;
    capacity: number;
    operationalStatus: TableOperationalStatus;
    isActive: boolean;
    qrVersion: number;
    qrImagePath: string | null;
    qrGeneratedAt: Date;
    qrRegeneratedAt: Date | null;
    activeGuestSessionId?: bigint | null;
    createdAt: Date;
    updatedAt: Date;
  },
  isOccupied?: boolean,
): SafeTable {
  const occupied =
    isOccupied ??
    (table.activeGuestSessionId !== undefined &&
      table.activeGuestSessionId !== null);

  return {
    id: table.uuid,
    tableNumber: table.tableNumber,
    name: table.name,
    capacity: table.capacity,
    operationalStatus: table.operationalStatus,
    status: deriveStatus({
      operationalStatus: table.operationalStatus,
      isActive: table.isActive,
      isOccupied: occupied,
    }),
    isActive: table.isActive,
    qrVersion: table.qrVersion,
    qrImagePath: table.qrImagePath,
    qrImageUrl: toQrImageUrl(table.qrImagePath),
    qrGeneratedAt: table.qrGeneratedAt,
    qrRegeneratedAt: table.qrRegeneratedAt,
    createdAt: table.createdAt,
    updatedAt: table.updatedAt,
  };
}

export async function listTableRecords(): Promise<SafeTable[]> {
  const tables = await listTables();
  return tables.map((table) => toSafeTable(table));
}

export async function getTableRecord(tableId: string): Promise<SafeTable> {
  const table = await findTableByUuid(tableId);

  if (table === null) {
    throw new AppError(
      TABLE_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "TABLE_NOT_FOUND",
    );
  }

  return toSafeTable(table);
}

export async function createTableRecordService(
  input: CreateTableInput,
): Promise<SafeTable> {
  const existing = await findTableByNumber(input.tableNumber);

  if (existing !== null) {
    throw new AppError(
      TABLE_MESSAGES.NUMBER_EXISTS,
      HTTP_STATUS.CONFLICT,
      "TABLE_NUMBER_EXISTS",
    );
  }

  const tableUuid = randomUUID();
  const rawToken = generateOpaqueToken();
  const tokenHash = hashOpaqueToken(rawToken);
  const qrImagePath = await generateTableQrImage({
    tableUuid,
    qrVersion: 1,
    rawToken,
  });

  const table = await createTableRecord({
    uuid: tableUuid,
    tableNumber: input.tableNumber,
    name: input.name ?? null,
    capacity: input.capacity,
    qrTokenHash: tokenHash,
    qrImagePath,
  });

  return toSafeTable(table, false);
}

export async function updateTableRecordService(
  tableId: string,
  input: UpdateTableInput,
): Promise<SafeTable> {
  const table = await findTableByUuid(tableId);

  if (table === null) {
    throw new AppError(
      TABLE_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "TABLE_NOT_FOUND",
    );
  }

  if (
    input.tableNumber !== undefined &&
    input.tableNumber !== table.tableNumber
  ) {
    const existing = await findTableByNumber(input.tableNumber);

    if (existing !== null) {
      throw new AppError(
        TABLE_MESSAGES.NUMBER_EXISTS,
        HTTP_STATUS.CONFLICT,
        "TABLE_NUMBER_EXISTS",
      );
    }
  }

  const updated = await updateTableRecord(table.id, {
    ...(input.tableNumber !== undefined && { tableNumber: input.tableNumber }),
    ...(input.name !== undefined && { name: input.name }),
    ...(input.capacity !== undefined && { capacity: input.capacity }),
  });

  return toSafeTable(updated);
}

export async function updateTableStatusService(
  tableId: string,
  input: UpdateTableStatusInput,
): Promise<SafeTable> {
  const table = await findTableByUuid(tableId);

  if (table === null) {
    throw new AppError(
      TABLE_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "TABLE_NOT_FOUND",
    );
  }

  const updated = await updateTableRecord(table.id, {
    operationalStatus: input.operationalStatus as never,
    ...(input.isActive !== undefined && { isActive: input.isActive }),
    ...(input.operationalStatus === "OUT_OF_SERVICE" && {
      isActive: input.isActive ?? false,
    }),
    ...(input.operationalStatus === "AVAILABLE" && {
      isActive: input.isActive ?? true,
    }),
  });

  return toSafeTable(updated);
}

export async function getTableQrCodeService(tableId: string) {
  const table = await getTableRecord(tableId);

  return {
    tableId: table.id,
    tableNumber: table.tableNumber,
    qrVersion: table.qrVersion,
    qrImagePath: table.qrImagePath,
    qrImageUrl: table.qrImageUrl,
    qrGeneratedAt: table.qrGeneratedAt,
    qrRegeneratedAt: table.qrRegeneratedAt,
  };
}

export async function regenerateTableQrCodeService(
  tableId: string,
): Promise<SafeTable> {
  const table = await findTableByUuid(tableId);

  if (table === null) {
    throw new AppError(
      TABLE_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "TABLE_NOT_FOUND",
    );
  }

  const rawToken = generateOpaqueToken();
  const tokenHash = hashOpaqueToken(rawToken);
  const nextVersion = table.qrVersion + 1;
  const qrImagePath = await generateTableQrImage({
    tableUuid: table.uuid,
    qrVersion: nextVersion,
    rawToken,
  });

  await deletePublicFile(table.qrImagePath);

  const updated = await updateTableRecord(table.id, {
    qrTokenHash: tokenHash,
    qrVersion: nextVersion,
    qrImagePath,
    qrRegeneratedAt: new Date(),
  });

  await writeAuditLog({
    action: AUDIT_ACTIONS.QR_REGENERATED,
    entityType: "restaurant_table",
    entityId: table.uuid,
    previousValues: { qrVersion: table.qrVersion },
    newValues: { qrVersion: nextVersion },
  });

  return toSafeTable(updated);
}

export async function releaseTableSession(
  tableId: string,
  actorUserId: bigint,
): Promise<{
  table: SafeTable;
  receiptRawToken: string;
  receiptAccessExpiresAt: Date;
}> {
  const table = await findTableByUuid(tableId);

  if (table === null) {
    throw new AppError(
      TABLE_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "TABLE_NOT_FOUND",
    );
  }

  if (table.activeGuestSessionId === null) {
    throw new AppError(
      TABLE_MESSAGES.NO_ACTIVE_SESSION,
      HTTP_STATUS.CONFLICT,
      "TABLE_NO_ACTIVE_SESSION",
    );
  }

  const session = await findGuestSessionById(table.activeGuestSessionId);

  if (session === null || session.closedAt !== null) {
    throw new AppError(
      TABLE_MESSAGES.NO_ACTIVE_SESSION,
      HTTP_STATUS.CONFLICT,
      "TABLE_NO_ACTIVE_SESSION",
    );
  }

  const closeResult = await prisma.$transaction(async (tx) => {
    const result = await closeGuestSessionIfSafeInTx(
      tx,
      table.activeGuestSessionId!,
      {
        closureType: GuestSessionClosureType.CLOSED,
        closedByUserId: actorUserId,
        reason: "Released by staff.",
      },
    );

    if (!result.closed || result.receiptRawToken === null) {
      throw new AppError(
        GUEST_SESSION_MESSAGES.SESSION_NOT_RELEASABLE,
        HTTP_STATUS.CONFLICT,
        "SESSION_NOT_RELEASABLE",
      );
    }

    await writeAuditLog({
      tx,
      action: AUDIT_ACTIONS.TABLE_RELEASED,
      actorUserId,
      actorGuestSessionId: session.id,
      entityType: "restaurant_table",
      entityId: table.uuid,
      reason: "Released by staff.",
    });

    return result;
  });

  const refreshed = await findTableByUuid(tableId);

  publishGuestSessionClosed({
    guestSessionId: session.uuid,
    closureType: GuestSessionClosureType.CLOSED,
    tableId: table.uuid,
    changedAt: new Date().toISOString(),
  });

  publishTableReleased({
    tableId: table.uuid,
    tableNumber: table.tableNumber,
    guestSessionId: session.uuid,
    changedAt: new Date().toISOString(),
  });

  return {
    table: toSafeTable(refreshed ?? table, false),
    receiptRawToken: closeResult.receiptRawToken!,
    receiptAccessExpiresAt: new Date(
      Date.now() + RECEIPT_ACCESS_TTL_HOURS * 60 * 60 * 1000,
    ),
  };
}

export async function forceReleaseTableSession(
  tableId: string,
  input: ForceReleaseTableInput,
  actorUserId: bigint,
): Promise<{
  table: SafeTable;
  receiptRawToken: string;
  receiptAccessExpiresAt: Date;
}> {
  const table = await findTableByUuid(tableId);

  if (table === null) {
    throw new AppError(
      TABLE_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "TABLE_NOT_FOUND",
    );
  }

  if (table.activeGuestSessionId === null) {
    throw new AppError(
      TABLE_MESSAGES.NO_ACTIVE_SESSION,
      HTTP_STATUS.CONFLICT,
      "TABLE_NO_ACTIVE_SESSION",
    );
  }

  const session = await findGuestSessionById(table.activeGuestSessionId);

  if (session === null || session.closedAt !== null) {
    throw new AppError(
      TABLE_MESSAGES.NO_ACTIVE_SESSION,
      HTTP_STATUS.CONFLICT,
      "TABLE_NO_ACTIVE_SESSION",
    );
  }

  const closeResult = await prisma.$transaction(async (tx) => {
    const result = await closeGuestSessionIfSafeInTx(
      tx,
      table.activeGuestSessionId!,
      {
        closureType: GuestSessionClosureType.FORCE_CLOSED,
        closedByUserId: actorUserId,
        reason: input.reason,
        force: true,
      },
    );

    if (!result.closed || result.receiptRawToken === null) {
      throw new AppError(
        TABLE_MESSAGES.NO_ACTIVE_SESSION,
        HTTP_STATUS.CONFLICT,
        "TABLE_NO_ACTIVE_SESSION",
      );
    }

    await writeAuditLog({
      tx,
      action: AUDIT_ACTIONS.TABLE_FORCE_RELEASED,
      actorUserId,
      actorGuestSessionId: session.id,
      entityType: "restaurant_table",
      entityId: table.uuid,
      reason: input.reason,
    });

    return result;
  });

  const refreshed = await findTableByUuid(tableId);

  publishGuestSessionForceClosed({
    guestSessionId: session.uuid,
    closureType: GuestSessionClosureType.FORCE_CLOSED,
    tableId: table.uuid,
    changedAt: new Date().toISOString(),
  });

  publishTableReleased({
    tableId: table.uuid,
    tableNumber: table.tableNumber,
    guestSessionId: session.uuid,
    changedAt: new Date().toISOString(),
  });

  return {
    table: toSafeTable(refreshed ?? table, false),
    receiptRawToken: closeResult.receiptRawToken!,
    receiptAccessExpiresAt: new Date(
      Date.now() + RECEIPT_ACCESS_TTL_HOURS * 60 * 60 * 1000,
    ),
  };
}

export { findTableByQrTokenHash } from "./table.repository.js";
