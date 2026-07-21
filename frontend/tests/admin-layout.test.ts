import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminLayout from "../src/layouts/AdminLayout.vue";
import { useAuthStore } from "../src/stores/auth.store";
import router from "../src/router";

// Polls with real timers until the given predicate over the router's current route is satisfied.
// router.isReady() only resolves for the *initial* navigation, so it can't be used to await a
// router.replace() triggered from onSuccess: that subsequent navigation runs an async route guard
// and a dynamic import() of the destination view component, which needs real event-loop turns (not
// just a microtask flush) to settle.
async function waitForRoute(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 30 && !predicate(); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    await flushPromises();
  }
}

const ALL_ROUTE_NAMES = [
  "admin.home",
  "admin.orders",
  "admin.cancellations",
  "admin.payments",
  "admin.categories",
  "admin.products",
  "admin.stock",
  "admin.media",
  "admin.customers",
  "admin.staff",
  "admin.tables",
  "admin.settings",
];

function signInAsAdmin() {
  const authStore = useAuthStore();
  // Test seam: matches the pattern in router-guards.test.ts — writes directly to the
  // store's refs to simulate an already-authenticated session without hitting the network.
  authStore.user = { id: "1", name: "Admin", email: "admin@bazm.test", role: "ADMIN" };
  authStore.status = "ready";
  return authStore;
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("AdminLayout", () => {
  it("renders a nav link for every admin module and the dashboard", async () => {
    signInAsAdmin();
    await router.push("/admin/staff");
    await router.isReady();
    const wrapper = mount(AdminLayout, { global: { plugins: [router] } });

    for (const name of ALL_ROUTE_NAMES) {
      expect(wrapper.find(`[data-test="nav-link-${name}"]`).exists()).toBe(true);
    }
  });

  it("highlights only the active route's nav link", async () => {
    signInAsAdmin();
    await router.push("/admin/staff");
    await router.isReady();
    const wrapper = mount(AdminLayout, { global: { plugins: [router] } });

    expect(wrapper.get('[data-test="nav-link-admin.staff"]').classes()).toContain("bg-bz-gold-100");
    expect(wrapper.get('[data-test="nav-link-admin.home"]').classes()).not.toContain("bg-bz-gold-100");
  });

  it("toggles the mobile drawer backdrop open and closed", async () => {
    signInAsAdmin();
    await router.push("/admin/staff");
    await router.isReady();
    const wrapper = mount(AdminLayout, { global: { plugins: [router] } });

    expect(wrapper.find('[data-test="nav-drawer-backdrop"]').exists()).toBe(false);
    await wrapper.get('[data-test="nav-drawer-toggle"]').trigger("click");
    expect(wrapper.find('[data-test="nav-drawer-backdrop"]').exists()).toBe(true);
    await wrapper.get('[data-test="nav-drawer-backdrop"]').trigger("click");
    expect(wrapper.find('[data-test="nav-drawer-backdrop"]').exists()).toBe(false);
  });

  it("signs out and redirects to admin login", async () => {
    const authStore = signInAsAdmin();
    vi.spyOn(authStore, "logout").mockImplementation(async () => {
      authStore.user = null;
    });

    await router.push("/admin/staff");
    await router.isReady();
    const wrapper = mount(AdminLayout, { global: { plugins: [router] } });

    await wrapper.get('[data-test="sign-out"]').trigger("click");
    await waitForRoute(() => router.currentRoute.value.name === "admin.login");

    expect(authStore.logout).toHaveBeenCalledOnce();
    expect(router.currentRoute.value.name).toBe("admin.login");
  });
});
