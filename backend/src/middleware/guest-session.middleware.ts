import type { RequestHandler } from "express";

import { HTTP_STATUS } from "../constants/http-status.js";
import { AppError } from "../errors/app-error.js";
import {
  GUEST_SESSION_CONSTANTS,
  GUEST_SESSION_MESSAGES,
} from "../modules/guest-sessions/guest-session.constants.js";
import { getGuestSessionFromRawToken } from "../modules/guest-sessions/guest-session.service.js";

export const requireGuestSession: RequestHandler = async (
  request,
  _response,
  next,
) => {
  try {
    const rawToken = request.cookies?.[GUEST_SESSION_CONSTANTS.COOKIE_NAME] as
      | string
      | undefined;

    if (rawToken === undefined || rawToken.length === 0) {
      throw new AppError(
        GUEST_SESSION_MESSAGES.REQUIRED,
        HTTP_STATUS.UNAUTHORIZED,
        "GUEST_SESSION_REQUIRED",
      );
    }

    const { context } = await getGuestSessionFromRawToken(rawToken);
    request.guestSession = context;
    next();
  } catch (error) {
    next(error);
  }
};
