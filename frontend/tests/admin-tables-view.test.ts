import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
});
