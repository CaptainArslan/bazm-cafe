import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../constants/http-status.js";
import { sendSuccess } from "../../utils/api-response.js";
import {
  createTableRecordService,
  forceReleaseTableSession,
  getTableQrCodeService,
  getTableRecord,
  listTableRecords,
  regenerateTableQrCodeService,
  releaseTableSession,
  updateTableRecordService,
  updateTableStatusService,
} from "./table.service.js";
import type {
  CreateTableInput,
  ForceReleaseTableInput,
  UpdateTableInput,
  UpdateTableStatusInput,
} from "./table.validation.js";

export async function list(_request: Request, response: Response) {
  const tables = await listTableRecords();
  return sendSuccess(response, {
    message: "Tables retrieved successfully.",
    data: { tables },
  });
}

export async function getById(request: Request, response: Response) {
  const { tableId } = request.params as { tableId: string };
  const table = await getTableRecord(tableId);
  return sendSuccess(response, {
    message: "Table retrieved successfully.",
    data: { table },
  });
}

export async function create(request: Request, response: Response) {
  const input = request.body as CreateTableInput;
  const table = await createTableRecordService(input);
  return sendSuccess(response, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Table created successfully.",
    data: { table },
  });
}

export async function update(request: Request, response: Response) {
  const { tableId } = request.params as { tableId: string };
  const input = request.body as UpdateTableInput;
  const table = await updateTableRecordService(tableId, input);
  return sendSuccess(response, {
    message: "Table updated successfully.",
    data: { table },
  });
}

export async function updateStatus(request: Request, response: Response) {
  const { tableId } = request.params as { tableId: string };
  const input = request.body as UpdateTableStatusInput;
  const table = await updateTableStatusService(tableId, input);
  return sendSuccess(response, {
    message: "Table status updated successfully.",
    data: { table },
  });
}

export async function getQrCode(request: Request, response: Response) {
  const { tableId } = request.params as { tableId: string };
  const qrCode = await getTableQrCodeService(tableId);
  return sendSuccess(response, {
    message: "Table QR code retrieved successfully.",
    data: { qrCode },
  });
}

export async function regenerateQrCode(request: Request, response: Response) {
  const { tableId } = request.params as { tableId: string };
  const table = await regenerateTableQrCodeService(tableId);
  return sendSuccess(response, {
    message: "Table QR code regenerated successfully.",
    data: { table },
  });
}

export async function release(request: Request, response: Response) {
  const { tableId } = request.params as { tableId: string };
  const result = await releaseTableSession(tableId, request.user!.databaseId);

  return sendSuccess(response, {
    message: "Table released successfully.",
    data: {
      table: result.table,
      receiptRawToken: result.receiptRawToken,
      receiptAccessExpiresAt: result.receiptAccessExpiresAt,
    },
  });
}

export async function forceRelease(request: Request, response: Response) {
  const { tableId } = request.params as { tableId: string };
  const input = request.body as ForceReleaseTableInput;
  const result = await forceReleaseTableSession(
    tableId,
    input,
    request.user!.databaseId,
  );

  return sendSuccess(response, {
    message: "Table force-released successfully.",
    data: {
      table: result.table,
      receiptRawToken: result.receiptRawToken,
      receiptAccessExpiresAt: result.receiptAccessExpiresAt,
    },
  });
}
