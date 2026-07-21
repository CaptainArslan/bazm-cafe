import { afterEach, describe, expect, it, vi } from "vitest";

import { createProduct, deleteProduct, getAdminProduct, listAdminProducts, updateProduct, updateProductStatus } from "../src/api/admin-products";

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

describe("admin products api — mutations", () => {
  it("getAdminProduct fetches one product", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { product: { id: "p1" } } }));
    vi.stubGlobal("fetch", fetchMock);
    await getAdminProduct("p1");
    expect(fetchMock.mock.calls[0][0]).toContain("/products/p1");
  });

  it("createProduct posts the payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { success: true, message: "ok", data: { product: { id: "p1" } } }));
    vi.stubGlobal("fetch", fetchMock);
    await createProduct({ categoryId: "cat1", name: "Espresso", price: 3 });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
  });

  it("updateProduct patches fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { product: { id: "p1" } } }));
    vi.stubGlobal("fetch", fetchMock);
    await updateProduct("p1", { name: "Double Espresso" });
    expect(fetchMock.mock.calls[0][0]).toContain("/products/p1");
  });

  it("updateProductStatus toggles availability", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { product: { id: "p1" } } }));
    vi.stubGlobal("fetch", fetchMock);
    await updateProductStatus("p1", false);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/products/p1/status");
    expect(JSON.parse(init.body)).toEqual({ isAvailable: false });
  });

  it("deleteProduct sends a DELETE request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok" }));
    vi.stubGlobal("fetch", fetchMock);
    await deleteProduct("p1");
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });
});
