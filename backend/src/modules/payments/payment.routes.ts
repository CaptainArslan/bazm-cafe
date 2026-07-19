import { Router } from "express";

import { UserRole } from "../../generated/prisma/enums.js";
import { authenticate } from "../../middleware/authenticate.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { orderIdParamsSchema } from "../orders/order.validation.js";
import {
  createForOrder,
  getById,
  list,
  listForOrder,
  reverse,
} from "./payment.controller.js";
import {
  createPaymentSchema,
  paymentIdParamsSchema,
  reversePaymentSchema,
} from "./payment.validation.js";

export const paymentsRouter = Router();

paymentsRouter.use(authenticate, authorize([UserRole.ADMIN]));

paymentsRouter.get("/", asyncHandler(list));
paymentsRouter.get(
  "/:paymentId",
  validate(paymentIdParamsSchema, "params"),
  asyncHandler(getById),
);
paymentsRouter.post(
  "/:paymentId/reverse",
  validate(paymentIdParamsSchema, "params"),
  validate(reversePaymentSchema),
  asyncHandler(reverse),
);

export const orderPaymentsRouter = Router({ mergeParams: true });

orderPaymentsRouter.use(authenticate, authorize([UserRole.ADMIN]));

orderPaymentsRouter.get(
  "/",
  validate(orderIdParamsSchema, "params"),
  asyncHandler(listForOrder),
);

orderPaymentsRouter.post(
  "/",
  validate(orderIdParamsSchema, "params"),
  validate(createPaymentSchema),
  asyncHandler(createForOrder),
);
