import { Router } from "express";

import { UserRole } from "../../generated/prisma/enums.js";
import { authenticate } from "../../middleware/authenticate.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { requireGuestSession } from "../../middleware/guest-session.middleware.js";
import { recoveryCodeRateLimiter } from "../../middleware/rate-limit.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  guestCreate,
  guestGetById,
  guestList,
  guestReceiptHtml,
  guestReceiptImage,
} from "../orders/order.controller.js";
import {
  createGuestOrderSchema,
  orderPublicIdParamsSchema,
} from "../orders/order.validation.js";
import {
  closeSession,
  createRecoveryCode,
  createSession,
  currentSession,
  guestMenu,
  recoverSession,
  resolveTable,
} from "./guest-session.controller.js";
import {
  createGuestSessionSchema,
  guestSessionIdParamsSchema,
  redeemRecoveryCodeSchema,
  resolveTableSchema,
} from "./guest-session.validation.js";

export const guestRouter = Router();

guestRouter.post(
  "/sessions",
  validate(createGuestSessionSchema),
  asyncHandler(createSession),
);

guestRouter.get(
  "/sessions/current",
  requireGuestSession,
  asyncHandler(currentSession),
);

guestRouter.post(
  "/sessions/close",
  requireGuestSession,
  asyncHandler(closeSession),
);

guestRouter.post(
  "/sessions/recover",
  recoveryCodeRateLimiter,
  validate(redeemRecoveryCodeSchema),
  asyncHandler(recoverSession),
);

guestRouter.post(
  "/tables/resolve",
  validate(resolveTableSchema),
  asyncHandler(resolveTable),
);

guestRouter.get("/menu", requireGuestSession, asyncHandler(guestMenu));

guestRouter.post(
  "/orders",
  requireGuestSession,
  validate(createGuestOrderSchema),
  asyncHandler(guestCreate),
);

guestRouter.get("/orders", requireGuestSession, asyncHandler(guestList));

guestRouter.get(
  "/orders/:orderPublicId",
  requireGuestSession,
  validate(orderPublicIdParamsSchema, "params"),
  asyncHandler(guestGetById),
);

guestRouter.get(
  "/orders/:orderPublicId/receipt",
  requireGuestSession,
  validate(orderPublicIdParamsSchema, "params"),
  asyncHandler(guestReceiptHtml),
);

guestRouter.get(
  "/orders/:orderPublicId/receipt-image",
  requireGuestSession,
  validate(orderPublicIdParamsSchema, "params"),
  asyncHandler(guestReceiptImage),
);

export const guestSessionsStaffRouter = Router();

guestSessionsStaffRouter.post(
  "/:sessionId/recovery-codes",
  authenticate,
  authorize([UserRole.ADMIN, UserRole.STAFF]),
  recoveryCodeRateLimiter,
  validate(guestSessionIdParamsSchema, "params"),
  asyncHandler(createRecoveryCode),
);
