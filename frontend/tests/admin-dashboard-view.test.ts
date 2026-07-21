import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as staffOrdersApi from "../src/api/staff-orders";
import * as adminPaymentsApi from "../src/api/admin-payments";
import * as adminProductsApi from "../src/api/admin-products";
import DashboardView from "../src/views/admin/DashboardView.vue";
import { OrderPaymentStatus, OrderStatus, PaymentMethod, PaymentStatus } from "../src/types/enums";

function makeOrder(id: string, status: OrderStatus, createdAt: string) {
  return {
    id,
    orderNumber: `ORD-${id}`,
    billNumber: `BILL-${id}`,
    orderType: "DINE_IN",
    orderStatus: status,
    paymentStatus: OrderPaymentStatus.UNPAID,
    tableId: null,
    tableNumber: null,
    customerId: null,
    guestSessionId: null,
    customerName: null,
    customerPhone: null,
    subtotal: "0.00",
    taxAmount: "0.00",
    serviceChargeAmount: "0.00",
    discountAmount: "0.00",
    totalAmount: "0.00",
    paidAmount: "0.00",
    remainingAmount: "0.00",
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
    createdAt,
    updatedAt: createdAt,
  } as never;
}

function makePayment(id: string, amount: string, status: string, createdAt: string, voidedAt: string | null = null) {
  return {
    id,
    paymentNumber: `PAY-${id}`,
    orderId: "o1",
    amount,
    method: PaymentMethod.CASH,
    status,
    reference: null,
    notes: null,
    paidAt: createdAt,
    voidedAt,
    voidReason: null,
    createdAt,
  } as never;
}

function makeProduct(id: string, availableQuantity: number, lowStockThreshold: number) {
  return {
    id,
    categoryId: "c1",
    categoryName: "Drinks",
    name: `Product ${id}`,
    slug: `product-${id}`,
    description: null,
    imagePath: null,
    price: "1.00",
    preparationMinutes: 5,
    stockQuantity: availableQuantity,
    reservedQuantity: 0,
    availableQuantity,
    lowStockThreshold,
    trackStock: true,
    isAvailable: true,
    displayOrder: 0,
    createdAt: "2026-07-21T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z",
  } as never;
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-21T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("admin DashboardView", () => {
  it("computes and renders all four stat tiles from fetched data", async () => {
    vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({
      orders: [
        makeOrder("o1", OrderStatus.PENDING, "2026-07-21T09:00:00.000Z"),
        makeOrder("o2", OrderStatus.ACCEPTED, "2026-07-20T09:00:00.000Z"),
        makeOrder("o3", OrderStatus.COMPLETED, "2026-07-21T10:00:00.000Z"),
      ],
    });
    vi.spyOn(adminPaymentsApi, "listAdminPayments").mockResolvedValue({
      payments: [
        makePayment("p1", "50.00", PaymentStatus.COMPLETED, "2026-07-21T09:30:00.000Z"),
        makePayment("p2", "20.00", PaymentStatus.COMPLETED, "2026-07-20T09:30:00.000Z"),
        makePayment("p3", "15.00", PaymentStatus.COMPLETED, "2026-07-21T09:45:00.000Z", "2026-07-21T09:50:00.000Z"),
      ],
    });
    vi.spyOn(adminProductsApi, "listAdminProducts").mockResolvedValue({
      products: [makeProduct("prod1", 2, 5), makeProduct("prod2", 10, 5)],
    });

    const wrapper = mount(DashboardView);
    await flushPromises();

    // 2 orders created today (o1, o3) — o2 was yesterday.
    expect(wrapper.get('[data-test="tile-todays-orders"]').text()).toContain("2");
    // PENDING (o1) + ACCEPTED (o2) = 2, regardless of date.
    expect(wrapper.get('[data-test="tile-needs-attention"]').text()).toContain("2");
    // Only p1 is COMPLETED, not voided, and created today: 50.00. p2 is yesterday, p3 is voided.
    expect(wrapper.get('[data-test="tile-todays-revenue"]').text()).toContain("50.00");
    // Only prod1 (availableQuantity 2 <= lowStockThreshold 5) counts as low stock.
    expect(wrapper.get('[data-test="tile-low-stock"]').text()).toContain("1");
  });

  it("shows an error state and retries all three fetches on retry click", async () => {
    const ordersSpy = vi
      .spyOn(staffOrdersApi, "listStaffOrders")
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ orders: [] });
    vi.spyOn(adminPaymentsApi, "listAdminPayments").mockResolvedValue({ payments: [] });
    vi.spyOn(adminProductsApi, "listAdminProducts").mockResolvedValue({ products: [] });

    const wrapper = mount(DashboardView);
    await flushPromises();

    expect(wrapper.text()).toContain("Couldn't reach the server");

    await wrapper.get("button").trigger("click");
    await flushPromises();

    expect(ordersSpy).toHaveBeenCalledTimes(2);
    expect(wrapper.get('[data-test="tile-todays-orders"]').text()).toContain("0");
  });
});
