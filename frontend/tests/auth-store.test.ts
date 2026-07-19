// frontend/tests/auth-store.test.ts
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as authApi from "../src/api/auth";
import { ApiError, authHttp } from "../src/api/http";
import * as socketClient from "../src/socket/client";
import { useAuthStore } from "../src/stores/auth.store";

const STAFF_USER = { id: "1", name: "Ada Staff", email: "ada@bazm.test", role: "STAFF" } as const;
const ADMIN_USER = { id: "2", name: "Admin One", email: "admin@bazm.test", role: "ADMIN" } as const;

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("auth store", () => {
  it("login stores the token and user, and sets isAuthenticated", async () => {
    vi.spyOn(authApi, "login").mockResolvedValue({ accessToken: "tok-1", user: STAFF_USER });
    const store = useAuthStore();

    const user = await store.login("ada@bazm.test", "secret");

    expect(user).toEqual(STAFF_USER);
    expect(store.user).toEqual(STAFF_USER);
    expect(store.isAuthenticated).toBe(true);
    expect(store.role).toBe("STAFF");
  });

  it("restore() populates session from a successful refresh and only runs once", async () => {
    const refreshSpy = vi.spyOn(authApi, "refreshSession").mockResolvedValue({
      accessToken: "tok-2",
      user: ADMIN_USER,
    });
    const store = useAuthStore();

    await store.restore();
    await store.restore();

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(store.isAuthenticated).toBe(true);
    expect(store.status).toBe("ready");
  });

  it("restore() leaves the store unauthenticated when refresh fails, without throwing", async () => {
    vi.spyOn(authApi, "refreshSession").mockRejectedValue(new ApiError(401, "no session", { code: "UNAUTHORIZED" }));
    const store = useAuthStore();

    await expect(store.restore()).resolves.toBeUndefined();

    expect(store.isAuthenticated).toBe(false);
    expect(store.status).toBe("ready");
  });

  it("logout clears session and disconnects the socket even if the network call fails", async () => {
    vi.spyOn(authApi, "login").mockResolvedValue({ accessToken: "tok-1", user: STAFF_USER });
    vi.spyOn(authApi, "logout").mockRejectedValue(new Error("network down"));
    const disconnectSpy = vi.spyOn(socketClient, "disconnectSocket").mockImplementation(() => {});
    const store = useAuthStore();
    await store.login("ada@bazm.test", "secret");

    await store.logout();

    expect(store.isAuthenticated).toBe(false);
    expect(store.user).toBeNull();
    expect(disconnectSpy).toHaveBeenCalled();
  });

  it("wires authHttp so a 401 triggers refresh via the auth store", async () => {
    useAuthStore(); // instantiating the store registers its integration with http.ts
    vi.spyOn(authApi, "refreshSession").mockResolvedValue({ accessToken: "tok-3", user: STAFF_USER });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ success: false, message: "expired", error: { code: "UNAUTHORIZED" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, message: "ok", data: { orders: [] } }),
      });

    const result = await authHttp.get<{ orders: unknown[] }>("/orders");

    expect(result.orders).toEqual([]);
    vi.unstubAllGlobals();
  });
});
