import { Router } from "express";

import { UserRole } from "../../generated/prisma/enums.js";
import { authenticate } from "../../middleware/authenticate.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  adjustStock,
  create,
  getById,
  list,
  remove,
  update,
  updateStatus,
} from "./product.controller.js";
import {
  adjustProductStockSchema,
  createProductSchema,
  productIdParamsSchema,
  updateProductSchema,
  updateProductStatusSchema,
} from "./product.validation.js";

export const productsRouter = Router();

productsRouter.use(authenticate, authorize([UserRole.ADMIN]));

productsRouter.get("/", asyncHandler(list));
productsRouter.get(
  "/:productId",
  validate(productIdParamsSchema, "params"),
  asyncHandler(getById),
);
productsRouter.post(
  "/",
  validate(createProductSchema),
  asyncHandler(create),
);
productsRouter.patch(
  "/:productId",
  validate(productIdParamsSchema, "params"),
  validate(updateProductSchema),
  asyncHandler(update),
);
productsRouter.patch(
  "/:productId/status",
  validate(productIdParamsSchema, "params"),
  validate(updateProductStatusSchema),
  asyncHandler(updateStatus),
);
productsRouter.patch(
  "/:productId/stock",
  validate(productIdParamsSchema, "params"),
  validate(adjustProductStockSchema),
  asyncHandler(adjustStock),
);
productsRouter.delete(
  "/:productId",
  validate(productIdParamsSchema, "params"),
  asyncHandler(remove),
);
