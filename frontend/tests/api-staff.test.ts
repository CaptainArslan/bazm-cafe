import { afterEach, describe, expect, it, vi } from "vitest";

import { configureAuthIntegration } from "../src/api/http";
import {
  acceptOrder,
  attachCustomerToOrder,
  cancelOrder,
  getStaffOrder,
  getStaffReceiptUrl,
  listStaffOrders,
  markOrderReady,
  markOrderServed,
  rejectOrder,
  startPreparingOrder,
} from "../src/api/staff-orders";
import { createCustomerRecord, getCustomerRecord, searchCustomers, updateCustomerRecord } from "../src/api/staff-customers";
import { generateRecoveryCode } from "../src/api/staff-guest-sessions";
import { getSettings } from "../src/api/settings";

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(body) }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  configureAuthIntegration({ getToken: () => null, refresh: () => Promise.resolve(null), onUnauthorized: () => {} });
});

describe("staff orders api", () => {
  it("listStaffOrders builds query params from filters and attaches the bearer token", async () => {
    configureAuthIntegration({ getToken: () => "tok", refresh: () => Promise.resolve(null), onUnauthorized: () => {} });
    mockFetchOnce({ success: true, message: "ok", data: { orders: [] } });

    await listStaffOrders({ status: "PENDING", paymentStatus: "UNPAID" });

    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/orders?status=PENDING&paymentStatus=UNPAID");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("listStaffOrders with no filters calls the bare endpoint", async () => {
    mockFetchOnce({ success: true, message: "ok", data: { orders: [] } });
    await listStaffOrders();
    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/orders");
    expect(url).not.toContain("?");
  });

  it("getStaffOrder calls GET /orders/:orderId", async () => {
    mockFetchOnce({ success: true, message: "ok", data: { order: { id: "o1" } } });
    await getStaffOrder("o1");
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/orders/o1");
    expect(init.method).toBe("GET");
  });

  it.each([
    ["accept", acceptOrder, "accept"],
    ["start-preparing", startPreparingOrder, "start-preparing"],
    ["mark-ready", markOrderReady, "mark-ready"],
    ["mark-served", markOrderServed, "mark-served"],
  ])("%s posts to /orders/:orderId/%s", async (_label, fn, segment) => {
    mockFetchOnce({ success: true, message: "ok", data: { order: { id: "o1" } } });
    await fn("o1");
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain(`/orders/o1/${segment}`);
    expect(init.method).toBe("POST");
  });

  it("rejectOrder posts the reason", async () => {
    mockFetchOnce({ success: true, message: "ok", data: { order: { id: "o1" } } });
    await rejectOrder("o1", "Kitchen is out of this item.");
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/orders/o1/reject");
    expect(JSON.parse(init.body)).toEqual({ reason: "Kitchen is out of this item." });
  });

  it("cancelOrder posts the reason to the cancel endpoint", async () => {
    mockFetchOnce({ success: true, message: "ok", data: { order: { id: "o1" } } });
    await cancelOrder("o1", "Table double-booked");
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/orders/o1/cancel");
    expect(JSON.parse(init.body)).toEqual({ reason: "Table double-booked" });
  });

  it("attachCustomerToOrder posts a customerId payload", async () => {
    mockFetchOnce({ success: true, message: "ok", data: { order: { id: "o1" } } });
    await attachCustomerToOrder("o1", { customerId: "c1" });
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/orders/o1/customer");
    expect(JSON.parse(init.body)).toEqual({ customerId: "c1" });
  });

  it("attachCustomerToOrder posts a name/phone payload", async () => {
    mockFetchOnce({ success: true, message: "ok", data: { order: { id: "o1" } } });
    await attachCustomerToOrder("o1", { name: "Ali", phone: "03001234567" });
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ name: "Ali", phone: "03001234567" });
  });

  it("getStaffReceiptUrl builds a URL without fetching", () => {
    expect(getStaffReceiptUrl("o1")).toContain("/orders/o1/receipt");
  });
});

describe("staff customers api", () => {
  it("searchCustomers passes the search query string", async () => {
    mockFetchOnce({ success: true, message: "ok", data: { customers: [] } });
    await searchCustomers({ search: "ali" });
    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/customers?search=ali");
  });

  it("getCustomerRecord fetches the detail with financial summary", async () => {
    mockFetchOnce({
      success: true,
      message: "ok",
      data: {
        customer: {
          id: "c1",
          summary: { orderCount: 2, unpaidOrderCount: 1, partiallyPaidOrderCount: 0, outstandingBalance: "50.00" },
        },
      },
    });

    const result = await getCustomerRecord("c1");

    expect(result.customer.summary.outstandingBalance).toBe("50.00");
    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/customers/c1");
  });

  it("createCustomerRecord posts name/phone and returns matchedByPhone", async () => {
    mockFetchOnce({ success: true, message: "ok", data: { customer: { id: "c1" }, matchedByPhone: [] } }, true, 201);

    const result = await createCustomerRecord({ name: "Ali", phone: "03001234567" });

    expect(result.matchedByPhone).toEqual([]);
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/customers");
    expect(init.method).toBe("POST");
  });

  it("updateCustomerRecord patches the given fields", async () => {
    mockFetchOnce({ success: true, message: "ok", data: { customer: { id: "c1" } } });

    await updateCustomerRecord("c1", { name: "Ali B" });

    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/customers/c1");
    expect(init.method).toBe("PATCH");
  });
});

describe("staff guest-sessions api", () => {
  it("generateRecoveryCode posts to the sessionId-scoped route", async () => {
    mockFetchOnce({ success: true, message: "ok", data: { recoveryCode: "ABC123", expiresAt: "2026-07-20T00:05:00.000Z" } });
    const result = await generateRecoveryCode("session-uuid-1");
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/guest-sessions/session-uuid-1/recovery-codes");
    expect(init.method).toBe("POST");
    expect(result.recoveryCode).toBe("ABC123");
  });
});

describe("settings api", () => {
  it("getSettings calls GET /settings", async () => {
    mockFetchOnce({ success: true, message: "ok", data: { settings: { taxRatePercent: "5.00", serviceChargePercent: "10.00" } } });
    const result = await getSettings();
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/settings");
    expect(init.method).toBe("GET");
    expect(result.settings.taxRatePercent).toBe("5.00");
  });
});
