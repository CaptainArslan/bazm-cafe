import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as menuApi from "../src/api/menu";
import ProductDetailView from "../src/views/customer/ProductDetailView.vue";
import type { SafeProduct } from "../src/types/product";
import router from "../src/router";

function makeProduct(overrides: Partial<SafeProduct> = {}): SafeProduct {
  return {
    id: "p1",
    categoryId: "c1",
    categoryName: "Drinks",
    name: "Espresso",
    slug: "espresso",
    description: "Rich and bold.",
    imagePath: null,
    price: "3.00",
    preparationMinutes: 5,
    stockQuantity: 10,
    reservedQuantity: 0,
    availableQuantity: 10,
    lowStockThreshold: 2,
    trackStock: true,
    isAvailable: true,
    displayOrder: 0,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("customer ProductDetailView loading state", () => {
  it("shows a loading indicator while the menu is being fetched, not the 'Item not found' empty state", async () => {
    let resolveMenu!: (value: { products: SafeProduct[] }) => void;
    vi.spyOn(menuApi, "getGuestMenu").mockReturnValue(
      new Promise((resolve) => {
        resolveMenu = resolve;
      }),
    );

    await router.push("/");
    await router.isReady();
    const wrapper = mount(ProductDetailView, { props: { productId: "p1" }, global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.text()).toContain("Loading item...");
    expect(wrapper.text()).not.toContain("Item not found");

    resolveMenu({ products: [makeProduct()] });
    await flushPromises();

    expect(wrapper.text()).toContain("Espresso");
    expect(wrapper.text()).not.toContain("Loading item...");
  });

  it("shows the 'Item not found' empty state once loaded and the product truly doesn't exist", async () => {
    vi.spyOn(menuApi, "getGuestMenu").mockResolvedValue({ products: [makeProduct({ id: "other" })] });

    await router.push("/");
    await router.isReady();
    const wrapper = mount(ProductDetailView, { props: { productId: "p1" }, global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.text()).toContain("Item not found");
  });
});
