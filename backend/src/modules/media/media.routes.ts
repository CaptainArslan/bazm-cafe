import { Router } from "express";

import { UserRole } from "../../generated/prisma/enums.js";
import { authenticate } from "../../middleware/authenticate.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { list, remove, upload, uploadMediaMiddleware } from "./media.controller.js";
import {
  deleteMediaSchema,
  listMediaQuerySchema,
  uploadMediaQuerySchema,
} from "./media.validation.js";

export const mediaRouter = Router();

mediaRouter.use(authenticate, authorize([UserRole.ADMIN, UserRole.STAFF]));

mediaRouter.get(
  "/",
  validate(listMediaQuerySchema, "query"),
  asyncHandler(list),
);

mediaRouter.post(
  "/",
  validate(uploadMediaQuerySchema, "query"),
  asyncHandler(uploadMediaMiddleware),
  asyncHandler(upload),
);

mediaRouter.delete(
  "/",
  validate(deleteMediaSchema),
  asyncHandler(remove),
);
