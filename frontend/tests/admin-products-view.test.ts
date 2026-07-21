import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as categoriesApi from "../src/api/admin-categories";
import * as productsApi from "../src/api/admin-products";
import ProductsView from "../src/views/admin/ProductsView.vue";
import type { SafeCategory } from "../src/types/category";
import type { SafeProduct } from "../src/types/product";

function makeCategory(overrides: Partial<SafeCategory> = {}): SafeCategory {
  return {
    id: "cat1", name: "Drinks", slug: "drinks", description: null, imagePath: null, imageUrl: null,
    displayOrder: 0, isVisible: true, createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

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

describe("admin ProductsView", () => {
  it("loads categories and products, and renders the product list", async () => {
    vi.spyOn(categoriesApi, "listCategories").mockResolvedValue({ categories: [makeCategory()] });
    vi.spyOn(productsApi, "listAdminProducts").mockResolvedValue({ products: [makeProduct()] });

    const wrapper = mount(ProductsView);
    await flushPromises();

    expect(wrapper.text()).toContain("Espresso");
  });

  it("creates a product via the dialog with a category picker", async () => {
    vi.spyOn(categoriesApi, "listCategories").mockResolvedValue({ categories: [makeCategory()] });
    vi.spyOn(productsApi, "listAdminProducts").mockResolvedValue({ products: [] });
    const createSpy = vi.spyOn(productsApi, "createProduct").mockResolvedValue({ product: makeProduct() });

    const wrapper = mount(ProductsView);
    await flushPromises();

    await wrapper.get('[data-test="new-product"]').trigger("click");
    await wrapper.get('[data-test="field-name"]').setValue("Espresso");
    await wrapper.get('[data-test="field-price"]').setValue("3.00");
    await wrapper.get('[data-test="field-category"]').setValue("cat1");
    await wrapper.get('[data-test="dialog-save"]').trigger("click");
    await flushPromises();

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ categoryId: "cat1", name: "Espresso", price: 3 }));
  });

  it("toggles product availability", async () => {
    vi.spyOn(categoriesApi, "listCategories").mockResolvedValue({ categories: [makeCategory()] });
    vi.spyOn(productsApi, "listAdminProducts").mockResolvedValue({ products: [makeProduct({ isAvailable: true })] });
    const statusSpy = vi
      .spyOn(productsApi, "updateProductStatus")
      .mockResolvedValue({ product: makeProduct({ isAvailable: false }) });

    const wrapper = mount(ProductsView);
    await flushPromises();

    await wrapper.get('[data-test="toggle-available-p1"]').trigger("click");
    await flushPromises();

    expect(statusSpy).toHaveBeenCalledWith("p1", false);
  });
});
