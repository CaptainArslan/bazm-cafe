import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toSafeOrder } from "../../src/modules/orders/order.service.js";
import { CustomerType, OrderStatus, OrderPaymentStatus, PaymentStatus } from "../../src/generated/prisma/enums.js";
import { Prisma } from "../../src/generated/prisma/client.js";

function baseOrder(overrides: Partial<Parameters<typeof toSafeOrder>[0]> = {}) {
  return {
    uuid: "order-uuid-1",
    orderNumber: "ORD-1",
    billNumber: "BILL-1",
    customerType: CustomerType.DINE_IN,
    status: OrderStatus.PENDING,
    paymentStatus: OrderPaymentStatus.UNPAID,
    customerName: null,
    customerPhone: null,
    subtotal: new Prisma.Decimal("100.00"),
    taxAmount: new Prisma.Decimal("0.00"),
    serviceChargeAmount: new Prisma.Decimal("0.00"),
    discountAmount: new Prisma.Decimal("0.00"),
    totalAmount: new Prisma.Decimal("100.00"),
    estimatedReadyAt: null,
    customerNotes: null,
    rejectionReason: null,
    cancellationReason: null,
    receiptImagePath: null,
    acceptedAt: null,
    preparingAt: null,
    readyAt: null,
    servedAt: null,
    completedAt: null,
    rejectedAt: null,
    cancelledAt: null,
    createdAt: new Date("2026-07-20T00:00:00.000Z"),
    updatedAt: new Date("2026-07-20T00:00:00.000Z"),
    restaurantTable: null,
    customer: null,
    guestSession: undefined,
    items: [],
    payments: [],
    ...overrides,
  };
}

describe("toSafeOrder guestSessionId mapping", () => {
  it("includes the guest session uuid when a guestSession relation is present", () => {
    const safe = toSafeOrder(baseOrder({ guestSession: { uuid: "session-uuid-42" } }));
    assert.equal(safe.guestSessionId, "session-uuid-42");
  });

  it("is null when there is no guestSession relation (e.g. a TAKEAWAY order)", () => {
    const safe = toSafeOrder(
      baseOrder({ customerType: CustomerType.TAKEAWAY, guestSession: undefined }),
    );
    assert.equal(safe.guestSessionId, null);
  });
});
