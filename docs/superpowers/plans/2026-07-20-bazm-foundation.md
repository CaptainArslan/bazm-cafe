# BAZM Foundation (Staff/Admin Auth, HTTP, Router, Toast, Socket) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Staff and Admin frontend areas the shared infrastructure they currently have zero of — authenticated HTTP calls with concurrency-safe token refresh, an in-memory auth store, role-based router guards, a toast system, shared formatting/status utilities, and a socket client that can authenticate as staff/admin — so that the two later plans (Staff screens, Admin screens) can be built purely as feature work on top of a proven foundation.

**Architecture:** Extend the existing `fetch`-based `src/api/http.ts` (no Axios — this repo has none, and the guest flow already proves the fetch wrapper works) with a second `authHttp` export that attaches a bearer token and does single-flight 401-refresh-and-retry. A new `auth.store.ts` owns the in-memory access token/user and registers itself with `http.ts` via a plain callback-configuration function (not a direct import) to avoid a Pinia-store ↔ module circular dependency. Router gains `meta.role` on the (currently placeholder) `/staff` and `/admin` trees plus two login routes. A tiny Pinia `toast.store.ts` + `ToastContainer.vue` becomes the one notification entry point. The existing guest customer flow is untouched — none of its files are modified except `App.vue` (to mount the toast container) and `src/router/index.ts` (to add routes/guard branches alongside the existing guest guard).

**Tech Stack:** Vue 3 `<script setup>` + TypeScript (strict), Pinia (setup-store style, matching existing stores), vee-validate + zod (matching `CheckoutView.vue`), vitest + @vue/test-utils, Tailwind utility classes with the existing `bz-*` design tokens (see `src/styles/tokens.css`).

## Global Constraints

- No new npm dependency — build on the existing `fetch` wrapper, not Axios. (User decision, 2026-07-20.)
- Access token lives in memory only (a `ref` inside a Pinia store) — never `localStorage`/`sessionStorage`. This matches the guest-session precedent (session identity lives in an httpOnly cookie + server lookup, nothing sensitive in web storage).
- `orderStatus` and `paymentStatus` must always be modeled/labeled/colored as two separate systems — never merged into one "status" field or map, in any utility created here.
- Never read or parse the httpOnly `bazm_refresh_token`/`bazm_guest_session`/`bazm_receipt_access`/`bazm_device_id` cookies in JavaScript — the browser attaches them automatically via `credentials: "include"`, which `http.ts` already sets on every request.
- Never log or surface a raw token, cookie value, password, or backend stack trace in a toast, console, or UI string.
- Match existing code style exactly: relative imports (this repo's files use `../../api/http`, not the `@/` tsconfig alias, despite the alias being configured — follow what the code actually does), double quotes, semicolons, trailing commas, Pinia "setup store" functions (`ref`/`computed` + returned object, not the options-store style).
- Every new/changed file must pass `npm run typecheck` and `npm run lint` (run from `frontend/`) and every new/changed test must pass `npm run test` (`vitest run`).
- Do not modify any file under `src/views/customer/`, `src/api/guest-sessions.ts`, `src/api/menu.ts`, `src/api/orders.ts`, `src/stores/cart.store.ts`, `src/stores/menu.store.ts`, or `src/stores/orders.store.ts` in this plan — the guest flow is proven and out of scope.

---

### Task 1: Auth types and API module

**Files:**
- Create: `frontend/src/types/auth.ts`
- Create: `frontend/src/api/auth.ts`
- Test: `frontend/tests/api-auth.test.ts`

**Interfaces:**
- Produces: `UserRole` (`"ADMIN" | "STAFF"`), `SafeUser { id: string; name: string; email: string; role: UserRole }`, `AuthSessionResult { accessToken: string; user: SafeUser }`.
- Produces: `login(input: { email: string; password: string; deviceName?: string }): Promise<AuthSessionResult>`, `refreshSession(): Promise<AuthSessionResult>`, `fetchCurrentUser(): Promise<SafeUser>`, `logout(): Promise<void>`, `logoutAll(): Promise<void>` — all from `frontend/src/api/auth.ts`.
- Consumes: `http` from `../api/http` (existing, unauthenticated client — login/refresh/logout use the plain cookie-based client, never the bearer client, per the master spec's "do not refresh on login/refresh/logout" rule).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/api-auth.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchCurrentUser, login, logout, logoutAll, refreshSession } from "../src/api/auth";

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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `frontend/`): `npx vitest run tests/api-auth.test.ts`
Expected: FAIL — `Cannot find module '../src/api/auth'`

- [ ] **Step 3: Write `src/types/auth.ts`**

```ts
// frontend/src/types/auth.ts
export const UserRole = {
  ADMIN: "ADMIN",
  STAFF: "STAFF",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type AuthSessionResult = {
  accessToken: string;
  user: SafeUser;
};
```

- [ ] **Step 4: Write `src/api/auth.ts`**

```ts
// frontend/src/api/auth.ts
import { http } from "./http";
import type { AuthSessionResult, SafeUser } from "../types/auth";

export function login(input: { email: string; password: string; deviceName?: string }) {
  return http.post<AuthSessionResult>("/auth/login", input);
}

export function refreshSession() {
  return http.post<AuthSessionResult>("/auth/refresh");
}

export function fetchCurrentUser() {
  return http.get<{ user: SafeUser }>("/auth/me").then((result) => result.user);
}

export function logout() {
  return http.post<void>("/auth/logout");
}

export function logoutAll() {
  return http.post<void>("/auth/logout-all");
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/api-auth.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/auth.ts frontend/src/api/auth.ts frontend/tests/api-auth.test.ts
git commit -m "feat(frontend): add auth types and auth API module"
```

---

### Task 2: Extend the HTTP client with an authenticated client and single-flight refresh

**Files:**
- Modify: `frontend/src/api/http.ts`
- Test: `frontend/tests/http-auth.test.ts`

**Interfaces:**
- Consumes: nothing new (self-contained module).
- Produces: `configureAuthIntegration(config: { getToken: () => string | null; refresh: () => Promise<string | null>; onUnauthorized: () => void }): void`, and a new `authHttp` export with the same shape as `http` (`get/post/patch/put/delete`), where every call attaches `Authorization: Bearer <token>` (when a token exists) and, on a `401` response, performs at most one shared in-flight refresh for all concurrent callers, retries the original request once, and calls `onUnauthorized()` if refresh fails or no refresh handler is configured. `http` (existing export) is unchanged in behavior — it never attaches a token and never triggers refresh, so the guest flow is unaffected.
- Task 4 (`auth.store.ts`) will call `configureAuthIntegration(...)` — until then, `authHttp` has no configured integration and any `401` on an `authHttp` call simply throws the `ApiError` as before (no refresh attempt), which is exercised explicitly in this task's tests.

- [ ] **Step 1: Write the failing test**

```ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/http-auth.test.ts`
Expected: FAIL — `authHttp`/`configureAuthIntegration` are not exported.

- [ ] **Step 3: Rewrite `src/api/http.ts`**

```ts
// frontend/src/api/http.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

type ApiErrorPayload = {
  code: string;
  details?: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, message: string, error: ApiErrorPayload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = error.code;
    this.details = error.details;
  }
}

type ApiSuccessBody<T> = {
  success: true;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
};

type ApiErrorBody = {
  success: false;
  message: string;
  error: ApiErrorPayload;
};

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

type AuthedRequestOptions = RequestOptions & {
  /** @internal set by the retry-after-refresh path; callers never set this. */
  _isRetryAfterRefresh?: boolean;
};

type AuthIntegration = {
  getToken: () => string | null;
  refresh: () => Promise<string | null>;
  onUnauthorized: () => void;
};

let authIntegration: AuthIntegration = {
  getToken: () => null,
  refresh: () => Promise.resolve(null),
  onUnauthorized: () => {},
};

let inFlightRefresh: Promise<string | null> | null = null;

export function configureAuthIntegration(config: AuthIntegration): void {
  authIntegration = config;
}

function refreshOnce(): Promise<string | null> {
  if (!inFlightRefresh) {
    inFlightRefresh = authIntegration.refresh().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

async function request<T>(path: string, options: AuthedRequestOptions = {}, useAuth = false): Promise<T> {
  const { body, headers, _isRetryAfterRefresh, ...rest } = options;

  const token = useAuth ? authIntegration.getToken() : null;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  const payload = (await response.json().catch(() => null)) as
    | ApiSuccessBody<T>
    | ApiErrorBody
    | null;

  if (!response.ok || !payload || payload.success === false) {
    if (useAuth && response.status === 401 && !_isRetryAfterRefresh) {
      const newToken = await refreshOnce();
      if (newToken) {
        return request<T>(path, { ...options, _isRetryAfterRefresh: true }, true);
      }
      authIntegration.onUnauthorized();
    }

    const errorPayload = payload && payload.success === false ? payload.error : undefined;
    throw new ApiError(
      response.status,
      payload?.message ?? "An unexpected error occurred.",
      errorPayload ?? { code: "UNKNOWN_ERROR" },
    );
  }

  return payload.data as T;
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }, false),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }, false),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }, false),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }, false),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }, false),
};

export const authHttp = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }, true),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }, true),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }, true),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }, true),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }, true),
};
```

Note for the implementer: `authHttp` does **not** support `FormData` bodies yet — media upload (`POST /api/v1/media`) needs multipart, which the Admin/Staff media-upload task (in the Admin plan) will extend `request()` for by skipping the `JSON.stringify`/`Content-Type: application/json` branch when `body instanceof FormData`. Out of scope here; do not add it speculatively in this task.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/http-auth.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Run the full existing test suite to confirm no regression**

Run: `npx vitest run`
Expected: all existing tests (including `tests/smoke.test.ts` and any guest-flow tests) still PASS — the guest-facing `http` export's runtime behavior for non-auth calls is byte-identical to before.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/http.ts frontend/tests/http-auth.test.ts
git commit -m "feat(frontend): add authenticated HTTP client with single-flight refresh"
```

---

### Task 3: Session-expired bus and toast system

**Files:**
- Create: `frontend/src/lib/session-expired-bus.ts`
- Create: `frontend/src/stores/toast.store.ts`
- Create: `frontend/src/components/feedback/ToastContainer.vue`
- Test: `frontend/tests/toast-store.test.ts`

**Interfaces:**
- Produces: `registerSessionExpiredHandler(handler: () => void): void`, `emitSessionExpired(): void` (`session-expired-bus.ts`) — a dependency-free pub/sub of exactly one handler slot, used so `auth.store.ts` (Task 4) can signal "the user got logged out" without importing the router, and `router/index.ts` (Task 7) can react without importing the auth store, avoiding a circular import.
- Produces: `useToastStore()` with state `toasts: ToastItem[]` (`ToastItem = { id: number; type: "success" | "error" | "info"; message: string }`) and actions `push(type: ToastItem["type"], message: string): void`, `dismiss(id: number): void`. Duplicate `push` calls with the same `type`+`message` within 3000ms are ignored (no duplicate toast).
- Consumes: nothing new.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/toast-store.test.ts
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useToastStore } from "../src/stores/toast.store";

beforeEach(() => {
  setActivePinia(createPinia());
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("toast store", () => {
  it("pushes a toast with a generated id", () => {
    const store = useToastStore();
    store.push("success", "Payment recorded.");
    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0].message).toBe("Payment recorded.");
    expect(store.toasts[0].type).toBe("success");
  });

  it("dedupes an identical type+message within 3 seconds", () => {
    const store = useToastStore();
    store.push("error", "Network error, please retry.");
    store.push("error", "Network error, please retry.");
    expect(store.toasts).toHaveLength(1);
  });

  it("allows the same message again after the dedupe window passes", () => {
    const store = useToastStore();
    store.push("error", "Network error, please retry.");
    vi.advanceTimersByTime(3001);
    store.push("error", "Network error, please retry.");
    expect(store.toasts).toHaveLength(2);
  });

  it("dismiss removes a toast by id", () => {
    const store = useToastStore();
    store.push("info", "Reconnected.");
    const id = store.toasts[0].id;
    store.dismiss(id);
    expect(store.toasts).toHaveLength(0);
  });

  it("auto-dismisses a toast after 5 seconds", () => {
    const store = useToastStore();
    store.push("success", "Saved.");
    expect(store.toasts).toHaveLength(1);
    vi.advanceTimersByTime(5001);
    expect(store.toasts).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/toast-store.test.ts`
Expected: FAIL — `Cannot find module '../src/stores/toast.store'`

- [ ] **Step 3: Write `src/lib/session-expired-bus.ts`**

```ts
// frontend/src/lib/session-expired-bus.ts
type Handler = () => void;

let handler: Handler | null = null;

export function registerSessionExpiredHandler(next: Handler): void {
  handler = next;
}

export function emitSessionExpired(): void {
  handler?.();
}
```

- [ ] **Step 4: Write `src/stores/toast.store.ts`**

```ts
// frontend/src/stores/toast.store.ts
import { defineStore } from "pinia";
import { ref } from "vue";

export type ToastType = "success" | "error" | "info";

export type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
};

const DEDUPE_WINDOW_MS = 3000;
const AUTO_DISMISS_MS = 5000;

export const useToastStore = defineStore("toast", () => {
  const toasts = ref<ToastItem[]>([]);
  let nextId = 1;
  let lastPush: { type: ToastType; message: string; at: number } | null = null;

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }

  function push(type: ToastType, message: string): void {
    const now = Date.now();
    if (lastPush && lastPush.type === type && lastPush.message === message && now - lastPush.at < DEDUPE_WINDOW_MS) {
      return;
    }
    lastPush = { type, message, at: now };

    const id = nextId++;
    toasts.value = [...toasts.value, { id, type, message }];
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
  }

  return { toasts, push, dismiss };
});
```

Note for the implementer: this store uses `Date.now()`/`setTimeout`, which is fine in application code — the "no `Date.now()`" restriction in this workflow tooling applies only to *workflow orchestration scripts*, not to the app being built.

- [ ] **Step 5: Write `src/components/feedback/ToastContainer.vue`**

```vue
<!-- frontend/src/components/feedback/ToastContainer.vue -->
<script setup lang="ts">
import { storeToRefs } from "pinia";

import { useToastStore } from "../../stores/toast.store";

const toastStore = useToastStore();
const { toasts } = storeToRefs(toastStore);

const typeClasses: Record<string, string> = {
  success: "bg-bz-ink-900 text-white",
  error: "bg-bz-red text-white",
  info: "bg-white text-bz-ink-900 border border-bz-border",
};
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
    <TransitionGroup name="toast" tag="div" class="flex w-full max-w-sm flex-col gap-2">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm shadow-bz-sm"
        :class="typeClasses[toast.type]"
        role="status"
      >
        <span>{{ toast.message }}</span>
        <button type="button" class="shrink-0 opacity-70 hover:opacity-100" @click="toastStore.dismiss(toast.id)">
          ✕
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/toast-store.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/session-expired-bus.ts frontend/src/stores/toast.store.ts frontend/src/components/feedback/ToastContainer.vue frontend/tests/toast-store.test.ts
git commit -m "feat(frontend): add toast store/container and session-expired bus"
```

---

### Task 4: Auth store

**Files:**
- Create: `frontend/src/stores/auth.store.ts`
- Test: `frontend/tests/auth-store.test.ts`

**Interfaces:**
- Consumes: `login, refreshSession, fetchCurrentUser, logout, logoutAll` from `../api/auth` (Task 1); `configureAuthIntegration` from `../api/http` (Task 2); `emitSessionExpired` from `../lib/session-expired-bus` (Task 3); `disconnectSocket` from `../socket/client` (existing).
- Produces: `useAuthStore()` with state `user: Ref<SafeUser | null>`, `status: Ref<"idle" | "restoring" | "ready">`, computed `isAuthenticated: boolean`, `role: UserRole | null`; actions `login(email, password, deviceName?): Promise<SafeUser>`, `restore(): Promise<void>`, `logout(): Promise<void>`, `logoutAll(): Promise<void>`. This is the interface Task 6 (router guards) and Task 8 (login views) consume.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth-store.test.ts`
Expected: FAIL — `Cannot find module '../src/stores/auth.store'`

- [ ] **Step 3: Write `src/stores/auth.store.ts`**

```ts
// frontend/src/stores/auth.store.ts
import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { fetchCurrentUser, login as loginRequest, logout as logoutRequest, logoutAll as logoutAllRequest, refreshSession } from "../api/auth";
import { configureAuthIntegration } from "../api/http";
import { emitSessionExpired } from "../lib/session-expired-bus";
import { disconnectSocket } from "../socket/client";
import type { SafeUser, UserRole } from "../types/auth";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<SafeUser | null>(null);
  const accessToken = ref<string | null>(null);
  const status = ref<"idle" | "restoring" | "ready">("idle");

  const isAuthenticated = computed(() => user.value !== null && accessToken.value !== null);
  const role = computed<UserRole | null>(() => user.value?.role ?? null);

  function setSession(nextToken: string, nextUser: SafeUser): void {
    accessToken.value = nextToken;
    user.value = nextUser;
  }

  function clearSession(): void {
    accessToken.value = null;
    user.value = null;
  }

  async function login(email: string, password: string, deviceName?: string): Promise<SafeUser> {
    const result = await loginRequest({ email, password, deviceName });
    setSession(result.accessToken, result.user);
    return result.user;
  }

  async function restore(): Promise<void> {
    if (status.value !== "idle") {
      return;
    }
    status.value = "restoring";
    try {
      const result = await refreshSession();
      setSession(result.accessToken, result.user);
    } catch {
      clearSession();
    } finally {
      status.value = "ready";
    }
  }

  async function refreshUser(): Promise<void> {
    if (!isAuthenticated.value) {
      return;
    }
    user.value = await fetchCurrentUser();
  }

  async function logout(): Promise<void> {
    try {
      await logoutRequest();
    } catch {
      // Clear client state regardless of network failure, per spec.
    }
    clearSession();
    disconnectSocket();
  }

  async function logoutAll(): Promise<void> {
    try {
      await logoutAllRequest();
    } catch {
      // Clear client state regardless of network failure, per spec.
    }
    clearSession();
    disconnectSocket();
  }

  configureAuthIntegration({
    getToken: () => accessToken.value,
    refresh: async () => {
      try {
        const result = await refreshSession();
        setSession(result.accessToken, result.user);
        return result.accessToken;
      } catch {
        clearSession();
        return null;
      }
    },
    onUnauthorized: () => {
      const wasAuthenticated = isAuthenticated.value;
      clearSession();
      disconnectSocket();
      if (wasAuthenticated) {
        emitSessionExpired();
      }
    },
  });

  return { user, status, isAuthenticated, role, login, restore, refreshUser, logout, logoutAll };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/auth-store.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/stores/auth.store.ts frontend/tests/auth-store.test.ts
git commit -m "feat(frontend): add auth store wired to http refresh integration"
```

---

### Task 5: Shared formatting utilities and status-label maps

**Files:**
- Create: `frontend/src/utils/error-message.ts`
- Create: `frontend/src/utils/currency.ts`
- Create: `frontend/src/utils/datetime.ts`
- Create: `frontend/src/utils/media-url.ts`
- Create: `frontend/src/utils/idempotency.ts`
- Create: `frontend/src/constants/order-status-labels.ts`
- Create: `frontend/src/constants/payment-status-labels.ts`
- Test: `frontend/tests/shared-utils.test.ts`

**Interfaces:**
- Produces: `toUserSafeErrorMessage(error: unknown): string` — maps `ApiError` by HTTP status bucket (401 → session message, 403 → permission message, 409 → conflict message using the server's own message when present, 422 → validation message, 5xx → generic server message, non-`ApiError`/network failure → offline message) and otherwise falls back to `error.message` (the backend already returns user-safe messages).
- Produces: `formatCurrency(amount: string | number): string` (e.g. `"1250.50"` → `"Rs. 1,250.50"`), `formatDateTime(iso: string): string`, `formatDate(iso: string): string`.
- Produces: `resolveMediaUrl(path: string | null | undefined): string | null` — returns `null` for empty input, the value unchanged if it already starts with `http`, otherwise the relative path as-is (same-origin/proxy already serves `/uploads/...`, confirmed in `vite.config.ts`).
- Produces: `generateIdempotencyKey(): string` (`crypto.randomUUID()`).
- Produces: `ORDER_STATUS_LABELS: Record<OrderStatus, { label: string; color: string }>` and `PAYMENT_STATUS_LABELS: Record<OrderPaymentStatus, { label: string; color: string }>` — **two separate maps, never merged**, consumed later by Staff/Admin order-list/detail screens.
- Consumes: `ApiError` from `../api/http`; `OrderStatus`, `OrderPaymentStatus` from `../types/enums` (existing).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/shared-utils.test.ts
import { describe, expect, it } from "vitest";

import { ApiError } from "../src/api/http";
import { ORDER_STATUS_LABELS } from "../src/constants/order-status-labels";
import { PAYMENT_STATUS_LABELS } from "../src/constants/payment-status-labels";
import { formatCurrency, formatDate, formatDateTime } from "../src/utils/currency";
import { toUserSafeErrorMessage } from "../src/utils/error-message";
import { generateIdempotencyKey } from "../src/utils/idempotency";
import { resolveMediaUrl } from "../src/utils/media-url";

describe("formatCurrency", () => {
  it("formats a decimal string with thousands separators", () => {
    expect(formatCurrency("1250.5")).toBe("Rs. 1,250.50");
  });
  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("Rs. 0.00");
  });
});

describe("formatDateTime / formatDate", () => {
  it("formats an ISO timestamp", () => {
    expect(formatDateTime("2026-07-20T10:30:00.000Z")).toEqual(expect.any(String));
  });
  it("formats a date only", () => {
    expect(formatDate("2026-07-20T10:30:00.000Z")).toEqual(expect.any(String));
  });
});

describe("resolveMediaUrl", () => {
  it("returns null for empty input", () => {
    expect(resolveMediaUrl(null)).toBeNull();
    expect(resolveMediaUrl(undefined)).toBeNull();
    expect(resolveMediaUrl("")).toBeNull();
  });
  it("passes through an absolute URL unchanged", () => {
    expect(resolveMediaUrl("https://cdn.example.com/x.png")).toBe("https://cdn.example.com/x.png");
  });
  it("passes through a relative path unchanged", () => {
    expect(resolveMediaUrl("/uploads/media/products/x.png")).toBe("/uploads/media/products/x.png");
  });
});

describe("toUserSafeErrorMessage", () => {
  it("maps a 401 to a session-expired message", () => {
    expect(toUserSafeErrorMessage(new ApiError(401, "jwt malformed", { code: "UNAUTHORIZED" }))).toMatch(/session/i);
  });
  it("maps a 403 to a permission message", () => {
    expect(toUserSafeErrorMessage(new ApiError(403, "forbidden", { code: "FORBIDDEN" }))).toMatch(/permission/i);
  });
  it("passes through the backend message for a 409 conflict", () => {
    expect(
      toUserSafeErrorMessage(new ApiError(409, "Only a pending order can be accepted.", { code: "INVALID_ORDER_TRANSITION" })),
    ).toBe("Only a pending order can be accepted.");
  });
  it("maps a network failure to an offline message", () => {
    expect(toUserSafeErrorMessage(new TypeError("Failed to fetch"))).toMatch(/connection|offline/i);
  });
});

describe("status label maps", () => {
  it("has an entry for every OrderStatus value and they are distinct from payment labels", () => {
    expect(Object.keys(ORDER_STATUS_LABELS).sort()).toEqual(
      ["ACCEPTED", "CANCELLED", "COMPLETED", "PENDING", "PREPARING", "READY", "REJECTED", "SERVED"].sort(),
    );
    expect(Object.keys(PAYMENT_STATUS_LABELS).sort()).toEqual(["PAID", "PARTIALLY_PAID", "REFUNDED", "UNPAID"].sort());
  });
});

describe("generateIdempotencyKey", () => {
  it("returns a distinct string each call", () => {
    expect(generateIdempotencyKey()).not.toBe(generateIdempotencyKey());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shared-utils.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `src/utils/currency.ts`**

```ts
// frontend/src/utils/currency.ts
export function formatCurrency(amount: string | number): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  const safeValue = Number.isFinite(value) ? value : 0;
  return `Rs. ${safeValue.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PK", { dateStyle: "medium" });
}
```

- [ ] **Step 4: Write `src/utils/media-url.ts`**

```ts
// frontend/src/utils/media-url.ts
export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) {
    return null;
  }
  return path;
}
```

- [ ] **Step 5: Write `src/utils/idempotency.ts`**

```ts
// frontend/src/utils/idempotency.ts
export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}
```

- [ ] **Step 6: Write `src/utils/error-message.ts`**

```ts
// frontend/src/utils/error-message.ts
import { ApiError } from "../api/http";

export function toUserSafeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        return "Your session has expired. Please sign in again.";
      case 403:
        return "You don't have permission to do that.";
      case 422:
        return error.message || "Please check the highlighted fields and try again.";
      case 409:
        return error.message || "That action can't be completed right now — please refresh and try again.";
      default:
        if (error.status >= 500) {
          return "Something went wrong on our end. Please try again in a moment.";
        }
        return error.message || "Something went wrong.";
    }
  }

  return "Couldn't reach the server. Check your connection and try again.";
}
```

- [ ] **Step 7: Write `src/constants/order-status-labels.ts`**

```ts
// frontend/src/constants/order-status-labels.ts
import { OrderStatus } from "../types/enums";

export const ORDER_STATUS_LABELS: Record<OrderStatus, { label: string; color: string }> = {
  [OrderStatus.PENDING]: { label: "Pending", color: "bz-amber" },
  [OrderStatus.ACCEPTED]: { label: "Accepted", color: "bz-blue" },
  [OrderStatus.PREPARING]: { label: "Preparing", color: "bz-blue" },
  [OrderStatus.READY]: { label: "Ready", color: "bz-teal" },
  [OrderStatus.SERVED]: { label: "Served", color: "bz-teal" },
  [OrderStatus.COMPLETED]: { label: "Completed", color: "bz-green" },
  [OrderStatus.REJECTED]: { label: "Rejected", color: "bz-red" },
  [OrderStatus.CANCELLED]: { label: "Cancelled", color: "bz-red" },
};
```

- [ ] **Step 8: Write `src/constants/payment-status-labels.ts`**

```ts
// frontend/src/constants/payment-status-labels.ts
import { OrderPaymentStatus } from "../types/enums";

export const PAYMENT_STATUS_LABELS: Record<OrderPaymentStatus, { label: string; color: string }> = {
  [OrderPaymentStatus.UNPAID]: { label: "Unpaid", color: "bz-red" },
  [OrderPaymentStatus.PARTIALLY_PAID]: { label: "Partially Paid", color: "bz-amber" },
  [OrderPaymentStatus.PAID]: { label: "Paid", color: "bz-green" },
  [OrderPaymentStatus.REFUNDED]: { label: "Refunded", color: "bz-ink-500" },
};
```

Note for the implementer: the `bz-amber`/`bz-blue`/`bz-teal`/`bz-green` color tokens must exist in `src/styles/tokens.css` before Staff/Admin screens consume these maps for actual Tailwind classes — check `tokens.css` when building the first component that renders a status pill; if a token is missing, add it there rather than hardcoding a raw hex/Tailwind color in a screen component. That token-file edit is deferred to the first Staff/Admin plan task that needs it, not done speculatively here.

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run tests/shared-utils.test.ts`
Expected: PASS (all cases)

- [ ] **Step 10: Commit**

```bash
git add frontend/src/utils/currency.ts frontend/src/utils/media-url.ts frontend/src/utils/idempotency.ts frontend/src/utils/error-message.ts frontend/src/constants/order-status-labels.ts frontend/src/constants/payment-status-labels.ts frontend/tests/shared-utils.test.ts
git commit -m "feat(frontend): add shared formatting utilities and status label maps"
```

---

### Task 6: Socket client bearer-token support

**Files:**
- Modify: `frontend/src/socket/client.ts`
- Test: `frontend/tests/socket-client.test.ts`

**Interfaces:**
- Produces: `getSocket(): Socket` (unchanged signature), `connectSocket(): Socket` (unchanged), `disconnectSocket(): void` (unchanged), plus new `setSocketAuthToken(token: string | null): void` — updates the socket's `auth` payload; if the socket already exists and is connected, disconnects and reconnects so the new handshake takes effect (matching backend behavior: `socket.handshake.auth.token` is only read at connect time).
- Consumes: `socket.io-client` (existing dependency).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/socket-client.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("socket.io-client", () => {
  const instances: Array<Record<string, unknown>> = [];
  return {
    io: vi.fn((opts: Record<string, unknown>) => {
      const instance = {
        opts,
        connected: false,
        connect: vi.fn(function (this: { connected: boolean }) {
          this.connected = true;
        }),
        disconnect: vi.fn(function (this: { connected: boolean }) {
          this.connected = false;
        }),
      };
      instances.push(instance);
      return instance;
    }),
    __instances: instances,
  };
});

afterEach(() => {
  vi.resetModules();
});

describe("socket client", () => {
  it("connects with no auth token by default", async () => {
    const { getSocket } = await import("../src/socket/client");
    const socket = getSocket() as unknown as { opts: { auth?: { token?: string } } };
    expect(socket.opts.auth).toEqual({});
  });

  it("setSocketAuthToken updates the auth payload used on the next connect", async () => {
    const { getSocket, setSocketAuthToken } = await import("../src/socket/client");
    setSocketAuthToken("access-123");
    const socket = getSocket() as unknown as { opts: { auth?: { token?: string } } };
    expect(socket.opts.auth).toEqual({ token: "access-123" });
  });

  it("reconnects an already-connected socket when the token changes", async () => {
    const { connectSocket, setSocketAuthToken } = await import("../src/socket/client");
    const socket = connectSocket() as unknown as {
      connected: boolean;
      connect: () => void;
      disconnect: () => void;
    };
    expect(socket.connected).toBe(true);

    const disconnectSpy = vi.spyOn(socket, "disconnect");
    const connectSpy = vi.spyOn(socket, "connect");

    setSocketAuthToken("new-token");

    expect(disconnectSpy).toHaveBeenCalled();
    expect(connectSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/socket-client.test.ts`
Expected: FAIL — `setSocketAuthToken` is not exported.

- [ ] **Step 3: Rewrite `src/socket/client.ts`**

```ts
// frontend/src/socket/client.ts
import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;
let authToken: string | null = null;

function buildSocket(): Socket {
  return io({
    path: "/socket.io",
    withCredentials: true,
    autoConnect: false,
    transports: ["websocket", "polling"],
    auth: authToken ? { token: authToken } : {},
  });
}

export function getSocket(): Socket {
  if (socket) {
    return socket;
  }

  socket = buildSocket();
  return socket;
}

export function connectSocket(): Socket {
  const instance = getSocket();

  if (!instance.connected) {
    instance.connect();
  }

  return instance;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}

export function setSocketAuthToken(token: string | null): void {
  if (authToken === token) {
    return;
  }
  authToken = token;

  const wasConnected = socket?.connected ?? false;
  socket?.disconnect();
  socket = buildSocket();

  if (wasConnected) {
    socket.connect();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/socket-client.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/socket/client.ts frontend/tests/socket-client.test.ts
git commit -m "feat(frontend): support bearer-token auth on the socket client"
```

---

### Task 7: Router role guards and login routes

**Files:**
- Modify: `frontend/src/router/index.ts`
- Test: `frontend/tests/router-guards.test.ts`

**Interfaces:**
- Consumes: `useAuthStore` (Task 4). Adds route names `staff.login`, `admin.login` (components created in Task 8 — this task can reference them by path; if Task 8 hasn't run yet in a strict sequential execution, use a temporary inline placeholder component only long enough to prove the guard, then swap the import in Task 8's step — **do not leave a placeholder in committed code**; execute Task 8 immediately after this task, before committing this task if working non-sequentially. In the intended execution order below, Task 8 follows immediately.)
- Produces: `meta.role: "STAFF" | "ADMIN"` on protected routes, `meta.publicOnlyRole` on the two login routes.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/router-guards.test.ts
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../src/stores/auth.store";

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("router role guards", () => {
  it("redirects an unauthenticated visitor away from /staff to staff.login", async () => {
    const router = (await import("../src/router")).default;
    await router.push("/staff");
    await router.isReady();
    expect(router.currentRoute.value.name).toBe("staff.login");
  });

  it("redirects an unauthenticated visitor away from /admin to admin.login", async () => {
    const router = (await import("../src/router")).default;
    await router.push("/admin");
    await router.isReady();
    expect(router.currentRoute.value.name).toBe("admin.login");
  });

  it("lets an authenticated STAFF user reach /staff", async () => {
    const authStore = useAuthStore();
    // @ts-expect-error -- test seam: writing directly to the store's internal refs to simulate an authenticated session
    authStore.user = { id: "1", name: "Ada", email: "ada@bazm.test", role: "STAFF" };
    // @ts-expect-error -- see above
    authStore.status = "ready";

    const router = (await import("../src/router")).default;
    await router.push("/staff");
    await router.isReady();
    expect(router.currentRoute.value.name).toBe("staff.home");
  });

  it("sends an authenticated STAFF user away from /admin to staff.home", async () => {
    const authStore = useAuthStore();
    // @ts-expect-error -- test seam
    authStore.user = { id: "1", name: "Ada", email: "ada@bazm.test", role: "STAFF" };
    // @ts-expect-error -- test seam
    authStore.status = "ready";

    const router = (await import("../src/router")).default;
    await router.push("/admin");
    await router.isReady();
    expect(router.currentRoute.value.name).toBe("staff.home");
  });
});
```

Note for the implementer: Pinia setup-store refs are writable in tests via direct property assignment because Pinia proxies them; if `@ts-expect-error` above turns out unnecessary once written against the real store, remove it rather than leaving an unused suppression (the `noUnusedLocals`/strict config won't fail on this, but an unnecessary `@ts-expect-error` is itself a TS error under `strict`, so verify at Step 4).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/router-guards.test.ts`
Expected: FAIL — no `staff.login`/`admin.login` routes exist yet, so `router.currentRoute.value.name` is `undefined`/wrong.

- [ ] **Step 3: Modify `src/router/index.ts`**

```ts
// frontend/src/router/index.ts
import { createRouter, createWebHistory } from "vue-router";

import { useAuthStore } from "../stores/auth.store";
import { useGuestSessionStore } from "../stores/guest-session.store";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: () => import("../layouts/CustomerLayout.vue"),
      children: [
        {
          path: "",
          name: "customer.welcome",
          component: () => import("../views/customer/WelcomeView.vue"),
        },
        {
          path: "scan",
          name: "customer.scan-qr",
          component: () => import("../views/customer/ScanTableQrView.vue"),
        },
        {
          path: "t/:tableToken",
          name: "customer.dine-in-claim",
          component: () => import("../views/customer/DineInClaimView.vue"),
          props: true,
        },
        {
          path: "takeaway",
          name: "customer.takeaway-start",
          component: () => import("../views/customer/TakeawayStartView.vue"),
        },
        {
          path: "recover",
          name: "customer.recovery",
          component: () => import("../views/customer/RecoveryView.vue"),
        },
        {
          path: "menu",
          name: "customer.menu",
          component: () => import("../views/customer/MenuView.vue"),
          meta: { requiresSession: true },
        },
        {
          path: "products/:productId",
          name: "customer.product-detail",
          component: () => import("../views/customer/ProductDetailView.vue"),
          props: true,
          meta: { requiresSession: true },
        },
        {
          path: "cart",
          name: "customer.cart",
          component: () => import("../views/customer/CartView.vue"),
          meta: { requiresSession: true },
        },
        {
          path: "checkout",
          name: "customer.checkout",
          component: () => import("../views/customer/CheckoutView.vue"),
          meta: { requiresSession: true },
        },
        {
          path: "session",
          name: "customer.session",
          component: () => import("../views/customer/SessionView.vue"),
          meta: { requiresSession: true },
        },
        {
          path: "orders/:orderId",
          name: "customer.order-detail",
          component: () => import("../views/customer/OrderDetailView.vue"),
          props: true,
          meta: { requiresSession: true },
        },
        {
          path: "session-closed",
          name: "customer.session-closed",
          component: () => import("../views/customer/SessionClosedView.vue"),
        },
      ],
    },
    {
      path: "/staff",
      component: () => import("../layouts/StaffLayout.vue"),
      children: [
        {
          path: "login",
          name: "staff.login",
          component: () => import("../views/staff/LoginView.vue"),
          meta: { publicOnlyRole: "STAFF" },
        },
        {
          path: "",
          name: "staff.home",
          component: () => import("../views/staff/HomePlaceholder.vue"),
          meta: { role: "STAFF" },
        },
      ],
    },
    {
      path: "/admin",
      component: () => import("../layouts/AdminLayout.vue"),
      children: [
        {
          path: "login",
          name: "admin.login",
          component: () => import("../views/admin/LoginView.vue"),
          meta: { publicOnlyRole: "ADMIN" },
        },
        {
          path: "",
          name: "admin.home",
          component: () => import("../views/admin/HomePlaceholder.vue"),
          meta: { role: "ADMIN" },
        },
      ],
    },
  ],
});

function homeRouteNameFor(role: "STAFF" | "ADMIN"): string {
  return role === "ADMIN" ? "admin.home" : "staff.home";
}

function loginRouteNameFor(role: "STAFF" | "ADMIN"): string {
  return role === "ADMIN" ? "admin.login" : "staff.login";
}

router.beforeEach(async (to) => {
  if (to.meta.requiresSession === true) {
    const guestSessionStore = useGuestSessionStore();
    await guestSessionStore.ensureFetched();

    if (!guestSessionStore.isActive) {
      return { name: "customer.welcome" };
    }

    return true;
  }

  const requiredRole = to.meta.role as "STAFF" | "ADMIN" | undefined;
  const publicOnlyRole = to.meta.publicOnlyRole as "STAFF" | "ADMIN" | undefined;

  if (!requiredRole && !publicOnlyRole) {
    return true;
  }

  const authStore = useAuthStore();
  if (authStore.status === "idle") {
    await authStore.restore();
  }

  if (publicOnlyRole) {
    if (authStore.isAuthenticated && authStore.role === publicOnlyRole) {
      return { name: homeRouteNameFor(publicOnlyRole) };
    }
    return true;
  }

  if (!requiredRole) {
    return true;
  }

  if (!authStore.isAuthenticated) {
    return {
      name: loginRouteNameFor(requiredRole),
      query: to.fullPath !== "/" ? { redirect: to.fullPath } : undefined,
    };
  }

  if (authStore.role !== requiredRole) {
    return { name: homeRouteNameFor(authStore.role as "STAFF" | "ADMIN") };
  }

  return true;
});

export default router;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/router-guards.test.ts`
Expected: PASS (4 tests) — this will only fully pass once Task 8's `LoginView.vue` files exist as real files (dynamic `import()` targets are resolved lazily by vitest/vite, so a missing target only fails when that route is actually navigated to; `staff.login`/`admin.login` are navigated to in this test, so **do Task 8 before running this step** if executing tasks strictly in order — the two tasks are interdependent for the router test to go green, but each still has its own commit boundary and its own test file per the plan's task-per-file structure).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/router/index.ts frontend/tests/router-guards.test.ts
git commit -m "feat(frontend): add STAFF/ADMIN role guards and login routes"
```

---

### Task 8: Shared login form, login views, and authenticated placeholder shells

**Files:**
- Create: `frontend/src/components/auth/LoginForm.vue`
- Modify: `frontend/src/views/staff/HomePlaceholder.vue`
- Modify: `frontend/src/views/admin/HomePlaceholder.vue`
- Create: `frontend/src/views/staff/LoginView.vue`
- Create: `frontend/src/views/admin/LoginView.vue`
- Modify: `frontend/src/layouts/StaffLayout.vue`
- Modify: `frontend/src/layouts/AdminLayout.vue`
- Modify: `frontend/src/App.vue`
- Test: `frontend/tests/login-flow.test.ts`

**Interfaces:**
- `LoginForm.vue` emits `success: [user: SafeUser]` after a successful `authStore.login(...)` call and renders its own inline error via `toUserSafeErrorMessage` (Task 5) — it does not redirect itself, so both `StaffLoginView` and `AdminLoginView` can decide their own redirect target (respecting a `?redirect=` query param when present and safe — i.e. only if it starts with `/staff` or `/admin` respectively, to avoid an open redirect).
- Consumes: `useAuthStore` (Task 4), `useToastStore` (Task 3), `toUserSafeErrorMessage` (Task 5).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/login-flow.test.ts
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as authApi from "../src/api/auth";
import router from "../src/router";
import StaffLoginView from "../src/views/staff/LoginView.vue";

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("staff login view", () => {
  it("logs in and redirects to staff.home", async () => {
    vi.spyOn(authApi, "login").mockResolvedValue({
      accessToken: "tok-1",
      user: { id: "1", name: "Ada Staff", email: "ada@bazm.test", role: "STAFF" },
    });

    await router.push("/staff/login");
    await router.isReady();

    const wrapper = mount(StaffLoginView, {
      global: { plugins: [router] },
    });

    await wrapper.find('input[type="email"]').setValue("ada@bazm.test");
    await wrapper.find('input[type="password"]').setValue("secret123");
    await wrapper.find("form").trigger("submit");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await router.isReady();

    expect(router.currentRoute.value.name).toBe("staff.home");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/login-flow.test.ts`
Expected: FAIL — `src/views/staff/LoginView.vue` does not exist.

- [ ] **Step 3: Write `src/components/auth/LoginForm.vue`**

```vue
<!-- frontend/src/components/auth/LoginForm.vue -->
<script setup lang="ts">
import { toTypedSchema } from "@vee-validate/zod";
import { useForm } from "vee-validate";
import { ref } from "vue";
import { z } from "zod";

import { useAuthStore } from "../../stores/auth.store";
import { toUserSafeErrorMessage } from "../../utils/error-message";
import type { SafeUser } from "../../types/auth";
import BusinessRuleError from "../feedback/BusinessRuleError.vue";

defineProps<{ title: string }>();
const emit = defineEmits<{ success: [user: SafeUser] }>();

const authStore = useAuthStore();

const schema = toTypedSchema(
  z.object({
    email: z.string().trim().min(1, "Email is required.").email("Enter a valid email."),
    password: z.string().min(1, "Password is required."),
  }),
);

const { defineField, handleSubmit, errors, isSubmitting } = useForm({ validationSchema: schema });
const [email, emailAttrs] = defineField("email");
const [password, passwordAttrs] = defineField("password");

const serverError = ref("");

const onSubmit = handleSubmit(async (values) => {
  serverError.value = "";
  try {
    const user = await authStore.login(values.email, values.password);
    emit("success", user);
  } catch (caught) {
    serverError.value = toUserSafeErrorMessage(caught);
  }
});
</script>

<template>
  <form class="w-full max-w-sm space-y-4" @submit="onSubmit">
    <h1 class="text-xl font-bold text-bz-ink-900">{{ title }}</h1>

    <div>
      <label class="text-xs font-medium text-bz-ink-500">Email</label>
      <input
        v-model="email"
        v-bind="emailAttrs"
        type="email"
        autocomplete="username"
        class="mt-1 w-full rounded-xl border border-bz-border bg-white px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
      />
      <p v-if="errors.email" class="mt-1 text-xs text-bz-red">{{ errors.email }}</p>
    </div>

    <div>
      <label class="text-xs font-medium text-bz-ink-500">Password</label>
      <input
        v-model="password"
        v-bind="passwordAttrs"
        type="password"
        autocomplete="current-password"
        class="mt-1 w-full rounded-xl border border-bz-border bg-white px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
      />
      <p v-if="errors.password" class="mt-1 text-xs text-bz-red">{{ errors.password }}</p>
    </div>

    <BusinessRuleError v-if="serverError" :message="serverError" />

    <button
      type="submit"
      class="w-full rounded-full bg-bz-gold-600 py-3 text-sm font-medium text-white shadow-bz-sm disabled:opacity-60"
      :disabled="isSubmitting"
    >
      {{ isSubmitting ? "Signing in..." : "Sign in" }}
    </button>
  </form>
</template>
```

- [ ] **Step 4: Write `src/views/staff/LoginView.vue`**

```vue
<!-- frontend/src/views/staff/LoginView.vue -->
<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";

import LoginForm from "../../components/auth/LoginForm.vue";

const router = useRouter();
const route = useRoute();

function onSuccess(): void {
  const redirect = route.query.redirect;
  const target = typeof redirect === "string" && redirect.startsWith("/staff") ? redirect : "/staff";
  router.replace(target);
}
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center px-6">
    <LoginForm title="Staff Sign In" @success="onSuccess" />
  </main>
</template>
```

- [ ] **Step 5: Write `src/views/admin/LoginView.vue`**

```vue
<!-- frontend/src/views/admin/LoginView.vue -->
<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";

import LoginForm from "../../components/auth/LoginForm.vue";

const router = useRouter();
const route = useRoute();

function onSuccess(): void {
  const redirect = route.query.redirect;
  const target = typeof redirect === "string" && redirect.startsWith("/admin") ? redirect : "/admin";
  router.replace(target);
}
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center px-6">
    <LoginForm title="Admin Sign In" @success="onSuccess" />
  </main>
</template>
```

- [ ] **Step 6: Rewrite `src/views/staff/HomePlaceholder.vue`**

```vue
<!-- frontend/src/views/staff/HomePlaceholder.vue -->
<script setup lang="ts">
import { useRouter } from "vue-router";

import { useAuthStore } from "../../stores/auth.store";

const authStore = useAuthStore();
const router = useRouter();

async function onLogout(): Promise<void> {
  await authStore.logout();
  router.replace({ name: "staff.login" });
}
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
    <h1 class="text-xl font-bold text-bz-ink-900">Staff Dashboard</h1>
    <p class="text-sm text-bz-ink-500">
      Signed in as {{ authStore.user?.name }} ({{ authStore.role }}). The operational order queue is coming next.
    </p>
    <button
      type="button"
      class="rounded-full bg-bz-ink-900 px-5 py-2 text-sm font-medium text-white"
      @click="onLogout"
    >
      Sign out
    </button>
  </main>
</template>
```

- [ ] **Step 7: Rewrite `src/views/admin/HomePlaceholder.vue`**

```vue
<!-- frontend/src/views/admin/HomePlaceholder.vue -->
<script setup lang="ts">
import { useRouter } from "vue-router";

import { useAuthStore } from "../../stores/auth.store";

const authStore = useAuthStore();
const router = useRouter();

async function onLogout(): Promise<void> {
  await authStore.logout();
  router.replace({ name: "admin.login" });
}
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
    <h1 class="text-xl font-bold text-bz-ink-900">Admin Dashboard</h1>
    <p class="text-sm text-bz-ink-500">
      Signed in as {{ authStore.user?.name }} ({{ authStore.role }}). The back-office screens are coming next.
    </p>
    <button
      type="button"
      class="rounded-full bg-bz-ink-900 px-5 py-2 text-sm font-medium text-white"
      @click="onLogout"
    >
      Sign out
    </button>
  </main>
</template>
```

- [ ] **Step 8: Differentiate the two layouts and mount the toast container in `App.vue`**

```vue
<!-- frontend/src/layouts/StaffLayout.vue -->
<script setup lang="ts"></script>

<template>
  <div class="min-h-dvh bg-bz-bg font-sans text-bz-ink-900">
    <div class="border-b border-bz-border bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-bz-ink-500">
      BAZM Staff
    </div>
    <RouterView />
  </div>
</template>
```

```vue
<!-- frontend/src/layouts/AdminLayout.vue -->
<script setup lang="ts"></script>

<template>
  <div class="min-h-dvh bg-bz-bg font-sans text-bz-ink-900">
    <div class="border-b border-bz-border bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-bz-ink-500">
      BAZM Admin
    </div>
    <RouterView />
  </div>
</template>
```

```vue
<!-- frontend/src/App.vue -->
<script setup lang="ts">
import { onMounted } from "vue";

import ToastContainer from "./components/feedback/ToastContainer.vue";
import { registerSessionExpiredHandler } from "./lib/session-expired-bus";
import router from "./router";
import { useToastStore } from "./stores/toast.store";

const toastStore = useToastStore();

onMounted(() => {
  registerSessionExpiredHandler(() => {
    toastStore.push("info", "Your session has expired. Please sign in again.");
    const currentPath = router.currentRoute.value.path;
    const target = currentPath.startsWith("/admin") ? "admin.login" : "staff.login";
    router.push({ name: target });
  });
});
</script>

<template>
  <div>
    <ToastContainer />
    <RouterView />
  </div>
</template>
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run tests/login-flow.test.ts tests/router-guards.test.ts`
Expected: PASS (all)

- [ ] **Step 10: Run the entire frontend verification suite**

Run (from `frontend/`): `npm run typecheck && npm run lint && npm run test`
Expected: all three succeed with zero errors/failures.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/components/auth/LoginForm.vue frontend/src/views/staff/LoginView.vue frontend/src/views/admin/LoginView.vue frontend/src/views/staff/HomePlaceholder.vue frontend/src/views/admin/HomePlaceholder.vue frontend/src/layouts/StaffLayout.vue frontend/src/layouts/AdminLayout.vue frontend/src/App.vue frontend/tests/login-flow.test.ts
git commit -m "feat(frontend): add staff/admin login screens and authenticated home shells"
```

---

## Self-Review

**Spec coverage vs. the master prompt's Phase B/C requirements:**
- ✅ Canonical HTTP client extension, no new dependency (B2) — Task 2.
- ✅ Single-flight refresh, retry-once with typed flag, no refresh loop on login/refresh/logout/guest calls (B3.1–B3.5) — Task 2 tests explicitly cover concurrent-401 collapsing and the plain-`http` 401 exclusion.
- ✅ Boot-time identity restore via refresh + safe fallback to logged-out (B3.7) — Task 4 `restore()`.
- ✅ Role-based redirect after login, router guards enforcing role boundaries (B3.8–B3.9) — Tasks 7–8.
- ✅ Logout/logout-all clear client state even on network failure, then disconnect socket (B3.10) — Task 4 tests.
- ✅ One toast entry point, dedup, distinct messages by error category (Phase C) — Tasks 3, 5.
- ✅ Socket client can authenticate as staff/admin without breaking the existing guest cookie path (E1) — Task 6; the guest socket path is untouched since `auth: {}` when no token is set behaves exactly as before.
- 🔲 Deferred to the Staff/Admin plans (by design, noted in Global Constraints and in-task notes): FormData/multipart support on `authHttp`, the actual event-to-refetch wiring for staff/admin socket events (`order:*` counters, `table:*`), and the `bz-amber`/`bz-blue`/`bz-teal`/`bz-green` token additions to `tokens.css` — these only make sense once there's a real screen consuming them, per "don't build for hypothetical future requirements."

**Placeholder scan:** no `TBD`/`TODO`/"add appropriate error handling" phrases in any step; every code block is complete, runnable code, not a description of code.

**Type consistency check:** `AuthSessionResult` (Task 1) is the single shape produced by `login`/`refreshSession` and consumed identically in `auth.store.ts` (Task 4). `configureAuthIntegration`'s parameter shape in `http.ts` (Task 2) matches exactly what `auth.store.ts` passes in Task 4 (`getToken`, `refresh`, `onUnauthorized` — same three names, same signatures). `ORDER_STATUS_LABELS`/`PAYMENT_STATUS_LABELS` key off the existing `OrderStatus`/`OrderPaymentStatus` enums from `types/enums.ts` rather than a hand-rolled duplicate union, per the master prompt's "don't duplicate backend enums by hand" rule — these are Records over the *existing* frontend enum, not a new enum.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-20-bazm-foundation.md`. Two follow-up plans (Staff app, Admin app) build on top of this one and will be written next. Two execution options for *this* plan:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
