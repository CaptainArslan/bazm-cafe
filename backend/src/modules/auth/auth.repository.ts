import { randomUUID } from "node:crypto";

import { prisma } from "../../config/database.js";

export function findUserForLogin(email: string) {
  return prisma.user.findUnique({
    where: {
      email,
    },

    select: {
      id: true,
      uuid: true,
      name: true,
      email: true,
      passwordHash: true,
      role: true,
      isActive: true,
      deletedAt: true,
      failedLoginAttempts: true,
      lockedUntil: true,
    },
  });
}

export function recordFailedLogin(
  userId: bigint,
  failedLoginAttempts: number,
  lockedUntil: Date | null,
) {
  return prisma.user.update({
    where: {
      id: userId,
    },

    data: {
      failedLoginAttempts,
      lockedUntil,
    },

    select: {
      id: true,
    },
  });
}

export function recordSuccessfulLogin(userId: bigint) {
  return prisma.user.update({
    where: {
      id: userId,
    },

    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },

    select: {
      id: true,
    },
  });
}

export type CreateOrReuseDeviceSessionData = {
  userId: bigint;
  deviceIdHash: string;

  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;

  sessionExpiresAt: Date;

  refreshTokenHash: string;
  refreshTokenExpiresAt: Date;
};

/**
 * Creates one session per user and device.
 *
 * If the same user logs in from the same device:
 * - the AuthSession database row is reused;
 * - its UUID is changed;
 * - old refresh tokens are revoked;
 * - one new refresh token is created.
 *
 * Changing the UUID ensures old access tokens never become
 * valid again after a new login.
 */
export async function createOrReuseDeviceSession(
  data: CreateOrReuseDeviceSessionData,
) {
  return prisma.$transaction(async (transaction) => {
    const now = new Date();

    const sessionUuid = randomUUID();

    const authSession = await transaction.authSession.upsert({
      where: {
        userId_deviceIdHash: {
          userId: data.userId,

          deviceIdHash: data.deviceIdHash,
        },
      },

      update: {
        uuid: sessionUuid,

        expiresAt: data.sessionExpiresAt,

        revokedAt: null,

        lastUsedAt: now,

        ...(data.deviceName !== undefined
          ? {
              deviceName: data.deviceName,
            }
          : {}),

        ...(data.ipAddress !== undefined
          ? {
              ipAddress: data.ipAddress,
            }
          : {}),

        ...(data.userAgent !== undefined
          ? {
              userAgent: data.userAgent,
            }
          : {}),
      },

      create: {
        uuid: sessionUuid,

        userId: data.userId,

        deviceIdHash: data.deviceIdHash,

        expiresAt: data.sessionExpiresAt,

        lastUsedAt: now,

        ...(data.deviceName !== undefined
          ? {
              deviceName: data.deviceName,
            }
          : {}),

        ...(data.ipAddress !== undefined
          ? {
              ipAddress: data.ipAddress,
            }
          : {}),

        ...(data.userAgent !== undefined
          ? {
              userAgent: data.userAgent,
            }
          : {}),
      },

      select: {
        id: true,
        uuid: true,
      },
    });

    /*
     * A new login invalidates every previous refresh
     * token for this same user/device session.
     */
    await transaction.refreshToken.updateMany({
      where: {
        authSessionId: authSession.id,

        revokedAt: null,
      },

      data: {
        revokedAt: now,
      },
    });

    await transaction.refreshToken.create({
      data: {
        authSessionId: authSession.id,

        tokenHash: data.refreshTokenHash,

        expiresAt: data.refreshTokenExpiresAt,
      },

      select: {
        id: true,
      },
    });

    return authSession;
  });
}

/**
 * Used by authentication middleware.
 *
 * The query succeeds only when:
 * - JWT sid belongs to the specified user;
 * - the session is active;
 * - the session is not expired.
 */
export function findActiveAuthenticatedSession(
  userId: bigint,
  sessionUuid: string,
) {
  return prisma.authSession.findFirst({
    where: {
      uuid: sessionUuid,

      userId,

      revokedAt: null,

      expiresAt: {
        gt: new Date(),
      },
    },

    select: {
      id: true,
      uuid: true,
      expiresAt: true,
      revokedAt: true,

      user: {
        select: {
          id: true,
          uuid: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          deletedAt: true,
        },
      },
    },
  });
}

export function findRefreshTokenByHash(tokenHash: string) {
  return prisma.refreshToken.findUnique({
    where: {
      tokenHash,
    },

    select: {
      id: true,
      authSessionId: true,
      expiresAt: true,
      revokedAt: true,
      replacedById: true,

      authSession: {
        select: {
          id: true,
          uuid: true,
          userId: true,
          expiresAt: true,
          revokedAt: true,

          user: {
            select: {
              id: true,
              uuid: true,
              name: true,
              email: true,
              role: true,
              isActive: true,
              deletedAt: true,
            },
          },
        },
      },
    },
  });
}

export type CreateRefreshTokenData = {
  authSessionId: bigint;
  tokenHash: string;
  expiresAt: Date;
};

/**
 * Rotates a refresh token while preserving the parent
 * AuthSession.
 */
export async function rotateRefreshToken(
  currentTokenId: bigint,
  replacementData: CreateRefreshTokenData,
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    const now = new Date();

    const replacementToken = await transaction.refreshToken.create({
      data: {
        authSessionId: replacementData.authSessionId,

        tokenHash: replacementData.tokenHash,

        expiresAt: replacementData.expiresAt,
      },

      select: {
        id: true,
      },
    });

    /*
     * updateMany provides a conditional update.
     * Only one concurrent refresh request can rotate
     * the current token successfully.
     */
    const updateResult = await transaction.refreshToken.updateMany({
      where: {
        id: currentTokenId,

        authSessionId: replacementData.authSessionId,

        revokedAt: null,

        replacedById: null,

        expiresAt: {
          gt: now,
        },

        authSession: {
          revokedAt: null,

          expiresAt: {
            gt: now,
          },
        },
      },

      data: {
        revokedAt: now,

        lastUsedAt: now,

        replacedById: replacementToken.id,
      },
    });

    if (updateResult.count !== 1) {
      throw new Error("REFRESH_TOKEN_ROTATION_CONFLICT");
    }

    await transaction.authSession.update({
      where: {
        id: replacementData.authSessionId,
      },

      data: {
        lastUsedAt: now,
      },
    });
  });
}

/**
 * Revokes one session and all its active refresh tokens.
 */
export async function revokeAuthSessionById(
  authSessionId: bigint,
): Promise<void> {
  const now = new Date();

  await prisma.$transaction(async (transaction) => {
    await transaction.authSession.updateMany({
      where: {
        id: authSessionId,

        revokedAt: null,
      },

      data: {
        revokedAt: now,
      },
    });

    await transaction.refreshToken.updateMany({
      where: {
        authSessionId,

        revokedAt: null,
      },

      data: {
        revokedAt: now,
      },
    });
  });
}

/**
 * Normal logout:
 * find the session through the refresh-token hash,
 * then revoke that session and its active refresh tokens.
 *
 * Unknown or already removed tokens result in a harmless
 * no-op, making logout idempotent.
 */
export async function revokeAuthSessionByRefreshTokenHash(
  tokenHash: string,
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    const storedToken = await transaction.refreshToken.findUnique({
      where: {
        tokenHash,
      },

      select: {
        authSessionId: true,
      },
    });

    if (storedToken === null) {
      return;
    }

    const now = new Date();

    await transaction.authSession.updateMany({
      where: {
        id: storedToken.authSessionId,

        revokedAt: null,
      },

      data: {
        revokedAt: now,
      },
    });

    await transaction.refreshToken.updateMany({
      where: {
        authSessionId: storedToken.authSessionId,

        revokedAt: null,
      },

      data: {
        revokedAt: now,
      },
    });
  });
}

/**
 * Logout-all:
 * revoke every session and refresh token belonging to the
 * authenticated user.
 */
export async function revokeAllUserAuthSessions(userId: bigint): Promise<void> {
  const now = new Date();

  await prisma.$transaction(async (transaction) => {
    await transaction.authSession.updateMany({
      where: {
        userId,

        revokedAt: null,
      },

      data: {
        revokedAt: now,
      },
    });

    await transaction.refreshToken.updateMany({
      where: {
        authSession: {
          userId,
        },

        revokedAt: null,
      },

      data: {
        revokedAt: now,
      },
    });
  });
}
