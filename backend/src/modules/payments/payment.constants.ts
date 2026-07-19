export const PAYMENT_MESSAGES = {
  NOT_FOUND: "Payment not found.",
  ORDER_NOT_SERVED: "Payments can only be recorded for served orders.",
  INVALID_AMOUNT:
    "Payment amount must be greater than zero and within the remaining balance.",
  FORBIDDEN: "Only administrators can record payments.",
  ALREADY_VOIDED: "This payment has already been reversed.",
  NOT_REVERSIBLE: "Only completed payments can be reversed.",
} as const;
