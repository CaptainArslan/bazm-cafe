import { Router } from "express";

import { UserRole } from "../../generated/prisma/enums.js";
import { authenticate } from "../../middleware/authenticate.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  staffAccept,
  staffAttachCustomer,
  staffCancel,
  staffGetById,
  staffList,
  staffMarkReady,
  staffMarkServed,
  staffReceiptHtml,
  staffReceiptImage,
  staffReject,
  staffStartPreparing,
} from "./order.controller.js";
import {
  attachCustomerSchema,
  cancelOrderSchema,
  listOrdersQuerySchema,
  orderIdParamsSchema,
  rejectOrderSchema,
} from "./order.validation.js";

export const ordersRouter = Router();

ordersRouter.use(authenticate);

ordersRouter.get(
  "/",
  authorize([UserRole.ADMIN, UserRole.STAFF]),
  validate(listOrdersQuerySchema, "query"),
  asyncHandler(staffList),
);

ordersRouter.get(
  "/:orderId",
  authorize([UserRole.ADMIN, UserRole.STAFF]),
  validate(orderIdParamsSchema, "params"),
  asyncHandler(staffGetById),
);

ordersRouter.post(
  "/:orderId/accept",
  authorize([UserRole.ADMIN, UserRole.STAFF]),
  validate(orderIdParamsSchema, "params"),
  asyncHandler(staffAccept),
);

ordersRouter.post(
  "/:orderId/start-preparing",
  authorize([UserRole.ADMIN, UserRole.STAFF]),
  validate(orderIdParamsSchema, "params"),
  asyncHandler(staffStartPreparing),
);

ordersRouter.post(
  "/:orderId/mark-ready",
  authorize([UserRole.ADMIN, UserRole.STAFF]),
  validate(orderIdParamsSchema, "params"),
  asyncHandler(staffMarkReady),
);

ordersRouter.post(
  "/:orderId/mark-served",
  authorize([UserRole.ADMIN, UserRole.STAFF]),
  validate(orderIdParamsSchema, "params"),
  asyncHandler(staffMarkServed),
);

ordersRouter.post(
  "/:orderId/reject",
  authorize([UserRole.ADMIN, UserRole.STAFF]),
  validate(orderIdParamsSchema, "params"),
  validate(rejectOrderSchema),
  asyncHandler(staffReject),
);

ordersRouter.post(
  "/:orderId/cancel",
  authorize([UserRole.ADMIN]),
  validate(orderIdParamsSchema, "params"),
  validate(cancelOrderSchema),
  asyncHandler(staffCancel),
);

ordersRouter.post(
  "/:orderId/customer",
  authorize([UserRole.ADMIN, UserRole.STAFF]),
  validate(orderIdParamsSchema, "params"),
  validate(attachCustomerSchema),
  asyncHandler(staffAttachCustomer),
);

ordersRouter.get(
  "/:orderId/receipt",
  authorize([UserRole.ADMIN, UserRole.STAFF]),
  validate(orderIdParamsSchema, "params"),
  asyncHandler(staffReceiptHtml),
);

ordersRouter.get(
  "/:orderId/receipt-image",
  authorize([UserRole.ADMIN, UserRole.STAFF]),
  validate(orderIdParamsSchema, "params"),
  asyncHandler(staffReceiptImage),
);
