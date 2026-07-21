// frontend/tests/admin-staff-view.test.ts
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as adminStaffApi from "../src/api/admin-staff";
import StaffView from "../src/views/admin/StaffView.vue";
import type { SafeStaff } from "../src/types/staff";

function makeStaff(overrides: Partial<SafeStaff> = {}): SafeStaff {
  return {
    id: "s1",
    name: "Ada Staff",
    email: "ada@bazm.test",
    phone: null,
    imagePath: null,
    imageUrl: null,
    role: "STAFF",
    isActive: true,
    lastLoginAt: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("admin StaffView", () => {
  it("loads and renders the staff list", async () => {
    vi.spyOn(adminStaffApi, "listStaff").mockResolvedValue({ staff: [makeStaff()] });

    const wrapper = mount(StaffView);
    await flushPromises();

    expect(wrapper.text()).toContain("Ada Staff");
  });

  it("creates a new staff member via the dialog", async () => {
    vi.spyOn(adminStaffApi, "listStaff").mockResolvedValue({ staff: [] });
    const createSpy = vi.spyOn(adminStaffApi, "createStaff").mockResolvedValue({ staff: makeStaff() });

    const wrapper = mount(StaffView);
    await flushPromises();

    await wrapper.get('[data-test="new-staff"]').trigger("click");
    await wrapper.get('[data-test="field-name"]').setValue("Ada Staff");
    await wrapper.get('[data-test="field-email"]').setValue("ada@bazm.test");
    await wrapper.get('[data-test="field-password"]').setValue("Password1");
    await wrapper.get('[data-test="dialog-save"]').trigger("click");
    await flushPromises();

    expect(createSpy).toHaveBeenCalledWith({ name: "Ada Staff", email: "ada@bazm.test", password: "Password1" });
  });

  it("toggles a staff member's active status", async () => {
    vi.spyOn(adminStaffApi, "listStaff").mockResolvedValue({ staff: [makeStaff({ isActive: true })] });
    const statusSpy = vi
      .spyOn(adminStaffApi, "updateStaffStatus")
      .mockResolvedValue({ staff: makeStaff({ isActive: false }) });

    const wrapper = mount(StaffView);
    await flushPromises();

    await wrapper.get('[data-test="toggle-active-s1"]').trigger("click");
    await flushPromises();

    expect(statusSpy).toHaveBeenCalledWith("s1", false);
  });
});
