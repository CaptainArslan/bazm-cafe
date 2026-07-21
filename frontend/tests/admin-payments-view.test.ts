import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as adminPaymentsApi from "../src/api/admin-payments";
import * as staffOrdersApi from "../src/api/staff-orders";
import PaymentsView from "../src/views/admin/PaymentsView.vue";
import { OrderStatus, OrderPaymentStatus, PaymentMethod, PaymentStatus } from "../src/types/enums";

function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: "pay1", paymentNumber: "PAY-1", orderId: "o1", amount: "50.00", method: PaymentMethod.CASH,
    status: PaymentStatus.COMPLETED, reference: null, notes: null, paidAt: "2026-07-20T00:00:00.000Z",
    voidedAt: null, voidReason: null, createdAt: "2026-07-20T00:00:00.000Z", ...overrides,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("admin PaymentsView", () => {
  it("loads and renders the payments list", async () => {
    vi.spyOn(adminPaymentsApi, "listAdminPayments").mockResolvedValue({ payments: [makePayment() as never] });
    const wrapper = mount(PaymentsView);
    await flushPromises();
    expect(wrapper.text()).toContain("PAY-1");
  });

  it("reverses a payment with a reason", async () => {
    vi.spyOn(adminPaymentsApi, "listAdminPayments").mockResolvedValue({ payments: [makePayment() as never] });
    const reverseSpy = vi
      .spyOn(adminPaymentsApi, "reversePayment")
      .mockResolvedValue({ payment: makePayment({ status: PaymentStatus.REFUNDED }) as never, order: {} as never });

    const wrapper = mount(PaymentsView);
    await flushPromises();

    await wrapper.get('[data-test="reverse-pay1"]').trigger("click");
    await wrapper.get("textarea").setValue("Customer disputed charge");
    await wrapper.get('[data-test="confirm"]').trigger("click");
    await flushPromises();

    expect(reverseSpy).toHaveBeenCalledWith("pay1", "Customer disputed charge");
  });

  it("disables reverse for an already-voided payment", async () => {
    vi.spyOn(adminPaymentsApi, "listAdminPayments").mockResolvedValue({
      payments: [makePayment({ voidedAt: "2026-07-20T02:00:00.000Z" }) as never],
    });
    const wrapper = mount(PaymentsView);
    await flushPromises();
    expect(wrapper.find('[data-test="reverse-pay1"]').attributes("disabled")).toBeDefined();
  });

  it("records a payment for a SERVED unpaid order", async () => {
    vi.spyOn(adminPaymentsApi, "listAdminPayments").mockResolvedValue({ payments: [] });
    vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({
      orders: [{ id: "o1", orderNumber: "ORD-o1", orderStatus: OrderStatus.SERVED, paymentStatus: OrderPaymentStatus.UNPAID, remainingAmount: "100.00" } as never],
    });
    const recordSpy = vi
      .spyOn(adminPaymentsApi, "recordPayment")
      .mockResolvedValue({ payment: makePayment() as never, order: {} as never, duplicated: false, sessionClosed: false, receiptRawToken: null });

    const wrapper = mount(PaymentsView);
    await flushPromises();

    await wrapper.get('[data-test="new-payment"]').trigger("click");
    await wrapper.get('[data-test="field-order"]').setValue("o1");
    await wrapper.get('[data-test="field-amount"]').setValue("100");
    await wrapper.get('[data-test="field-method"]').setValue("CASH");
    await wrapper.get('[data-test="dialog-save"]').trigger("click");
    await flushPromises();

    expect(recordSpy).toHaveBeenCalledWith("o1", expect.objectContaining({ amount: 100, method: "CASH" }));
  });
});
