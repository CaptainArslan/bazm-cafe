import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../src/api/http";
import * as tablesApi from "../src/api/admin-tables";
import TablesView from "../src/views/admin/TablesView.vue";
import type { SafeTable } from "../src/types/table";

function makeTable(overrides: Partial<SafeTable> = {}): SafeTable {
  return {
    id: "t1",
    tableNumber: "A1",
    name: null,
    capacity: 4,
    operationalStatus: "AVAILABLE",
    status: "AVAILABLE",
    isActive: true,
    qrVersion: 1,
    qrImagePath: "/uploads/qr/t1-v1.png",
    qrImageUrl: "http://localhost:3000/uploads/qr/t1-v1.png",
    qrGeneratedAt: "2026-07-20T00:00:00.000Z",
    qrRegeneratedAt: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("admin TablesView", () => {
  it("loads and renders the table list with derived status", async () => {
    vi.spyOn(tablesApi, "listTables").mockResolvedValue({ tables: [makeTable({ status: "OCCUPIED" })] });

    const wrapper = mount(TablesView);
    await flushPromises();

    expect(wrapper.text()).toContain("A1");
    expect(wrapper.text()).toContain("OCCUPIED");
  });

  it("creates a new table via the dialog", async () => {
    vi.spyOn(tablesApi, "listTables").mockResolvedValue({ tables: [] });
    const createSpy = vi.spyOn(tablesApi, "createTable").mockResolvedValue({ table: makeTable() });

    const wrapper = mount(TablesView);
    await flushPromises();

    await wrapper.get('[data-test="new-table"]').trigger("click");
    await wrapper.get('[data-test="field-tableNumber"]').setValue("A1");
    await wrapper.get('[data-test="dialog-save"]').trigger("click");
    await flushPromises();

    expect(createSpy).toHaveBeenCalledWith({ tableNumber: "A1" });
  });

  it("creates a new table with a capacity value without throwing", async () => {
    vi.spyOn(tablesApi, "listTables").mockResolvedValue({ tables: [] });
    const createSpy = vi.spyOn(tablesApi, "createTable").mockResolvedValue({ table: makeTable({ capacity: 6 }) });

    const wrapper = mount(TablesView);
    await flushPromises();

    await wrapper.get('[data-test="new-table"]').trigger("click");
    await wrapper.get('[data-test="field-tableNumber"]').setValue("A1");
    await wrapper.get('[data-test="field-capacity"]').setValue("6");
    await wrapper.get('[data-test="dialog-save"]').trigger("click");
    await flushPromises();

    expect(createSpy).toHaveBeenCalledWith({ tableNumber: "A1", capacity: 6 });
    // Regression guard: a native <input type="number"> coerces v-model's bound value to a
    // number once the user types into it, so buildCreateInput must not assume form.capacity
    // is always a string (form.capacity.trim() throws "trim is not a function" in that case).
    expect(wrapper.find('[data-test="dialog-save"]').exists()).toBe(false);
  });

  it("shows the QR image and regenerates it", async () => {
    vi.spyOn(tablesApi, "listTables").mockResolvedValue({ tables: [makeTable()] });
    const regenSpy = vi.spyOn(tablesApi, "regenerateTableQr").mockResolvedValue({ table: makeTable({ qrVersion: 2 }) });

    const wrapper = mount(TablesView);
    await flushPromises();

    await wrapper.get('[data-test="view-qr-t1"]').trigger("click");
    expect(wrapper.find("img[data-test='qr-image']").attributes("src")).toBe(makeTable().qrImageUrl);

    await wrapper.get('[data-test="regenerate-qr"]').trigger("click");
    await flushPromises();

    expect(regenSpy).toHaveBeenCalledWith("t1");
  });

  it("force-releases a table with a reason", async () => {
    vi.spyOn(tablesApi, "listTables").mockResolvedValue({ tables: [makeTable({ status: "OCCUPIED" })] });
    const forceSpy = vi
      .spyOn(tablesApi, "forceReleaseTable")
      .mockResolvedValue({ table: makeTable({ status: "AVAILABLE" }), receiptRawToken: "tok", receiptAccessExpiresAt: "2026-07-22T00:00:00.000Z" });

    const wrapper = mount(TablesView);
    await flushPromises();

    await wrapper.get('[data-test="force-release-t1"]').trigger("click");
    await wrapper.get("textarea").setValue("Guest left without paying");
    await wrapper.get('[data-test="confirm"]').trigger("click");
    await flushPromises();

    expect(forceSpy).toHaveBeenCalledWith("t1", "Guest left without paying");
  });

  it("keeps the table list visible and shows a dismissable banner when toggling status fails", async () => {
    vi.spyOn(tablesApi, "listTables").mockResolvedValue({ tables: [makeTable({ operationalStatus: "AVAILABLE" })] });
    vi.spyOn(tablesApi, "updateTableStatus").mockRejectedValue(
      new ApiError(409, "Could not update table status.", { code: "TABLE_STATUS_CONFLICT" }),
    );

    const wrapper = mount(TablesView);
    await flushPromises();

    const toggleButton = wrapper.findAll("button").find((b) => b.text() === "Take Out of Service");
    await toggleButton!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("A1");
    expect(wrapper.text()).toContain("Could not update table status.");

    await wrapper.get('[data-test="dismiss-action-error"]').trigger("click");
    await flushPromises();

    expect(wrapper.text()).not.toContain("Could not update table status.");
    expect(wrapper.text()).toContain("A1");
  });
});
