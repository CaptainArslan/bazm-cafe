import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as authApi from "../src/api/auth";
import router from "../src/router";
import AdminLoginView from "../src/views/admin/LoginView.vue";
import StaffLoginView from "../src/views/staff/LoginView.vue";

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

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

async function submitLoginForm(wrapper: ReturnType<typeof mount>): Promise<void> {
  await wrapper.find('input[type="email"]').setValue("ada@bazm.test");
  await wrapper.find('input[type="password"]').setValue("secret123");
  await wrapper.find("form").trigger("submit");
}

describe("staff login view", () => {
  it("logs in and redirects to staff.home", async () => {
    vi.spyOn(authApi, "login").mockResolvedValue({
      accessToken: "tok-1",
      user: { id: "1", name: "Ada Staff", email: "ada@bazm.test", role: "STAFF" },
    });

    await router.push("/staff/login");
    await router.isReady();

    const wrapper = mount(StaffLoginView, {
      global: { plugins: [router] },
    });

    await submitLoginForm(wrapper);
    await waitForRoute(() => router.currentRoute.value.name === "staff.home");

    expect(router.currentRoute.value.name).toBe("staff.home");
  });

  it("rejects a foreign redirect target and falls back to /staff", async () => {
    vi.spyOn(authApi, "login").mockResolvedValue({
      accessToken: "tok-1",
      user: { id: "1", name: "Ada Staff", email: "ada@bazm.test", role: "STAFF" },
    });

    await router.push("/staff/login?redirect=%2Fadmin%2Fsome-path");
    await router.isReady();

    const wrapper = mount(StaffLoginView, {
      global: { plugins: [router] },
    });

    await submitLoginForm(wrapper);
    await waitForRoute(() => router.currentRoute.value.name === "staff.home");

    // A ?redirect=/admin/... query param must never send a staff user into /admin.
    expect(router.currentRoute.value.name).toBe("staff.home");
    expect(router.currentRoute.value.fullPath).toBe("/staff");
  });

  it("honors a safe redirect target within /staff", async () => {
    vi.spyOn(authApi, "login").mockResolvedValue({
      accessToken: "tok-1",
      user: { id: "1", name: "Ada Staff", email: "ada@bazm.test", role: "STAFF" },
    });

    await router.push("/staff/login?redirect=%2Fstaff%2Fsome-legit-path");
    await router.isReady();

    const wrapper = mount(StaffLoginView, {
      global: { plugins: [router] },
    });

    await submitLoginForm(wrapper);
    await waitForRoute(() => router.currentRoute.value.path === "/staff/some-legit-path");

    expect(router.currentRoute.value.path).toBe("/staff/some-legit-path");
  });
});

describe("admin login view", () => {
  it("logs in and redirects to admin.home", async () => {
    vi.spyOn(authApi, "login").mockResolvedValue({
      accessToken: "tok-2",
      user: { id: "2", name: "Ali Admin", email: "ada@bazm.test", role: "ADMIN" },
    });

    await router.push("/admin/login");
    await router.isReady();

    const wrapper = mount(AdminLoginView, {
      global: { plugins: [router] },
    });

    await submitLoginForm(wrapper);
    await waitForRoute(() => router.currentRoute.value.name === "admin.home");

    expect(router.currentRoute.value.name).toBe("admin.home");
  });

  it("rejects a foreign redirect target and falls back to /admin", async () => {
    vi.spyOn(authApi, "login").mockResolvedValue({
      accessToken: "tok-2",
      user: { id: "2", name: "Ali Admin", email: "ada@bazm.test", role: "ADMIN" },
    });

    await router.push("/admin/login?redirect=%2Fstaff%2Fsome-path");
    await router.isReady();

    const wrapper = mount(AdminLoginView, {
      global: { plugins: [router] },
    });

    await submitLoginForm(wrapper);
    await waitForRoute(() => router.currentRoute.value.name === "admin.home");

    // A ?redirect=/staff/... query param must never send an admin user into /staff.
    expect(router.currentRoute.value.name).toBe("admin.home");
    expect(router.currentRoute.value.fullPath).toBe("/admin");
  });

  it("honors a safe redirect target within /admin", async () => {
    vi.spyOn(authApi, "login").mockResolvedValue({
      accessToken: "tok-2",
      user: { id: "2", name: "Ali Admin", email: "ada@bazm.test", role: "ADMIN" },
    });

    await router.push("/admin/login?redirect=%2Fadmin%2Fsome-legit-path");
    await router.isReady();

    const wrapper = mount(AdminLoginView, {
      global: { plugins: [router] },
    });

    await submitLoginForm(wrapper);
    await waitForRoute(() => router.currentRoute.value.path === "/admin/some-legit-path");

    expect(router.currentRoute.value.path).toBe("/admin/some-legit-path");
  });
});
