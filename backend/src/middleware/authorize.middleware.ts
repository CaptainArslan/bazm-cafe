import type { RequestHandler } from "express";

import { HTTP_STATUS } from "../constants/http-status.js";
import { AppError } from "../errors/app-error.js";
import { UserRole } from "../generated/prisma/enums.js";
import { AUTH_MESSAGES } from "../modules/auth/auth.constants.js";

export function authorize(roles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    try {
      if (request.user === undefined) {
        throw new AppError(
          AUTH_MESSAGES.AUTHENTICATION_REQUIRED,
          HTTP_STATUS.UNAUTHORIZED,
          "AUTHENTICATION_REQUIRED",
        );
      }

      if (!roles.includes(request.user.role)) {
        throw new AppError(
          AUTH_MESSAGES.FORBIDDEN,
          HTTP_STATUS.FORBIDDEN,
          "FORBIDDEN",
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
