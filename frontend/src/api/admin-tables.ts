import { authHttp } from "./http";
import type { CreateTableInput, SafeTable, TableOperationalStatus, UpdateTableInput } from "../types/table";

export function listTables() {
  return authHttp.get<{ tables: SafeTable[] }>("/tables");
}

export function getTable(tableId: string) {
  return authHttp.get<{ table: SafeTable }>(`/tables/${tableId}`);
}

export function createTable(input: CreateTableInput) {
  return authHttp.post<{ table: SafeTable }>("/tables", input);
}

export function updateTable(tableId: string, input: UpdateTableInput) {
  return authHttp.patch<{ table: SafeTable }>(`/tables/${tableId}`, input);
}

export function updateTableStatus(
  tableId: string,
  input: { operationalStatus: TableOperationalStatus; isActive?: boolean },
) {
  return authHttp.patch<{ table: SafeTable }>(`/tables/${tableId}/status`, input);
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
  }>(`/tables/${tableId}/qr-code`);
}

export function regenerateTableQr(tableId: string) {
  return authHttp.post<{ table: SafeTable }>(`/tables/${tableId}/qr-code/regenerate`);
}

export function releaseTable(tableId: string) {
  return authHttp.post<{ table: SafeTable; receiptRawToken: string; receiptAccessExpiresAt: string }>(
    `/tables/${tableId}/release`,
  );
}

export function forceReleaseTable(tableId: string, reason: string) {
  return authHttp.post<{ table: SafeTable; receiptRawToken: string; receiptAccessExpiresAt: string }>(
    `/tables/${tableId}/force-release`,
    { reason },
  );
}
