import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchCurrentUser, login, logout, logoutAll, refreshSession } from "../src/api/auth";
import { configureAuthIntegration } from "../src/api/http";

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  configureAuthIntegration({
    getToken: () => null,
    refresh: () => Promise.resolve(null),
    onUnauthorized: () => {},
  });
});

describe("auth api", () => {
  it("login posts credentials and returns accessToken + user", async () => {
    mockFetchOnce({
      success: true,
      message: "ok",
      data: { accessToken: "tok-1", user: { id: "1", name: "Ada Staff", email: "ada@bazm.test", role: "STAFF" } },
    });

    const result = await login({ email: "ada@bazm.test", password: "secret" });

    expect(result.accessToken).toBe("tok-1");
    expect(result.user.role).toBe("STAFF");
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ email: "ada@bazm.test", password: "secret" });
  });

  it("refreshSession calls /auth/refresh with no body", async () => {
    mockFetchOnce({
      success: true,
      message: "ok",
      data: { accessToken: "tok-2", user: { id: "1", name: "Ada Staff", email: "ada@bazm.test", role: "STAFF" } },
    });

    const result = await refreshSession();

    expect(result.accessToken).toBe("tok-2");
    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/auth/refresh");
  });

  it("fetchCurrentUser returns the safe user", async () => {
    mockFetchOnce({
      success: true,
      message: "ok",
      data: { user: { id: "2", name: "Admin One", email: "admin@bazm.test", role: "ADMIN" } },
    });

    const user = await fetchCurrentUser();

    expect(user.role).toBe("ADMIN");
  });

  it("logout and logoutAll resolve without a body", async () => {
    mockFetchOnce({ success: true, message: "ok" });
    await expect(logout()).resolves.toBeUndefined();

    mockFetchOnce({ success: true, message: "ok" });
    await expect(logoutAll()).resolves.toBeUndefined();
  });

  // Regression guard: /auth/logout, /auth/logout-all, and /auth/me all require a valid access
  // token server-side (see backend auth.routes.ts). Calling them through the plain `http` client
  // omits the Authorization header, so the backend rejects with 401 before ever revoking the
  // refresh-token cookie — logout then silently no-ops and a page refresh logs the user back in.
  it("logout attaches the bearer access token", async () => {
    configureAuthIntegration({ getToken: () => "access-123", refresh: () => Promise.resolve(null), onUnauthorized: () => {} });
    mockFetchOnce({ success: true, message: "ok" });

    await logout();

    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer access-123");
  });

  it("logoutAll attaches the bearer access token", async () => {
    configureAuthIntegration({ getToken: () => "access-123", refresh: () => Promise.resolve(null), onUnauthorized: () => {} });
    mockFetchOnce({ success: true, message: "ok" });

    await logoutAll();

    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer access-123");
  });

  it("fetchCurrentUser attaches the bearer access token", async () => {
    configureAuthIntegration({ getToken: () => "access-123", refresh: () => Promise.resolve(null), onUnauthorized: () => {} });
    mockFetchOnce({
      success: true,
      message: "ok",
      data: { user: { id: "2", name: "Admin One", email: "admin@bazm.test", role: "ADMIN" } },
    });

    await fetchCurrentUser();

    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer access-123");
  });
});
