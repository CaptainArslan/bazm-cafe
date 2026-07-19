import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../src/stores/auth.store";

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("router role guards", () => {
  it("redirects an unauthenticated visitor away from /staff to staff.login", async () => {
    const router = (await import("../src/router")).default;
    await router.push("/staff");
    await router.isReady();
    expect(router.currentRoute.value.name).toBe("staff.login");
  });

  it("redirects an unauthenticated visitor away from /admin to admin.login", async () => {
    const router = (await import("../src/router")).default;
    await router.push("/admin");
    await router.isReady();
    expect(router.currentRoute.value.name).toBe("admin.login");
  });

  it("lets an authenticated STAFF user reach /staff", async () => {
    const authStore = useAuthStore();
    // Test seam: write directly to the store's refs to simulate an already-authenticated session.
    authStore.user = { id: "1", name: "Ada", email: "ada@bazm.test", role: "STAFF" };
    authStore.status = "ready";

    const router = (await import("../src/router")).default;
    await router.push("/staff");
    await router.isReady();
    expect(router.currentRoute.value.name).toBe("staff.home");
  });

  it("sends an authenticated STAFF user away from /admin to staff.home", async () => {
    const authStore = useAuthStore();
    // Test seam: see above.
    authStore.user = { id: "1", name: "Ada", email: "ada@bazm.test", role: "STAFF" };
    authStore.status = "ready";

    const router = (await import("../src/router")).default;
    await router.push("/admin");
    await router.isReady();
    expect(router.currentRoute.value.name).toBe("staff.home");
  });

  it("redirects an authenticated STAFF user away from staff.login to staff.home", async () => {
    const authStore = useAuthStore();
    // Test seam: see above.
    authStore.user = { id: "1", name: "Ada", email: "ada@bazm.test", role: "STAFF" };
    authStore.status = "ready";

    const router = (await import("../src/router")).default;
    await router.push("/staff/login");
    await router.isReady();
    expect(router.currentRoute.value.name).toBe("staff.home");
  });

  it("redirects an authenticated ADMIN user away from admin.login to admin.home", async () => {
    const authStore = useAuthStore();
    // Test seam: see above.
    authStore.user = { id: "2", name: "Ali", email: "ali@bazm.test", role: "ADMIN" };
    authStore.status = "ready";

    const router = (await import("../src/router")).default;
    await router.push("/admin/login");
    await router.isReady();
    expect(router.currentRoute.value.name).toBe("admin.home");
  });
});
