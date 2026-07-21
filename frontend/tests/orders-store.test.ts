import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as ordersApi from "../src/api/orders";
import { useOrdersStore } from "../src/stores/orders.store";
import { OrderPaymentStatus, OrderStatus } from "../src/types/enums";
import type { SafeOrder } from "../src/types/order";

function makeOrder(overrides: Partial<SafeOrder> = {}): SafeOrder {
  return {
    id: "o1",
    orderNumber: "ORD-1",
    billNumber: "BILL-1",
    orderType: "DINE_IN",
    orderStatus: OrderStatus.PENDING,
    paymentStatus: OrderPaymentStatus.UNPAID,
    tableId: "t1",
    tableNumber: "5",
    customerId: null,
    guestSessionId: "s1",
    customerName: null,
    customerPhone: null,
    subtotal: "100.00",
    taxAmount: "0.00",
    serviceChargeAmount: "0.00",
    discountAmount: "0.00",
    totalAmount: "100.00",
    paidAmount: "0.00",
    remainingAmount: "100.00",
    estimatedPreparationMinutes: 10,
    estimatedReadyAt: null,
    customerNotes: null,
    rejectionReason: null,
    cancellationReason: null,
    receiptImagePath: null,
    receiptImageUrl: null,
    items: [],
    acceptedAt: null,
    preparingAt: null,
    readyAt: null,
    servedAt: null,
    completedAt: null,
    rejectedAt: null,
    cancelledAt: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  } as SafeOrder;
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("orders store outstandingBalance", () => {
  it("sums remainingAmount across all orders", async () => {
    vi.spyOn(ordersApi, "listGuestOrders").mockResolvedValue({
      orders: [
        makeOrder({ id: "o1", remainingAmount: "50.00" }),
        makeOrder({ id: "o2", remainingAmount: "20.00" }),
      ],
    });
    const store = useOrdersStore();
    await store.fetchOrders();

    expect(store.outstandingBalance).toBe(70);
  });

  it("does not count a REJECTED order's remainingAmount toward the total (backend already zeroes it)", async () => {
    vi.spyOn(ordersApi, "listGuestOrders").mockResolvedValue({
      orders: [
        makeOrder({ id: "o1", orderStatus: OrderStatus.REJECTED, remainingAmount: "0.00" }),
        makeOrder({ id: "o2", orderStatus: OrderStatus.SERVED, remainingAmount: "200.00" }),
      ],
    });
    const store = useOrdersStore();
    await store.fetchOrders();

    expect(store.outstandingBalance).toBe(200);
  });
});
