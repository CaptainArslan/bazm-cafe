// frontend/tests/admin-cancellations-view.test.ts
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as staffOrdersApi from "../src/api/staff-orders";
import CancellationsView from "../src/views/admin/CancellationsView.vue";
import { OrderStatus, OrderPaymentStatus } from "../src/types/enums";

function makeCancelledOrder() {
  return {
    id: "o1", orderNumber: "ORD-o1", billNumber: "BILL-o1", orderType: "DINE_IN", orderStatus: OrderStatus.CANCELLED,
    paymentStatus: OrderPaymentStatus.UNPAID, tableId: "t1", tableNumber: "5", customerId: null,
    customerName: null, customerPhone: null, guestSessionId: "s1", subtotal: "100.00", taxAmount: "0.00",
    serviceChargeAmount: "0.00", discountAmount: "0.00", totalAmount: "100.00", paidAmount: "0.00",
    remainingAmount: "0.00", estimatedPreparationMinutes: 10, estimatedReadyAt: null, customerNotes: null,
    rejectionReason: null, cancellationReason: "Table double-booked", receiptImagePath: null, receiptImageUrl: null,
    items: [], acceptedAt: "2026-07-20T00:00:00.000Z", preparingAt: null, readyAt: null, servedAt: null,
    completedAt: null, rejectedAt: null, cancelledAt: "2026-07-20T01:00:00.000Z",
    createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T01:00:00.000Z",
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("admin CancellationsView", () => {
  it("fetches only CANCELLED orders and shows the reason", async () => {
    const listSpy = vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({ orders: [makeCancelledOrder() as never] });

    const wrapper = mount(CancellationsView);
    await flushPromises();

    expect(listSpy).toHaveBeenCalledWith({ status: OrderStatus.CANCELLED });
    expect(wrapper.text()).toContain("ORD-o1");
    expect(wrapper.text()).toContain("Table double-booked");
  });

  it("has no action buttons — this is a read-only audit view", async () => {
    vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({ orders: [makeCancelledOrder() as never] });
    const wrapper = mount(CancellationsView);
    await flushPromises();
    expect(wrapper.findAll("button")).toHaveLength(0);
  });
});
