// frontend/tests/api-admin-staff.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { createStaff, listStaff, updateStaff, updateStaffPassword, updateStaffStatus } from "../src/api/admin-staff";

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin staff api", () => {
  it("listStaff sends search/isActive query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { staff: [] } }));
    vi.stubGlobal("fetch", fetchMock);

    await listStaff({ search: "ada", isActive: true });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/staff?");
    expect(url).toContain("search=ada");
    expect(url).toContain("isActive=true");
  });

  it("createStaff posts the new-staff payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, { success: true, message: "ok", data: { staff: { id: "s1" } } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createStaff({ name: "Ada", email: "ada@bazm.test", password: "Password1" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/staff");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ name: "Ada", email: "ada@bazm.test", password: "Password1" });
  });

  it("updateStaff patches the given fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { staff: { id: "s1" } } }));
    vi.stubGlobal("fetch", fetchMock);

    await updateStaff("s1", { name: "Ada B" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/staff/s1");
    expect(init.method).toBe("PATCH");
  });

  it("updateStaffStatus toggles active state", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { staff: { id: "s1" } } }));
    vi.stubGlobal("fetch", fetchMock);

    await updateStaffStatus("s1", false);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/staff/s1/status");
    expect(JSON.parse(init.body)).toEqual({ isActive: false });
  });

  it("updateStaffPassword sends the new password", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { staff: { id: "s1" } } }));
    vi.stubGlobal("fetch", fetchMock);

    await updateStaffPassword("s1", "NewPassword1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/staff/s1/password");
    expect(JSON.parse(init.body)).toEqual({ password: "NewPassword1" });
  });
});
