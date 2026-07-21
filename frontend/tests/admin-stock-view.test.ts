import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as productsApi from "../src/api/admin-products";
import StockView from "../src/views/admin/StockView.vue";
import type { SafeProduct } from "../src/types/product";

function makeProduct(overrides: Partial<SafeProduct> = {}): SafeProduct {
  return {
    id: "p1", categoryId: "cat1", categoryName: "Drinks", name: "Espresso", slug: "espresso", description: null,
    imagePath: null, price: "3.00", preparationMinutes: 5, stockQuantity: 10, reservedQuantity: 0,
    availableQuantity: 10, lowStockThreshold: 2, trackStock: true, isAvailable: true, displayOrder: 0,
    createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("admin StockView", () => {
  it("highlights products at or below their low-stock threshold", async () => {
    vi.spyOn(productsApi, "listAdminProducts").mockResolvedValue({
      products: [makeProduct({ id: "p1", availableQuantity: 2, lowStockThreshold: 5 }), makeProduct({ id: "p2", availableQuantity: 10, lowStockThreshold: 5 })],
    });

    const wrapper = mount(StockView);
    await flushPromises();

    expect(wrapper.get('[data-test="stock-row-p1"]').classes().join(" ")).toContain("bz-red");
    expect(wrapper.get('[data-test="stock-row-p2"]').classes().join(" ")).not.toContain("bz-red");
  });

  it("adjusts stock via the dialog with a delta and reason", async () => {
    vi.spyOn(productsApi, "listAdminProducts").mockResolvedValue({ products: [makeProduct()] });
    const adjustSpy = vi.spyOn(productsApi, "adjustProductStock").mockResolvedValue({
      product: makeProduct({ stockQuantity: 15, availableQuantity: 15 }),
    });

    const wrapper = mount(StockView);
    await flushPromises();

    await wrapper.get('[data-test="adjust-p1"]').trigger("click");
    await wrapper.get('[data-test="field-delta"]').setValue("5");
    await wrapper.get('[data-test="field-reason"]').setValue("Restocked from supplier");
    await wrapper.get('[data-test="dialog-save"]').trigger("click");
    await flushPromises();

    expect(adjustSpy).toHaveBeenCalledWith("p1", { quantityDelta: 5, reason: "Restocked from supplier" });
  });
});
