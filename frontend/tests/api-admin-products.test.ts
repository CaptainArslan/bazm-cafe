import { afterEach, describe, expect, it, vi } from "vitest";

import { listAdminProducts } from "../src/api/admin-products";

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin products api", () => {
  it("listAdminProducts fetches the full products list", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        message: "Products retrieved successfully.",
        data: {
          products: [
            {
              id: "prod1",
              categoryId: "c1",
              categoryName: "Drinks",
              name: "Espresso",
              slug: "espresso",
              description: null,
              imagePath: null,
              price: "3.00",
              preparationMinutes: 5,
              stockQuantity: 2,
              reservedQuantity: 0,
              availableQuantity: 2,
              lowStockThreshold: 5,
              trackStock: true,
              isAvailable: true,
              displayOrder: 0,
              createdAt: "2026-07-21T00:00:00.000Z",
              updatedAt: "2026-07-21T00:00:00.000Z",
            },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await listAdminProducts();

    expect(result.products).toHaveLength(1);
    expect(result.products[0].availableQuantity).toBe(2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/products");
    expect(init.method).toBe("GET");
  });
});
