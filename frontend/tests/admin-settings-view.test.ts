import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as settingsApi from "../src/api/settings";
import SettingsView from "../src/views/admin/SettingsView.vue";

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("admin SettingsView", () => {
  it("loads current rates and saves updated ones", async () => {
    vi.spyOn(settingsApi, "getSettings").mockResolvedValue({
      settings: { taxRatePercent: "5.00", serviceChargePercent: "10.00" },
    });
    const updateSpy = vi.spyOn(settingsApi, "updateSettings").mockResolvedValue({
      settings: { taxRatePercent: "7.50", serviceChargePercent: "10.00" },
    });

    const wrapper = mount(SettingsView);
    await flushPromises();

    const taxInput = wrapper.get('[data-test="tax-rate"]');
    await taxInput.setValue("7.5");
    await wrapper.get('[data-test="save"]').trigger("click");
    await flushPromises();

    expect(updateSpy).toHaveBeenCalledWith({ taxRatePercent: 7.5, serviceChargePercent: 10 });
    expect(wrapper.text()).toContain("Saved");
  });

  it("shows an error message if saving fails", async () => {
    vi.spyOn(settingsApi, "getSettings").mockResolvedValue({
      settings: { taxRatePercent: "5.00", serviceChargePercent: "10.00" },
    });
    vi.spyOn(settingsApi, "updateSettings").mockRejectedValue(new Error("network down"));

    const wrapper = mount(SettingsView);
    await flushPromises();

    await wrapper.get('[data-test="save"]').trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Couldn't reach the server");
  });
});
