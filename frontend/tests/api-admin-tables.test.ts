import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTable,
  forceReleaseTable,
  listTables,
  regenerateTableQr,
  releaseTable,
  updateTable,
  updateTableStatus,
} from "../src/api/admin-tables";

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin tables api", () => {
  it("listTables fetches all tables", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { tables: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    await listTables();
    expect(fetchMock.mock.calls[0][0]).toContain("/tables");
  });

  it("createTable posts the new-table payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { success: true, message: "ok", data: { table: { id: "t1" } } }));
    vi.stubGlobal("fetch", fetchMock);
    await createTable({ tableNumber: "A1", capacity: 4 });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
  });

  it("updateTable patches fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { table: { id: "t1" } } }));
    vi.stubGlobal("fetch", fetchMock);
    await updateTable("t1", { capacity: 6 });
    expect(fetchMock.mock.calls[0][0]).toContain("/tables/t1");
  });

  it("updateTableStatus sends operationalStatus", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { table: { id: "t1" } } }));
    vi.stubGlobal("fetch", fetchMock);
    await updateTableStatus("t1", { operationalStatus: "OUT_OF_SERVICE" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/tables/t1/status");
    expect(JSON.parse(init.body)).toEqual({ operationalStatus: "OUT_OF_SERVICE" });
  });

  it("regenerateTableQr posts to the regenerate endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { table: { id: "t1" } } }));
    vi.stubGlobal("fetch", fetchMock);
    await regenerateTableQr("t1");
    expect(fetchMock.mock.calls[0][0]).toContain("/tables/t1/qr-code/regenerate");
  });

  it("releaseTable posts to the release endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { success: true, message: "ok", data: { table: { id: "t1" }, receiptRawToken: "tok", receiptAccessExpiresAt: "2026-07-22T00:00:00.000Z" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await releaseTable("t1");
    expect(fetchMock.mock.calls[0][0]).toContain("/tables/t1/release");
  });

  it("forceReleaseTable posts the reason", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { success: true, message: "ok", data: { table: { id: "t1" }, receiptRawToken: "tok", receiptAccessExpiresAt: "2026-07-22T00:00:00.000Z" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await forceReleaseTable("t1", "Guest left without paying");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/tables/t1/force-release");
    expect(JSON.parse(init.body)).toEqual({ reason: "Guest left without paying" });
  });
});
