// frontend/tests/staff-orders-store.test.ts
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as staffOrdersApi from "../src/api/staff-orders";
import { useStaffOrdersStore } from "../src/stores/staff-orders.store";
import { OrderStatus, OrderPaymentStatus } from "../src/types/enums";
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
    customerName: null,
    customerPhone: null,
    guestSessionId: "s1",
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

describe("staff orders store", () => {
  it("fetchOrders stores the result and remembers the filters used", async () => {
    vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({ orders: [makeOrder()] });
    const store = useStaffOrdersStore();

    await store.fetchOrders({ status: OrderStatus.PENDING });

    expect(store.orders).toHaveLength(1);
    expect(store.activeFilters).toEqual({ status: OrderStatus.PENDING });
  });

  it("refetchCurrentFilters re-runs the last fetch with the same filters", async () => {
    const listSpy = vi
      .spyOn(staffOrdersApi, "listStaffOrders")
      .mockResolvedValue({ orders: [makeOrder()] });
    const store = useStaffOrdersStore();
    await store.fetchOrders({ paymentStatus: OrderPaymentStatus.UNPAID });

    await store.refetchCurrentFilters();

    expect(listSpy).toHaveBeenCalledTimes(2);
    expect(listSpy).toHaveBeenLastCalledWith({ paymentStatus: OrderPaymentStatus.UNPAID });
  });

  it("accept updates the order in place after the server responds", async () => {
    vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({ orders: [makeOrder()] });
    vi.spyOn(staffOrdersApi, "acceptOrder").mockResolvedValue({
      order: makeOrder({ orderStatus: OrderStatus.ACCEPTED }),
    });
    const store = useStaffOrdersStore();
    await store.fetchOrders();

    await store.accept("o1");

    expect(store.orders[0].orderStatus).toBe(OrderStatus.ACCEPTED);
  });

  it("reject sends the reason and updates the order", async () => {
    const rejectSpy = vi
      .spyOn(staffOrdersApi, "rejectOrder")
      .mockResolvedValue({ order: makeOrder({ orderStatus: OrderStatus.REJECTED, rejectionReason: "Out of stock" }) });
    const store = useStaffOrdersStore();

    await store.reject("o1", "Out of stock");

    expect(rejectSpy).toHaveBeenCalledWith("o1", "Out of stock");
    expect(store.orders[0].orderStatus).toBe(OrderStatus.REJECTED);
  });

  it("attachCustomer updates the order with the returned customer info", async () => {
    vi.spyOn(staffOrdersApi, "attachCustomerToOrder").mockResolvedValue({
      order: makeOrder({ customerId: "c1", customerName: "Ali" }),
    });
    const store = useStaffOrdersStore();

    await store.attachCustomer("o1", { customerId: "c1" });

    expect(store.orders[0].customerName).toBe("Ali");
  });

  it("fetchOrder upserts a single order without touching the rest of the list", async () => {
    vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({
      orders: [makeOrder({ id: "o1" }), makeOrder({ id: "o2" })],
    });
    vi.spyOn(staffOrdersApi, "getStaffOrder").mockResolvedValue({
      order: makeOrder({ id: "o2", orderStatus: OrderStatus.READY }),
    });
    const store = useStaffOrdersStore();
    await store.fetchOrders();

    await store.fetchOrder("o2");

    expect(store.orders).toHaveLength(2);
    expect(store.orders.find((o) => o.id === "o2")?.orderStatus).toBe(OrderStatus.READY);
  });
});
