import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
  updateCategoryStatus,
} from "../src/api/admin-categories";

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin categories api", () => {
  it("listCategories fetches all categories", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { categories: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    await listCategories();
    expect(fetchMock.mock.calls[0][0]).toContain("/categories");
  });

  it("createCategory posts the payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { success: true, message: "ok", data: { category: { id: "c1" } } }));
    vi.stubGlobal("fetch", fetchMock);
    await createCategory({ name: "Drinks" });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
  });

  it("updateCategory patches fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { category: { id: "c1" } } }));
    vi.stubGlobal("fetch", fetchMock);
    await updateCategory("c1", { name: "Beverages" });
    expect(fetchMock.mock.calls[0][0]).toContain("/categories/c1");
  });

  it("updateCategoryStatus toggles visibility", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { category: { id: "c1" } } }));
    vi.stubGlobal("fetch", fetchMock);
    await updateCategoryStatus("c1", false);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/categories/c1/status");
    expect(JSON.parse(init.body)).toEqual({ isVisible: false });
  });

  it("deleteCategory sends a DELETE request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok" }));
    vi.stubGlobal("fetch", fetchMock);
    await deleteCategory("c1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/categories/c1");
    expect(init.method).toBe("DELETE");
  });
});
