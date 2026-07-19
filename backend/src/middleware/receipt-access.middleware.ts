import type { NextFunction, Request, Response } from "express";

import { HTTP_STATUS } from "../constants/http-status.js";
import { AppError } from "../errors/app-error.js";
import { prisma } from "../config/database.js";
import { hashOpaqueToken } from "../modules/auth/token.service.js";
import {
  GUEST_SESSION_CONSTANTS,
  GUEST_SESSION_MESSAGES,
} from "../modules/guest-sessions/guest-session.constants.js";

export type ReceiptAccessContext = {
  guestSessionDatabaseId: bigint;
  guestSessionUuid: string;
};

declare module "express-serve-static-core" {
  interface Request {
    receiptAccess?: ReceiptAccessContext;
  }
}

export async function requireReceiptAccess(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawToken = request.cookies?.[
      GUEST_SESSION_CONSTANTS.RECEIPT_COOKIE_NAME
    ] as string | undefined;

    if (!rawToken) {
      throw new AppError(
        GUEST_SESSION_MESSAGES.RECEIPT_ACCESS_REQUIRED,
        HTTP_STATUS.UNAUTHORIZED,
        "RECEIPT_ACCESS_REQUIRED",
      );
    }

    const token = await prisma.receiptAccessToken.findUnique({
      where: { tokenHash: hashOpaqueToken(rawToken) },
      include: {
        guestSession: {
          select: { id: true, uuid: true },
        },
      },
    });

    const now = new Date();

    if (
      token === null ||
      token.revokedAt !== null ||
      token.expiresAt <= now
    ) {
      throw new AppError(
        GUEST_SESSION_MESSAGES.RECEIPT_ACCESS_INVALID,
        HTTP_STATUS.UNAUTHORIZED,
        "RECEIPT_ACCESS_INVALID",
      );
    }

    request.receiptAccess = {
      guestSessionDatabaseId: token.guestSession.id,
      guestSessionUuid: token.guestSession.uuid,
    };

    next();
  } catch (error) {
    next(error);
  }
}
