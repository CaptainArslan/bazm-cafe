import { endpoints } from "./endpoints";
import { authHttp } from "./http";
import type { CreateTableInput, SafeTable, TableOperationalStatus, UpdateTableInput } from "../types/table";

export function listTables() {
  return authHttp.get<{ tables: SafeTable[] }>(endpoints.tables.list);
}

export function getTable(tableId: string) {
  return authHttp.get<{ table: SafeTable }>(endpoints.tables.detail(tableId));
}

export function createTable(input: CreateTableInput) {
  return authHttp.post<{ table: SafeTable }>(endpoints.tables.list, input);
}

export function updateTable(tableId: string, input: UpdateTableInput) {
  return authHttp.patch<{ table: SafeTable }>(endpoints.tables.detail(tableId), input);
}

export function updateTableStatus(
  tableId: string,
  input: { operationalStatus: TableOperationalStatus; isActive?: boolean },
) {
  return authHttp.patch<{ table: SafeTable }>(endpoints.tables.status(tableId), input);
}

export function getTableQrCode(tableId: string) {
  return authHttp.get<{
    qrCode: {
      tableId: string;
      tableNumber: string;
      qrVersion: number;
      qrImagePath: string | null;
      qrImageUrl: string | null;
      qrGeneratedAt: string;
      qrRegeneratedAt: string | null;
    };
  }>(endpoints.tables.qrCode(tableId));
}

export function regenerateTableQr(tableId: string) {
  return authHttp.post<{ table: SafeTable }>(endpoints.tables.regenerateQr(tableId));
}

export function releaseTable(tableId: string) {
  return authHttp.post<{ table: SafeTable; receiptRawToken: string; receiptAccessExpiresAt: string }>(
    endpoints.tables.release(tableId),
  );
}

export function forceReleaseTable(tableId: string, reason: string) {
  return authHttp.post<{ table: SafeTable; receiptRawToken: string; receiptAccessExpiresAt: string }>(
    endpoints.tables.forceRelease(tableId),
    { reason },
  );
}
