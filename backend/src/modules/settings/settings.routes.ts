import { Router } from "express";

import { UserRole } from "../../generated/prisma/enums.js";
import { authenticate } from "../../middleware/authenticate.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { get, update } from "./settings.controller.js";
import { updateCafeSettingsSchema } from "./settings.validation.js";

export const settingsRouter = Router();

settingsRouter.use(authenticate);

settingsRouter.get(
  "/",
  authorize([UserRole.ADMIN, UserRole.STAFF]),
  asyncHandler(get),
);

settingsRouter.patch(
  "/",
  authorize([UserRole.ADMIN]),
  validate(updateCafeSettingsSchema),
  asyncHandler(update),
);
