export const ORDER_MESSAGES = {
  NOT_FOUND: "Order not found.",
  INVALID_TRANSITION: "This order status transition is not allowed.",
  CUSTOMER_REQUIRED: "A customer must be attached before serving a dine-in order.",
  REJECTION_REASON_REQUIRED: "A rejection reason is required.",
  CANCELLATION_REASON_REQUIRED: "A cancellation reason is required.",
  INSUFFICIENT_STOCK: "One or more products do not have enough available stock.",
  PRODUCT_UNAVAILABLE: "One or more products are unavailable.",
  SESSION_INACTIVE: "The guest session cannot submit orders.",
  FORBIDDEN_GUEST_ORDER: "You cannot access this order.",
} as const;
