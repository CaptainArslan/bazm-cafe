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
  update,
  updateStatus,
} from "./staff.controller.js";
import {
  createStaffSchema,
  listStaffQuerySchema,
  staffIdParamsSchema,
  updateStaffSchema,
  updateStaffStatusSchema,
} from "./staff.validation.js";

export const staffRouter = Router();

staffRouter.use(authenticate, authorize([UserRole.ADMIN]));

staffRouter.get(
  "/",
  validate(listStaffQuerySchema, "query"),
  asyncHandler(list),
);

staffRouter.get(
  "/:staffId",
  validate(staffIdParamsSchema, "params"),
  asyncHandler(getById),
);

staffRouter.post(
  "/",
  validate(createStaffSchema),
  asyncHandler(create),
);

staffRouter.patch(
  "/:staffId",
  validate(staffIdParamsSchema, "params"),
  validate(updateStaffSchema),
  asyncHandler(update),
);

staffRouter.patch(
  "/:staffId/status",
  validate(staffIdParamsSchema, "params"),
  validate(updateStaffStatusSchema),
  asyncHandler(updateStatus),
);
