import { Router } from "express";

import { UserRole } from "../../generated/prisma/enums.js";
import { authenticate } from "../../middleware/authenticate.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  create,
  getById,
  list,
  remove,
  update,
  updateStatus,
} from "./category.controller.js";
import {
  categoryIdParamsSchema,
  createCategorySchema,
  updateCategorySchema,
  updateCategoryStatusSchema,
} from "./category.validation.js";

export const categoriesRouter = Router();

categoriesRouter.use(authenticate, authorize([UserRole.ADMIN]));

categoriesRouter.get("/", asyncHandler(list));
categoriesRouter.get(
  "/:categoryId",
  validate(categoryIdParamsSchema, "params"),
  asyncHandler(getById),
);
categoriesRouter.post(
  "/",
  validate(createCategorySchema),
  asyncHandler(create),
);
categoriesRouter.patch(
  "/:categoryId",
  validate(categoryIdParamsSchema, "params"),
  validate(updateCategorySchema),
  asyncHandler(update),
);
categoriesRouter.patch(
  "/:categoryId/status",
  validate(categoryIdParamsSchema, "params"),
  validate(updateCategoryStatusSchema),
  asyncHandler(updateStatus),
);
categoriesRouter.delete(
  "/:categoryId",
  validate(categoryIdParamsSchema, "params"),
  asyncHandler(remove),
);
