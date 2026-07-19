import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as authApi from "../src/api/auth";
import router from "../src/router";
import StaffLoginView from "../src/views/staff/LoginView.vue";

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

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

    await wrapper.find('input[type="email"]').setValue("ada@bazm.test");
    await wrapper.find('input[type="password"]').setValue("secret123");
    await wrapper.find("form").trigger("submit");
    // router.isReady() only resolves for the *initial* navigation, so it can't be used to await the
    // router.replace() triggered by onSuccess. The subsequent navigation runs an async route guard and
    // a dynamic import() of the destination view component, which needs real event-loop turns (not just
    // a microtask flush) to settle, so poll with real timers until the navigation lands.
    for (let attempt = 0; attempt < 30 && router.currentRoute.value.name !== "staff.home"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      await flushPromises();
    }

    expect(router.currentRoute.value.name).toBe("staff.home");
  });
});
