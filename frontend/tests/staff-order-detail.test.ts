import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureAuthIntegration } from "../src/api/http";
import * as staffOrdersApi from "../src/api/staff-orders";
import * as staffGuestSessionsApi from "../src/api/staff-guest-sessions";
import OrderDetailView from "../src/views/staff/OrderDetailView.vue";
import { useStaffOrdersStore } from "../src/stores/staff-orders.store";
import { OrderStatus, OrderPaymentStatus } from "../src/types/enums";
import router from "../src/router";

// Note: jsdom already implements URL.createObjectURL, so no stub is needed here for
// the receipt-viewing tests below.

function makeOrder(overrides: Record<string, unknown> = {}) {
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
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  configureAuthIntegration({ getToken: () => null, refresh: () => Promise.resolve(null), onUnauthorized: () => {} });
});

describe("OrderDetailView", () => {
  it("shows Accept and Reject for a PENDING order and accepts on click", async () => {
    vi.spyOn(staffOrdersApi, "getStaffOrder").mockResolvedValue({ order: makeOrder() as never });
    const acceptSpy = vi
      .spyOn(staffOrdersApi, "acceptOrder")
      .mockResolvedValue({ order: makeOrder({ orderStatus: OrderStatus.ACCEPTED }) as never });
    // router.isReady() only resolves once an initial navigation has completed; without a preceding
    // push it never settles (mount()'s app.use(router) would trigger one, but that happens after
    // this await, so isReady() must be given a navigation to wait on first — see login-flow.test.ts).
    await router.push("/");
    await router.isReady();

    const wrapper = mount(OrderDetailView, { props: { orderId: "o1" }, global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.text()).toContain("Accept");
    expect(wrapper.text()).toContain("Reject");

    await wrapper.find("[data-test='accept']").trigger("click");
    await flushPromises();

    expect(acceptSpy).toHaveBeenCalledWith("o1");
  });

  it("rejecting opens the reason dialog and submits the reason", async () => {
    vi.spyOn(staffOrdersApi, "getStaffOrder").mockResolvedValue({ order: makeOrder() as never });
    const rejectSpy = vi
      .spyOn(staffOrdersApi, "rejectOrder")
      .mockResolvedValue({ order: makeOrder({ orderStatus: OrderStatus.REJECTED }) as never });
    await router.isReady();

    const wrapper = mount(OrderDetailView, { props: { orderId: "o1" }, global: { plugins: [router] } });
    await flushPromises();

    await wrapper.find("[data-test='reject']").trigger("click");
    await wrapper.find("textarea").setValue("Kitchen is out of this item");
    await wrapper.find("[data-test='confirm']").trigger("click");
    await flushPromises();

    expect(rejectSpy).toHaveBeenCalledWith("o1", "Kitchen is out of this item");
  });

  it("disables Mark Served for a DINE_IN READY order with no attached customer", async () => {
    vi.spyOn(staffOrdersApi, "getStaffOrder").mockResolvedValue({
      order: makeOrder({ orderStatus: OrderStatus.READY, customerId: null }) as never,
    });
    await router.isReady();

    const wrapper = mount(OrderDetailView, { props: { orderId: "o1" }, global: { plugins: [router] } });
    await flushPromises();

    const button = wrapper.find("[data-test='mark-served']");
    expect((button.element as HTMLButtonElement).disabled).toBe(true);
  });

  it("generates and displays a recovery code for a DINE_IN order", async () => {
    vi.spyOn(staffOrdersApi, "getStaffOrder").mockResolvedValue({ order: makeOrder() as never });
    vi.spyOn(staffGuestSessionsApi, "generateRecoveryCode").mockResolvedValue({
      recoveryCode: "ABC123",
      expiresAt: "2026-07-20T00:05:00.000Z",
    });
    await router.isReady();

    const wrapper = mount(OrderDetailView, { props: { orderId: "o1" }, global: { plugins: [router] } });
    await flushPromises();

    await wrapper.find("[data-test='generate-recovery-code']").trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("ABC123");
  });

  it("fetches the receipt with a bearer token and opens it in a new window", async () => {
    vi.spyOn(staffOrdersApi, "getStaffOrder").mockResolvedValue({ order: makeOrder() as never });
    configureAuthIntegration({
      getToken: () => "test-token",
      refresh: () => Promise.resolve(null),
      onUnauthorized: () => {},
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve("<html>Receipt</html>") }),
    );
    const openSpy = vi.spyOn(window, "open").mockReturnValue({} as Window);
    await router.isReady();

    const wrapper = mount(OrderDetailView, { props: { orderId: "o1" }, global: { plugins: [router] } });
    await flushPromises();

    await wrapper.find("[data-test='view-receipt']").trigger("click");
    await flushPromises();

    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/orders/o1/receipt");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(openSpy).toHaveBeenCalledWith(expect.stringMatching(/^blob:/), "_blank", "noopener");
    expect(wrapper.text()).not.toContain("Please allow pop-ups");
  });

  it("recovers the order after a filtered socket refetch drops it from the store's list", async () => {
    const getStaffOrderSpy = vi
      .spyOn(staffOrdersApi, "getStaffOrder")
      .mockResolvedValue({ order: makeOrder({ orderStatus: OrderStatus.READY }) as never });
    const listStaffOrdersSpy = vi
      .spyOn(staffOrdersApi, "listStaffOrders")
      .mockResolvedValue({ orders: [] as never });
    await router.isReady();

    const wrapper = mount(OrderDetailView, { props: { orderId: "o1" }, global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.text()).toContain("ORD-1");
    expect(getStaffOrderSpy).toHaveBeenCalledTimes(1);

    // Simulate the socket store's `refetchCurrentFilters()` running under a queue filter
    // (e.g. "Pending") that this now-READY order no longer matches — this replaces the
    // whole `orders` list and would normally drop the order the detail view is showing.
    const staffOrdersStore = useStaffOrdersStore();
    await staffOrdersStore.fetchOrders({ status: OrderStatus.PENDING });
    await flushPromises();

    expect(listStaffOrdersSpy).toHaveBeenCalled();
    // The view should have re-fetched this single order rather than flashing "not found".
    expect(getStaffOrderSpy).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).not.toContain("Order not found");
    expect(wrapper.text()).toContain("ORD-1");
  });

  it("surfaces an error when the browser blocks the receipt pop-up", async () => {
    vi.spyOn(staffOrdersApi, "getStaffOrder").mockResolvedValue({ order: makeOrder() as never });
    configureAuthIntegration({
      getToken: () => "test-token",
      refresh: () => Promise.resolve(null),
      onUnauthorized: () => {},
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve("<html>Receipt</html>") }),
    );
    vi.spyOn(window, "open").mockReturnValue(null);
    await router.isReady();

    const wrapper = mount(OrderDetailView, { props: { orderId: "o1" }, global: { plugins: [router] } });
    await flushPromises();

    await wrapper.find("[data-test='view-receipt']").trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Please allow pop-ups to view the receipt.");
  });

  it("shows the rejection reason for a REJECTED order", async () => {
    vi.spyOn(staffOrdersApi, "getStaffOrder").mockResolvedValue({
      order: makeOrder({ orderStatus: OrderStatus.REJECTED, rejectionReason: "Out of stock" }) as never,
    });
    await router.isReady();

    const wrapper = mount(OrderDetailView, { props: { orderId: "o1" }, global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.text()).toContain("Rejected: Out of stock");
  });

  it("shows the cancellation reason for a CANCELLED order", async () => {
    vi.spyOn(staffOrdersApi, "getStaffOrder").mockResolvedValue({
      order: makeOrder({ orderStatus: OrderStatus.CANCELLED, cancellationReason: "Customer no-show" }) as never,
    });
    await router.isReady();

    const wrapper = mount(OrderDetailView, { props: { orderId: "o1" }, global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.text()).toContain("Cancelled: Customer no-show");
  });
});
