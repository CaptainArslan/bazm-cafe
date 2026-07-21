import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as menuApi from "../src/api/menu";
import MenuView from "../src/views/customer/MenuView.vue";
import { useCartStore } from "../src/stores/cart.store";
import { useGuestSessionStore } from "../src/stores/guest-session.store";
import { CustomerType } from "../src/types/enums";
import type { SafeProduct } from "../src/types/product";
import router from "../src/router";

// Polls with real timers until the given predicate over the router's current route is satisfied.
// router.isReady() only resolves for the *initial* navigation, so it can't be used to await a
// router.push() triggered from a click handler: that subsequent navigation runs an async route
// guard and a dynamic import() of the destination view component (see frontend/tests/login-flow.test.ts).
async function waitForRoute(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 30 && !predicate(); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    await flushPromises();
  }
}

function activateGuestSession(): void {
  const guestSessionStore = useGuestSessionStore();
  // Test seam: seed an already-fetched, active session directly on the store's refs so the
  // `requiresSession` route guard passes without a real network call.
  guestSessionStore.session = {
    id: "s1",
    orderType: CustomerType.DINE_IN,
    tableId: "t1",
    tableNumber: "A1",
    customerId: null,
    expiresAt: "2026-07-22T00:00:00.000Z",
    lastActivityAt: "2026-07-21T00:00:00.000Z",
    closedAt: null,
    isActive: true,
  };
  guestSessionStore.hasFetched = true;
}

function makeProduct(overrides: Partial<SafeProduct> = {}): SafeProduct {
  return {
    id: "p1",
    categoryId: "c1",
    categoryName: "Drinks",
    name: "Espresso",
    slug: "espresso",
    description: null,
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

describe("customer MenuView product card", () => {
  it("does not nest the Add button inside an anchor element", async () => {
    vi.spyOn(menuApi, "getGuestMenu").mockResolvedValue({ products: [makeProduct()] });
    await router.push("/");
    await router.isReady();

    const wrapper = mount(MenuView, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.find("a").exists()).toBe(false);
  });

  it("clicking Add adds the product to the cart without navigating", async () => {
    vi.spyOn(menuApi, "getGuestMenu").mockResolvedValue({ products: [makeProduct()] });
    await router.push("/");
    await router.isReady();

    const wrapper = mount(MenuView, { global: { plugins: [router] } });
    await flushPromises();
    const cartStore = useCartStore();

    await wrapper.find("button.rounded-full.bg-bz-gold-600.px-2\\.5").trigger("click");

    expect(cartStore.totalItems).toBe(1);
    expect(router.currentRoute.value.name).not.toBe("customer.product-detail");
  });

  it("clicking the card body navigates to the product detail route", async () => {
    vi.spyOn(menuApi, "getGuestMenu").mockResolvedValue({ products: [makeProduct()] });
    activateGuestSession();
    await router.push("/");
    await router.isReady();

    const wrapper = mount(MenuView, { global: { plugins: [router] } });
    await flushPromises();

    await wrapper.find('[role="link"]').trigger("click");
    await waitForRoute(() => router.currentRoute.value.name === "customer.product-detail");

    expect(router.currentRoute.value.name).toBe("customer.product-detail");
  });
});
