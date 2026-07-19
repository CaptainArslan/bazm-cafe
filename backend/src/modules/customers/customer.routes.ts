import { Router } from "express";

import { UserRole } from "../../generated/prisma/enums.js";
import { authenticate } from "../../middleware/authenticate.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { create, getById, list, update } from "./customer.controller.js";
import {
  createCustomerSchema,
  customerIdParamsSchema,
  listCustomersQuerySchema,
  updateCustomerSchema,
} from "./customer.validation.js";

export const customersRouter = Router();

customersRouter.use(
  authenticate,
  authorize([UserRole.ADMIN, UserRole.STAFF]),
);

customersRouter.get(
  "/",
  validate(listCustomersQuerySchema, "query"),
  asyncHandler(list),
);

customersRouter.get(
  "/:customerId",
  validate(customerIdParamsSchema, "params"),
  asyncHandler(getById),
);

customersRouter.post(
  "/",
  validate(createCustomerSchema),
  asyncHandler(create),
);

customersRouter.patch(
  "/:customerId",
  validate(customerIdParamsSchema, "params"),
  validate(updateCustomerSchema),
  asyncHandler(update),
);
