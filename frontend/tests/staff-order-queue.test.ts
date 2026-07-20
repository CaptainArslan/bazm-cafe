import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as staffOrdersApi from "../src/api/staff-orders";
import OrderQueueView from "../src/views/staff/OrderQueueView.vue";
import { OrderStatus, OrderPaymentStatus } from "../src/types/enums";
import router from "../src/router";

function makeOrder(id: string, status: OrderStatus) {
  return {
    id,
    orderNumber: `ORD-${id}`,
    billNumber: `BILL-${id}`,
    orderType: "DINE_IN",
    orderStatus: status,
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
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("OrderQueueView", () => {
  it("loads and renders orders on mount", async () => {
    vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({
      orders: [makeOrder("o1", OrderStatus.PENDING) as never],
    });
    await router.isReady();

    const wrapper = mount(OrderQueueView, { global: { plugins: [router] } });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.text()).toContain("ORD-o1");
  });

  it("refetches with a status filter when a chip is clicked", async () => {
    const listSpy = vi
      .spyOn(staffOrdersApi, "listStaffOrders")
      .mockResolvedValue({ orders: [] });
    await router.isReady();
    const wrapper = mount(OrderQueueView, { global: { plugins: [router] } });
    await new Promise((resolve) => setTimeout(resolve, 0));

    await wrapper.find("[data-test='filter-PENDING']").trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(listSpy).toHaveBeenLastCalledWith({ status: OrderStatus.PENDING });
  });

  it("shows an empty state when there are no orders", async () => {
    vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({ orders: [] });
    await router.isReady();

    const wrapper = mount(OrderQueueView, { global: { plugins: [router] } });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.text()).toMatch(/no orders/i);
  });
});
