import bcrypt from "bcrypt";

import { env } from "../../config/environment.js";

import { HTTP_STATUS } from "../../constants/http-status.js";

import { AppError } from "../../errors/app-error.js";

import { AUTH_CONSTANTS, AUTH_MESSAGES } from "./auth.constants.js";

import {
  createOrReuseDeviceSession,
  findActiveAuthenticatedSession,
  findRefreshTokenByHash,
  findUserForLogin,
  recordFailedLogin,
  recordSuccessfulLogin,
  revokeAllUserAuthSessions,
  revokeAuthSessionById,
  revokeAuthSessionByRefreshTokenHash,
  rotateRefreshToken,
} from "./auth.repository.js";

import {
  generateOpaqueToken,
  hashOpaqueToken,
  signAccessToken,
} from "./token.service.js";

import type {
  AuthenticatedUser,
  LoginResult,
  RefreshResult,
  SessionContext,
} from "./auth.types.js";

import type { LoginInput } from "./auth.validation.js";

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function assertUserIsAvailable(user: {
  isActive: boolean;
  deletedAt: Date | null;
}): void {
  if (!user.isActive || user.deletedAt !== null) {
    throw new AppError(
      AUTH_MESSAGES.ACCOUNT_UNAVAILABLE,
      HTTP_STATUS.UNAUTHORIZED,
      "ACCOUNT_UNAVAILABLE",
    );
  }
}

export async function login(
  input: LoginInput,
  sessionContext: SessionContext,
): Promise<LoginResult> {
  const user = await findUserForLogin(input.email);

  if (user === null) {
    throw new AppError(
      AUTH_MESSAGES.INVALID_CREDENTIALS,
      HTTP_STATUS.UNAUTHORIZED,
      "INVALID_CREDENTIALS",
    );
  }

  assertUserIsAvailable(user);

  const now = new Date();

  if (user.lockedUntil !== null && user.lockedUntil > now) {
    throw new AppError(
      AUTH_MESSAGES.ACCOUNT_LOCKED,
      HTTP_STATUS.TOO_MANY_REQUESTS,
      "ACCOUNT_LOCKED",
    );
  }

  const passwordMatches = await bcrypt.compare(
    input.password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    const failedLoginAttempts = user.failedLoginAttempts + 1;

    const shouldLockAccount =
      failedLoginAttempts >= AUTH_CONSTANTS.MAX_FAILED_LOGIN_ATTEMPTS;

    await recordFailedLogin(
      user.id,

      shouldLockAccount ? 0 : failedLoginAttempts,

      shouldLockAccount
        ? addMinutes(now, AUTH_CONSTANTS.ACCOUNT_LOCK_MINUTES)
        : null,
    );

    throw new AppError(
      AUTH_MESSAGES.INVALID_CREDENTIALS,
      HTTP_STATUS.UNAUTHORIZED,
      "INVALID_CREDENTIALS",
    );
  }

  if (
    typeof sessionContext.deviceId !== "string" ||
    sessionContext.deviceId.length === 0
  ) {
    throw new AppError(
      "The device identifier is missing.",
      HTTP_STATUS.BAD_REQUEST,
      "DEVICE_IDENTIFIER_MISSING",
    );
  }

  const refreshToken = generateOpaqueToken();

  const sessionExpiration = addDays(now, env.JWT_REFRESH_EXPIRES_DAYS);

  const authSession = await createOrReuseDeviceSession({
    userId: user.id,

    deviceIdHash: hashOpaqueToken(sessionContext.deviceId),

    sessionExpiresAt: sessionExpiration,

    refreshTokenHash: hashOpaqueToken(refreshToken),

    refreshTokenExpiresAt: sessionExpiration,

    ...(input.deviceName !== undefined
      ? {
          deviceName: input.deviceName,
        }
      : sessionContext.deviceName !== undefined
        ? {
            deviceName: sessionContext.deviceName,
          }
        : {}),

    ...(sessionContext.ipAddress !== undefined
      ? {
          ipAddress: sessionContext.ipAddress,
        }
      : {}),

    ...(sessionContext.userAgent !== undefined
      ? {
          userAgent: sessionContext.userAgent,
        }
      : {}),
  });

  await recordSuccessfulLogin(user.id);

  const accessToken = signAccessToken({
    sub: user.id.toString(),

    sid: authSession.uuid,

    role: user.role,
  });

  return {
    accessToken,
    refreshToken,

    user: {
      id: user.uuid,

      name: user.name,

      email: user.email,

      role: user.role,
    },
  };
}

export async function getCurrentUser(
  userId: bigint,
  sessionUuid: string,
): Promise<AuthenticatedUser> {
  const authSession = await findActiveAuthenticatedSession(userId, sessionUuid);

  if (authSession === null) {
    throw new AppError(
      AUTH_MESSAGES.INVALID_ACCESS_TOKEN,
      HTTP_STATUS.UNAUTHORIZED,
      "AUTH_SESSION_INVALID",
    );
  }

  assertUserIsAvailable(authSession.user);

  return {
    databaseId: authSession.user.id,

    sessionDatabaseId: authSession.id,

    sessionId: authSession.uuid,

    id: authSession.user.uuid,

    name: authSession.user.name,

    email: authSession.user.email,

    role: authSession.user.role,
  };
}

export async function refreshSession(
  rawRefreshToken: string | undefined,
): Promise<RefreshResult> {
  if (rawRefreshToken === undefined || rawRefreshToken.length === 0) {
    throw new AppError(
      AUTH_MESSAGES.INVALID_REFRESH_TOKEN,
      HTTP_STATUS.UNAUTHORIZED,
      "INVALID_REFRESH_TOKEN",
    );
  }

  const storedToken = await findRefreshTokenByHash(
    hashOpaqueToken(rawRefreshToken),
  );

  if (storedToken === null) {
    throw new AppError(
      AUTH_MESSAGES.INVALID_REFRESH_TOKEN,
      HTTP_STATUS.UNAUTHORIZED,
      "INVALID_REFRESH_TOKEN",
    );
  }

  const authSession = storedToken.authSession;

  const user = authSession.user;

  if (storedToken.revokedAt !== null || storedToken.replacedById !== null) {
    await revokeAuthSessionById(authSession.id);

    throw new AppError(
      AUTH_MESSAGES.INVALID_REFRESH_TOKEN,
      HTTP_STATUS.UNAUTHORIZED,
      "REFRESH_TOKEN_REUSED",
    );
  }

  if (storedToken.expiresAt <= new Date()) {
    await revokeAuthSessionById(authSession.id);

    throw new AppError(
      AUTH_MESSAGES.INVALID_REFRESH_TOKEN,
      HTTP_STATUS.UNAUTHORIZED,
      "REFRESH_TOKEN_EXPIRED",
    );
  }

  if (authSession.revokedAt !== null || authSession.expiresAt <= new Date()) {
    if (authSession.revokedAt === null) {
      await revokeAuthSessionById(authSession.id);
    }

    throw new AppError(
      AUTH_MESSAGES.INVALID_REFRESH_TOKEN,
      HTTP_STATUS.UNAUTHORIZED,
      "AUTH_SESSION_INVALID",
    );
  }

  if (!user.isActive || user.deletedAt !== null) {
    await revokeAllUserAuthSessions(user.id);

    throw new AppError(
      AUTH_MESSAGES.ACCOUNT_UNAVAILABLE,
      HTTP_STATUS.UNAUTHORIZED,
      "ACCOUNT_UNAVAILABLE",
    );
  }

  const replacementRefreshToken = generateOpaqueToken();

  try {
    await rotateRefreshToken(storedToken.id, {
      authSessionId: authSession.id,

      tokenHash: hashOpaqueToken(replacementRefreshToken),

      expiresAt: addDays(new Date(), env.JWT_REFRESH_EXPIRES_DAYS),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "REFRESH_TOKEN_ROTATION_CONFLICT"
    ) {
      throw new AppError(
        AUTH_MESSAGES.INVALID_REFRESH_TOKEN,
        HTTP_STATUS.UNAUTHORIZED,
        "REFRESH_TOKEN_ALREADY_ROTATED",
      );
    }

    throw error;
  }

  const accessToken = signAccessToken({
    sub: user.id.toString(),

    sid: authSession.uuid,

    role: user.role,
  });

  return {
    accessToken,

    refreshToken: replacementRefreshToken,

    user: {
      id: user.uuid,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

export async function logout(
  rawRefreshToken: string | undefined,
): Promise<void> {
  if (rawRefreshToken === undefined || rawRefreshToken.length === 0) {
    return;
  }

  await revokeAuthSessionByRefreshTokenHash(hashOpaqueToken(rawRefreshToken));
}

export async function logoutAll(userId: bigint): Promise<void> {
  await revokeAllUserAuthSessions(userId);
}
