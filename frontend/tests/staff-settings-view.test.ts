import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as settingsApi from "../src/api/settings";
import SettingsView from "../src/views/staff/SettingsView.vue";

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("staff SettingsView", () => {
  it("loads and displays the cafe's tax and service charge rates", async () => {
    vi.spyOn(settingsApi, "getSettings").mockResolvedValue({
      settings: { taxRatePercent: "5.00", serviceChargePercent: "10.00" },
    });

    const wrapper = mount(SettingsView);
    await flushPromises();

    expect(wrapper.text()).toContain("5.00");
    expect(wrapper.text()).toContain("10.00");
  });
});
