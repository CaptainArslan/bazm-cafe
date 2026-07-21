import { afterEach, describe, expect, it, vi } from "vitest";

import { listAdminPayments } from "../src/api/admin-payments";

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
