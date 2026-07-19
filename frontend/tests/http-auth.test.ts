// frontend/tests/http-auth.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, authHttp, configureAuthIntegration, http } from "../src/api/http";

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  configureAuthIntegration({
    getToken: () => null,
    refresh: () => Promise.resolve(null),
    onUnauthorized: () => {},
  });
});

describe("authHttp", () => {
  it("attaches a bearer token when one is configured", async () => {
    configureAuthIntegration({
      getToken: () => "access-123",
      refresh: () => Promise.resolve(null),
      onUnauthorized: () => {},
    });
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: true, message: "ok", data: { ok: true } }));

    await authHttp.get("/staff");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer access-123");
  });

  it("does not attach a bearer token on the plain http client", async () => {
    configureAuthIntegration({
      getToken: () => "access-123",
      refresh: () => Promise.resolve(null),
      onUnauthorized: () => {},
    });
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: true, message: "ok", data: { ok: true } }));

    await http.get("/guest/menu");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("on a 401, refreshes once and retries the original request", async () => {
    let currentToken = "expired-token";
    const refresh = vi.fn().mockImplementation(async () => {
      currentToken = "fresh-token";
      return currentToken;
    });
    configureAuthIntegration({ getToken: () => currentToken, refresh, onUnauthorized: () => {} });

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { success: false, message: "expired", error: { code: "UNAUTHORIZED" } }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, message: "ok", data: { orders: [] } }));

    const result = await authHttp.get<{ orders: unknown[] }>("/orders");

    expect(result.orders).toEqual([]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, secondInit] = fetchMock.mock.calls[1];
    expect(secondInit.headers.Authorization).toBe("Bearer fresh-token");
  });

  it("collapses concurrent 401s into a single refresh call", async () => {
    const refresh = vi.fn().mockResolvedValue("fresh-token");
    configureAuthIntegration({ getToken: () => "expired-token", refresh, onUnauthorized: () => {} });

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { success: false, message: "expired", error: { code: "UNAUTHORIZED" } }))
      .mockResolvedValueOnce(jsonResponse(401, { success: false, message: "expired", error: { code: "UNAUTHORIZED" } }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, message: "ok", data: { a: 1 } }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, message: "ok", data: { b: 2 } }));

    const [a, b] = await Promise.all([authHttp.get("/orders"), authHttp.get("/payments")]);

    expect(a).toEqual({ a: 1 });
    expect(b).toEqual({ b: 2 });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("calls onUnauthorized and throws when refresh fails", async () => {
    const onUnauthorized = vi.fn();
    configureAuthIntegration({
      getToken: () => "expired-token",
      refresh: () => Promise.resolve(null),
      onUnauthorized,
    });

    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { success: false, message: "expired", error: { code: "UNAUTHORIZED" } }),
    );

    await expect(authHttp.get("/orders")).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never attempts refresh for a 401 on the plain http client", async () => {
    const refresh = vi.fn().mockResolvedValue("fresh-token");
    configureAuthIntegration({ getToken: () => null, refresh, onUnauthorized: () => {} });

    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { success: false, message: "bad guest session", error: { code: "UNAUTHORIZED" } }),
    );

    await expect(http.get("/guest/sessions/current")).rejects.toBeInstanceOf(ApiError);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("calls onUnauthorized and throws an ApiError (not the raw error) when refresh rejects", async () => {
    const onUnauthorized = vi.fn();
    const refresh = vi.fn().mockRejectedValue(new Error("refresh endpoint down"));
    configureAuthIntegration({ getToken: () => "expired-token", refresh, onUnauthorized });

    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { success: false, message: "expired", error: { code: "UNAUTHORIZED" } }),
    );

    await expect(authHttp.get("/orders")).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("calls onUnauthorized and throws an ApiError when the post-refresh retry is still 401", async () => {
    const onUnauthorized = vi.fn();
    const refresh = vi.fn().mockResolvedValue("fresh-token");
    configureAuthIntegration({ getToken: () => "expired-token", refresh, onUnauthorized });

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { success: false, message: "expired", error: { code: "UNAUTHORIZED" } }))
      .mockResolvedValueOnce(jsonResponse(401, { success: false, message: "still expired", error: { code: "UNAUTHORIZED" } }));

    await expect(authHttp.get("/orders")).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
