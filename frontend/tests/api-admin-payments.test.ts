import { afterEach, describe, expect, it, vi } from "vitest";

import { getPayment, listAdminPayments, listOrderPayments, recordPayment, reversePayment } from "../src/api/admin-payments";

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin payments api", () => {
  it("listAdminPayments fetches the full payments list", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        message: "Payments retrieved successfully.",
        data: {
          payments: [
            {
              id: "p1",
              paymentNumber: "PAY-1",
              orderId: "o1",
              amount: "50.00",
              method: "CASH",
              status: "COMPLETED",
              reference: null,
              notes: null,
              paidAt: "2026-07-21T09:30:00.000Z",
              voidedAt: null,
              voidReason: null,
              createdAt: "2026-07-21T09:30:00.000Z",
            },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await listAdminPayments();

    expect(result.payments).toHaveLength(1);
    expect(result.payments[0].amount).toBe("50.00");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/payments");
    expect(init.method).toBe("GET");
  });
});

describe("admin payments api — mutations", () => {
  it("getPayment fetches one payment", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { payment: { id: "pay1" } } }));
    vi.stubGlobal("fetch", fetchMock);
    await getPayment("pay1");
    expect(fetchMock.mock.calls[0][0]).toContain("/payments/pay1");
  });

  it("listOrderPayments fetches payments for an order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { payments: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    await listOrderPayments("o1");
    expect(fetchMock.mock.calls[0][0]).toContain("/orders/o1/payments");
  });

  it("recordPayment posts the payment payload to the order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, { success: true, message: "ok", data: { payment: { id: "pay1" }, order: { id: "o1" }, duplicated: false, sessionClosed: false, receiptRawToken: null } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await recordPayment("o1", { amount: 100, method: "CASH" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/orders/o1/payments");
    expect(init.method).toBe("POST");
  });

  it("reversePayment posts the reason", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { success: true, message: "ok", data: { payment: { id: "pay1" }, order: { id: "o1" } } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await reversePayment("pay1", "Customer disputed charge");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/payments/pay1/reverse");
    expect(JSON.parse(init.body)).toEqual({ reason: "Customer disputed charge" });
  });
});
