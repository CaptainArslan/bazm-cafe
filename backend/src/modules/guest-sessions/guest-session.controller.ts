import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../constants/http-status.js";
import { sendSuccess } from "../../utils/api-response.js";
import { listGuestMenuRecords } from "../products/product.service.js";
import {
  GUEST_SESSION_CONSTANTS,
  getGuestSessionCookieOptions,
  getReceiptAccessCookieOptions,
} from "./guest-session.constants.js";
import {
  closeGuestSessionRecord,
  createGuestSessionRecord,
  getCurrentGuestSessionRecord,
  resolveTableToken,
} from "./guest-session.service.js";
import type {
  CreateGuestSessionInput,
  RedeemRecoveryCodeInput,
  ResolveTableInput,
} from "./guest-session.validation.js";
import {
  createRecoveryCodeRecord,
  redeemRecoveryCodeRecord,
} from "./recovery.service.js";

export async function createSession(request: Request, response: Response) {
  const existingRawToken = request.cookies?.[
    GUEST_SESSION_CONSTANTS.COOKIE_NAME
  ] as string | undefined;

  const result = await createGuestSessionRecord(
    request.body as CreateGuestSessionInput,
    existingRawToken,
  );

  response.cookie(
    GUEST_SESSION_CONSTANTS.COOKIE_NAME,
    result.rawToken,
    getGuestSessionCookieOptions(),
  );

  return sendSuccess(response, {
    statusCode: result.reclaimed ? HTTP_STATUS.OK : HTTP_STATUS.CREATED,
    message: result.reclaimed
      ? "Guest session reclaimed successfully."
      : "Guest session created successfully.",
    data: { session: result.session, reclaimed: result.reclaimed },
  });
}

export async function currentSession(request: Request, response: Response) {
  const rawToken = request.cookies?.[GUEST_SESSION_CONSTANTS.COOKIE_NAME] as
    | string
    | undefined;

  const session = await getCurrentGuestSessionRecord(rawToken ?? "");

  return sendSuccess(response, {
    message: "Guest session retrieved successfully.",
    data: { session },
  });
}

export async function closeSession(request: Request, response: Response) {
  const rawToken = request.cookies?.[GUEST_SESSION_CONSTANTS.COOKIE_NAME] as
    | string
    | undefined;

  const result = await closeGuestSessionRecord(rawToken ?? "");

  response.clearCookie(
    GUEST_SESSION_CONSTANTS.COOKIE_NAME,
    getGuestSessionCookieOptions(),
  );

  response.cookie(
    GUEST_SESSION_CONSTANTS.RECEIPT_COOKIE_NAME,
    result.receiptRawToken,
    getReceiptAccessCookieOptions(),
  );

  return sendSuccess(response, {
    message: "Guest session closed successfully.",
    data: {
      session: result.session,
      receiptAccessExpiresAt: result.receiptAccessExpiresAt,
    },
  });
}

export async function resolveTable(request: Request, response: Response) {
  const input = request.body as ResolveTableInput;
  const table = await resolveTableToken(input.tableToken);

  return sendSuccess(response, {
    message: "Table resolved successfully.",
    data: { table },
  });
}

export async function guestMenu(_request: Request, response: Response) {
  const products = await listGuestMenuRecords();

  return sendSuccess(response, {
    message: "Guest menu retrieved successfully.",
    data: { products },
  });
}

export async function createRecoveryCode(request: Request, response: Response) {
  const { sessionId } = request.params as { sessionId: string };
  const result = await createRecoveryCodeRecord(
    sessionId,
    request.user!.databaseId,
  );

  return sendSuccess(response, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Recovery code generated successfully.",
    data: result,
  });
}

export async function recoverSession(request: Request, response: Response) {
  const input = request.body as RedeemRecoveryCodeInput;
  const result = await redeemRecoveryCodeRecord(input.recoveryCode);

  response.cookie(
    GUEST_SESSION_CONSTANTS.COOKIE_NAME,
    result.rawToken,
    getGuestSessionCookieOptions(),
  );

  return sendSuccess(response, {
    message: "Guest session recovered successfully.",
    data: { session: result.session },
  });
}
