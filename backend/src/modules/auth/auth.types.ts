import type { UserRole } from "../../generated/prisma/enums.js";

export type AccessTokenClaims = {
  sub: string;
  sid: string;
  role: UserRole;
};

export type AuthenticatedUser = {
  databaseId: bigint;
  sessionDatabaseId: bigint;
  sessionId: string;

  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type SessionContext = {
  deviceId: string;
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;
};

export type LoginResult = {
  accessToken: string;
  refreshToken: string;
  user: SafeUser;
};

export type RefreshResult = LoginResult;
