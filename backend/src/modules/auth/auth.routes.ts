import { Router } from "express";
import { authenticationRateLimiter } from "../../middleware/rate-limit.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { authenticate } from "../../middleware/authenticate.middleware.js";
import { login, me, refresh, logout, logoutAll } from "./auth.controller.js";
import { loginSchema } from "./auth.validation.js";

export const authRouter = Router();

authRouter.post(
  "/login",
  authenticationRateLimiter,
  validate(loginSchema),
  asyncHandler(login),
);
authRouter.get("/me", authenticate, asyncHandler(me));
authRouter.post("/refresh", asyncHandler(refresh));
authRouter.post("/logout", authenticate, asyncHandler(logout));
authRouter.post("/logout-all", authenticate, asyncHandler(logoutAll));
