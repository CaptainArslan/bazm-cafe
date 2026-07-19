import type { CookieOptions, Request, Response } from "express";

import { env } from "../../config/environment.js";

import { HTTP_STATUS } from "../../constants/http-status.js";

import { AppError } from "../../errors/app-error.js";

import { sendSuccess } from "../../utils/api-response.js";

import { AUTH_CONSTANTS, AUTH_MESSAGES } from "./auth.constants.js";

import {
  login as loginService,
  logout as logoutService,
  logoutAll as logoutAllService,
  refreshSession,
} from "./auth.service.js";

import type { SessionContext } from "./auth.types.js";

import type { LoginInput } from "./auth.validation.js";

import { generateOpaqueToken } from "./token.service.js";

function getRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,

    secure: env.NODE_ENV === "production",

    sameSite: "lax",

    path: AUTH_CONSTANTS.REFRESH_COOKIE_PATH,

    maxAge: env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  };
}

function getDeviceCookieOptions(): CookieOptions {
  return {
    httpOnly: true,

    secure: env.NODE_ENV === "production",

    sameSite: "lax",

    path: AUTH_CONSTANTS.DEVICE_COOKIE_PATH,

    maxAge: AUTH_CONSTANTS.DEVICE_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  };
}

function readCookie(request: Request, cookieName: string): string | undefined {
  const cookies: unknown = request.cookies;

  if (typeof cookies !== "object" || cookies === null) {
    return undefined;
  }

  const value = (cookies as Record<string, unknown>)[cookieName];

  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  return value;
}

function readRefreshCookie(request: Request): string | undefined {
  return readCookie(request, AUTH_CONSTANTS.REFRESH_COOKIE_NAME);
}

function getOrCreateDeviceId(request: Request, response: Response): string {
  const existingDeviceId = readCookie(
    request,
    AUTH_CONSTANTS.DEVICE_COOKIE_NAME,
  );

  if (existingDeviceId !== undefined) {
    return existingDeviceId;
  }

  const deviceId = generateOpaqueToken();

  response.cookie(
    AUTH_CONSTANTS.DEVICE_COOKIE_NAME,
    deviceId,
    getDeviceCookieOptions(),
  );

  return deviceId;
}

function getSessionContext(request: Request, deviceId: string): SessionContext {
  const userAgent = request.get("user-agent");

  return {
    deviceId,

    ...(request.ip !== undefined && {
      ipAddress: request.ip,
    }),

    ...(userAgent !== undefined && {
      userAgent,
    }),
  };
}

function setRefreshCookie(response: Response, refreshToken: string): void {
  response.cookie(
    AUTH_CONSTANTS.REFRESH_COOKIE_NAME,
    refreshToken,
    getRefreshCookieOptions(),
  );
}

function clearRefreshCookie(response: Response): void {
  const { maxAge: _maxAge, ...cookieOptions } = getRefreshCookieOptions();

  response.clearCookie(AUTH_CONSTANTS.REFRESH_COOKIE_NAME, cookieOptions);
}

export async function login(request: Request, response: Response) {
  const input = request.body as LoginInput;

  const deviceId = getOrCreateDeviceId(request, response);

  const result = await loginService(
    input,
    getSessionContext(request, deviceId),
  );

  setRefreshCookie(response, result.refreshToken);

  return sendSuccess(response, {
    message: "Login successful.",

    data: {
      accessToken: result.accessToken,

      user: result.user,
    },
  });
}

export async function me(request: Request, response: Response) {
  if (request.user === undefined) {
    throw new AppError(
      AUTH_MESSAGES.AUTHENTICATION_REQUIRED,
      HTTP_STATUS.UNAUTHORIZED,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const {
    databaseId: _databaseId,
    sessionDatabaseId: _sessionDatabaseId,
    sessionId: _sessionId,
    ...safeUser
  } = request.user;

  return sendSuccess(response, {
    message: "Authenticated user retrieved successfully.",

    data: {
      user: safeUser,
    },
  });
}

export async function refresh(request: Request, response: Response) {
  const refreshToken = readRefreshCookie(request);

  const result = await refreshSession(refreshToken);

  setRefreshCookie(response, result.refreshToken);

  return sendSuccess(response, {
    message: "Session refreshed successfully.",

    data: {
      accessToken: result.accessToken,

      user: result.user,
    },
  });
}

export async function logout(request: Request, response: Response) {
  const refreshToken = readRefreshCookie(request);

  await logoutService(refreshToken);

  clearRefreshCookie(response);

  return sendSuccess(response, {
    message: "Logout successful.",
  });
}

export async function logoutAll(request: Request, response: Response) {
  if (request.user === undefined) {
    throw new AppError(
      AUTH_MESSAGES.AUTHENTICATION_REQUIRED,
      HTTP_STATUS.UNAUTHORIZED,
      "AUTHENTICATION_REQUIRED",
    );
  }

  await logoutAllService(request.user.databaseId);

  clearRefreshCookie(response);

  return sendSuccess(response, {
    message: "Logged out from all devices successfully.",
  });
}
