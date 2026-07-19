import { prisma } from "../../config/database.js";
import { TableOperationalStatus } from "../../generated/prisma/enums.js";

const tableSelect = {
  id: true,
  uuid: true,
  tableNumber: true,
  name: true,
  capacity: true,
  operationalStatus: true,
  qrTokenHash: true,
  qrVersion: true,
  qrImagePath: true,
  qrGeneratedAt: true,
  qrRegeneratedAt: true,
  activeGuestSessionId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

export function findTableByUuid(uuid: string) {
  return prisma.restaurantTable.findFirst({
    where: { uuid, deletedAt: null },
    select: tableSelect,
  });
}

export function findTableByNumber(tableNumber: string) {
  return prisma.restaurantTable.findFirst({
    where: { tableNumber, deletedAt: null },
    select: { id: true, uuid: true },
  });
}

export function findTableByQrTokenHash(tokenHash: string) {
  return prisma.restaurantTable.findFirst({
    where: {
      qrTokenHash: tokenHash,
      deletedAt: null,
      isActive: true,
      operationalStatus: TableOperationalStatus.AVAILABLE,
    },
    select: tableSelect,
  });
}

export function listTables() {
  return prisma.restaurantTable.findMany({
    where: { deletedAt: null },
    orderBy: [{ tableNumber: "asc" }],
    select: tableSelect,
  });
}

export function findActiveGuestSessionTableIds(tableIds: bigint[]) {
  if (tableIds.length === 0) {
    return Promise.resolve([] as Array<{ restaurantTableId: bigint | null }>);
  }

  return prisma.restaurantTable
    .findMany({
      where: {
        id: { in: tableIds },
        activeGuestSessionId: { not: null },
        deletedAt: null,
      },
      select: { id: true },
    })
    .then((tables) =>
      tables.map((table) => ({ restaurantTableId: table.id as bigint | null })),
    );
}

export function createTableRecord(data: {
  uuid: string;
  tableNumber: string;
  name: string | null;
  capacity: number;
  qrTokenHash: string;
  qrImagePath: string;
}) {
  return prisma.restaurantTable.create({
    data: {
      uuid: data.uuid,
      tableNumber: data.tableNumber,
      name: data.name,
      capacity: data.capacity,
      qrTokenHash: data.qrTokenHash,
      qrVersion: 1,
      qrImagePath: data.qrImagePath,
      qrGeneratedAt: new Date(),
    },
    select: tableSelect,
  });
}

export function updateTableRecord(
  tableId: bigint,
  data: {
    tableNumber?: string;
    name?: string | null;
    capacity?: number;
    operationalStatus?: TableOperationalStatus;
    isActive?: boolean;
    qrTokenHash?: string;
    qrVersion?: number;
    qrImagePath?: string;
    qrRegeneratedAt?: Date;
  },
) {
  return prisma.restaurantTable.update({
    where: { id: tableId },
    data,
    select: tableSelect,
  });
}
