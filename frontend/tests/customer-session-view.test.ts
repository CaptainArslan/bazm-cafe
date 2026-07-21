import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../src/api/http";
import * as ordersApi from "../src/api/orders";
import SessionView from "../src/views/customer/SessionView.vue";
import { useGuestSessionStore } from "../src/stores/guest-session.store";
import { OrderPaymentStatus, OrderStatus } from "../src/types/enums";
import type { SafeOrder } from "../src/types/order";
import router from "../src/router";

function makeOrder(overrides: Partial<SafeOrder> = {}): SafeOrder {
  return {
    id: "o1",
    orderNumber: "ORD-1",
    billNumber: "BILL-1",
    orderType: "DINE_IN",
    orderStatus: OrderStatus.PENDING,
    paymentStatus: OrderPaymentStatus.UNPAID,
    tableId: "t1",
    tableNumber: "A1",
    customerId: null,
    guestSessionId: "s1",
    customerName: null,
    customerPhone: null,
    subtotal: "50.00",
    taxAmount: "0.00",
    serviceChargeAmount: "0.00",
    discountAmount: "0.00",
    totalAmount: "50.00",
    paidAmount: "0.00",
    remainingAmount: "50.00",
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

describe("customer SessionView end-session blocking", () => {
  it("does not count a REJECTED order as blocking, only the still-owing SERVED order", async () => {
    vi.spyOn(ordersApi, "listGuestOrders").mockResolvedValue({
      orders: [
        makeOrder({ id: "o1", orderStatus: OrderStatus.REJECTED, remainingAmount: "0.00" }),
        makeOrder({ id: "o2", orderStatus: OrderStatus.SERVED, remainingAmount: "200.00" }),
      ],
    });

    const guestSessionStore = useGuestSessionStore();
    vi.spyOn(guestSessionStore, "endSession").mockRejectedValue(
      new ApiError(409, "Session cannot be released yet.", { code: "SESSION_NOT_RELEASABLE" }),
    );

    await router.push("/session");
    await router.isReady();
    const wrapper = mount(SessionView, { global: { plugins: [router] } });
    await flushPromises();

    await wrapper.findAll("button").filter((b) => b.text() === "End Session")[0].trigger("click");
    const dialogButtons = wrapper.findAll("button").filter((b) => b.text() === "End Session");
    await dialogButtons[dialogButtons.length - 1].trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("1 order(s) still need to finish or be paid");
    expect(wrapper.text()).not.toContain("2 order(s)");
  });
});
