import type { CookieOptions } from "express";

import { env } from "../../config/environment.js";
import { RECEIPT_ACCESS_TTL_HOURS } from "./session-lifecycle.js";

export const GUEST_SESSION_CONSTANTS = {
  COOKIE_NAME: "bazm_guest_session",
  COOKIE_PATH: "/api/v1",
  RECEIPT_COOKIE_NAME: "bazm_receipt_access",
} as const;

export const GUEST_SESSION_MESSAGES = {
  REQUIRED: "A guest session is required.",
  INVALID: "The guest session is invalid or expired.",
  CLOSED: "This guest session is closed.",
  TABLE_REQUIRED: "A valid table QR token is required for dine-in.",
  TABLE_INVALID: "The table QR code is invalid or inactive.",
  ORDER_TYPE_MISMATCH: "The order type does not match this guest session.",
  TABLE_SESSION_ALREADY_ACTIVE:
    "This table already has an active dining session. Please continue on the original device or ask staff for assistance.",
  SESSION_NOT_RELEASABLE:
    "This session cannot be released yet. Outstanding orders or balances must be settled first.",
  RECOVERY_CODE_INVALID: "The recovery code is invalid or has expired.",
  RECOVERY_SESSION_INACTIVE: "The guest session for this recovery code is inactive.",
  RECEIPT_ACCESS_REQUIRED: "A receipt access token is required.",
  RECEIPT_ACCESS_INVALID: "The receipt access token is invalid or expired.",
} as const;

export function getGuestSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: GUEST_SESSION_CONSTANTS.COOKIE_PATH,
    maxAge: env.GUEST_SESSION_EXPIRES_HOURS * 60 * 60 * 1000,
  };
}

export function getReceiptAccessCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: GUEST_SESSION_CONSTANTS.COOKIE_PATH,
    maxAge: RECEIPT_ACCESS_TTL_HOURS * 60 * 60 * 1000,
  };
}
