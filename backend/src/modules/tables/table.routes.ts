import { Router } from "express";

import { UserRole } from "../../generated/prisma/enums.js";
import { authenticate } from "../../middleware/authenticate.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  create,
  forceRelease,
  getById,
  getQrCode,
  list,
  regenerateQrCode,
  release,
  update,
  updateStatus,
} from "./table.controller.js";
import {
  createTableSchema,
  forceReleaseTableSchema,
  tableIdParamsSchema,
  updateTableSchema,
  updateTableStatusSchema,
} from "./table.validation.js";

export const tablesRouter = Router();

tablesRouter.use(authenticate, authorize([UserRole.ADMIN]));

tablesRouter.get("/", asyncHandler(list));
tablesRouter.get(
  "/:tableId",
  validate(tableIdParamsSchema, "params"),
  asyncHandler(getById),
);
tablesRouter.post("/", validate(createTableSchema), asyncHandler(create));
tablesRouter.patch(
  "/:tableId",
  validate(tableIdParamsSchema, "params"),
  validate(updateTableSchema),
  asyncHandler(update),
);
tablesRouter.patch(
  "/:tableId/status",
  validate(tableIdParamsSchema, "params"),
  validate(updateTableStatusSchema),
  asyncHandler(updateStatus),
);
tablesRouter.get(
  "/:tableId/qr-code",
  validate(tableIdParamsSchema, "params"),
  asyncHandler(getQrCode),
);
tablesRouter.post(
  "/:tableId/qr-code/regenerate",
  validate(tableIdParamsSchema, "params"),
  asyncHandler(regenerateQrCode),
);
tablesRouter.post(
  "/:tableId/release",
  validate(tableIdParamsSchema, "params"),
  asyncHandler(release),
);
tablesRouter.post(
  "/:tableId/force-release",
  validate(tableIdParamsSchema, "params"),
  validate(forceReleaseTableSchema),
  asyncHandler(forceRelease),
);
