// frontend/tests/admin-orders-view.test.ts
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as staffOrdersApi from "../src/api/staff-orders";
import OrdersView from "../src/views/admin/OrdersView.vue";
import { OrderStatus, OrderPaymentStatus } from "../src/types/enums";

function makeOrder(id: string, status: OrderStatus) {
  return {
    id, orderNumber: `ORD-${id}`, billNumber: `BILL-${id}`, orderType: "DINE_IN", orderStatus: status,
    paymentStatus: OrderPaymentStatus.UNPAID, tableId: "t1", tableNumber: "5", customerId: null,
    customerName: null, customerPhone: null, guestSessionId: "s1", subtotal: "100.00", taxAmount: "0.00",
    serviceChargeAmount: "0.00", discountAmount: "0.00", totalAmount: "100.00", paidAmount: "0.00",
    remainingAmount: "100.00", estimatedPreparationMinutes: 10, estimatedReadyAt: null, customerNotes: null,
    rejectionReason: null, cancellationReason: null, receiptImagePath: null, receiptImageUrl: null, items: [],
    acceptedAt: null, preparingAt: null, readyAt: null, servedAt: null, completedAt: null, rejectedAt: null,
    cancelledAt: null, createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T00:00:00.000Z",
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("admin OrdersView", () => {
  it("loads and renders the order queue", async () => {
    vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({ orders: [makeOrder("o1", OrderStatus.PENDING) as never] });
    const wrapper = mount(OrdersView);
    await flushPromises();
    expect(wrapper.text()).toContain("ORD-o1");
  });

  it("shows a Cancel action for an ACCEPTED order and cancels with a reason", async () => {
    vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({ orders: [makeOrder("o1", OrderStatus.ACCEPTED) as never] });
    const cancelSpy = vi
      .spyOn(staffOrdersApi, "cancelOrder")
      .mockResolvedValue({ order: makeOrder("o1", OrderStatus.CANCELLED) as never });

    const wrapper = mount(OrdersView);
    await flushPromises();

    await wrapper.get('[data-test="open-order-o1"]').trigger("click");
    await wrapper.get('[data-test="cancel-order"]').trigger("click");
    await wrapper.get("textarea").setValue("Table double-booked");
    await wrapper.get('[data-test="confirm"]').trigger("click");
    await flushPromises();

    expect(cancelSpy).toHaveBeenCalledWith("o1", "Table double-booked");
  });

  it("does not show a Cancel action for a PENDING order", async () => {
    vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({ orders: [makeOrder("o1", OrderStatus.PENDING) as never] });
    const wrapper = mount(OrdersView);
    await flushPromises();

    await wrapper.get('[data-test="open-order-o1"]').trigger("click");
    expect(wrapper.find('[data-test="cancel-order"]').exists()).toBe(false);
  });
});
