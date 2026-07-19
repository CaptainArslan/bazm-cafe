export const TABLE_MESSAGES = {
  NOT_FOUND: "Table not found.",
  NUMBER_EXISTS: "A table with this number already exists.",
  HAS_ACTIVE_SESSION: "This table currently has an active guest session.",
  NO_ACTIVE_SESSION: "This table does not have an active guest session.",
  SESSION_NOT_RELEASABLE:
    "This session cannot be released yet. Outstanding orders or balances must be settled first.",
  FORCE_REASON_REQUIRED: "A reason is required to force-release a table.",
} as const;

