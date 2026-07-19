import type { RequestHandler } from "express";

import { HTTP_STATUS } from "../constants/http-status.js";

import { AppError } from "../errors/app-error.js";

import { AUTH_MESSAGES } from "../modules/auth/auth.constants.js";

import { getCurrentUser } from "../modules/auth/auth.service.js";

import { verifyAccessToken } from "../modules/auth/token.service.js";

export const authenticate: RequestHandler = async (
  request,
  _response,
  next,
) => {
  try {
    const authorization = request.headers.authorization;

    if (authorization === undefined) {
      throw new AppError(
        AUTH_MESSAGES.AUTHENTICATION_REQUIRED,
        HTTP_STATUS.UNAUTHORIZED,
        "AUTHENTICATION_REQUIRED",
      );
    }

    const parts = authorization.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
      throw new AppError(
        "The Authorization header must use the Bearer scheme.",
        HTTP_STATUS.UNAUTHORIZED,
        "INVALID_AUTHORIZATION_HEADER",
      );
    }

    const accessToken = parts[1];

    let userId: bigint;
    let sessionUuid: string;

    try {
      const claims = verifyAccessToken(accessToken);

      userId = BigInt(claims.sub);

      sessionUuid = claims.sid;
    } catch {
      throw new AppError(
        AUTH_MESSAGES.INVALID_ACCESS_TOKEN,
        HTTP_STATUS.UNAUTHORIZED,
        "INVALID_ACCESS_TOKEN",
      );
    }

    request.user = await getCurrentUser(userId, sessionUuid);

    next();
  } catch (error) {
    next(error);
  }
};
