export const AUTH_CONSTANTS = {
  ACCESS_TOKEN_ALGORITHM: "HS256",
  REFRESH_COOKIE_NAME: "bazm_refresh_token",
  REFRESH_COOKIE_PATH: "/api/v1/auth",
  DEVICE_COOKIE_NAME: "bazm_device_id",
  DEVICE_COOKIE_PATH: "/",
  DEVICE_COOKIE_MAX_AGE_DAYS: 365,
  OPAQUE_TOKEN_BYTES: 32,
  MAX_FAILED_LOGIN_ATTEMPTS: 5,
  ACCOUNT_LOCK_MINUTES: 15,
} as const;

export const AUTH_MESSAGES = {
  INVALID_CREDENTIALS: "Invalid email or password.",
  ACCOUNT_UNAVAILABLE: "This account is unavailable.",
  ACCOUNT_LOCKED: "Too many failed login attempts. Please try again later.",
  AUTHENTICATION_REQUIRED: "Authentication is required.",
  INVALID_ACCESS_TOKEN: "The access token is invalid or expired.",
  INVALID_REFRESH_TOKEN: "The refresh token is invalid or expired.",
  FORBIDDEN: "You do not have permission to perform this action.",
} as const;
