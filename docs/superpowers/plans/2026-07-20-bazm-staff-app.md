# BAZM Staff App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the real Staff application on top of the merged Foundation plan (auth, authHttp, router guards, toasts, socket auth already in place) — an operational order queue with filters, order detail with the full accept→served workflow, customer search/create-on-attach, recovery-code generation, and a read-only settings view. Staff never gets payment, cancellation, force-release, or any Admin-CRUD capability — those stay exclusively in the upcoming Admin plan.

**Architecture:** Same idiom as the existing Customer flow and the Foundation work: one Pinia store per domain (`staff-orders.store.ts`, `staff-customers.store.ts`), thin `api/*.ts` wrapper functions over `authHttp`, presentational Vue views/components with loading/empty/error states via the existing `LoadingState`/`EmptyState`/`ErrorState` components, and a dedicated Staff socket store mirroring the existing guest `socket.store.ts` pattern (register listeners once, refetch on event).

**Tech Stack:** Vue 3 `<script setup>` + TypeScript (strict), Pinia setup stores, vee-validate + zod (only where a form needs validation — most Staff actions are single-button or single-field), vitest + @vue/test-utils, Tailwind with the existing `bz-*` tokens. Backend: Express + Prisma, `node:test` for the one pure-function unit test this plan needs.

## Global Constraints

- Staff must never render or call: payment creation/reversal, Admin order cancellation, table release/force-release, Staff/Customer/Category/Product/Table CRUD, or settings *writes*. Only the actions explicitly listed in this plan's tasks.
- Table release (safe or forced) is **out of scope for Staff** — confirmed Admin-only in the real backend (`backend/src/modules/tables/table.routes.ts:27` applies `authorize([ADMIN])` to the whole router). Do not add a release action to any Staff screen. (User decision, 2026-07-20.)
- `orderStatus` and `paymentStatus` remain two separate systems everywhere — reuse the existing `ORDER_STATUS_LABEL`/`PAYMENT_STATUS_LABEL` maps and `OrderStatusBadge`/`PaymentStatusBadge` components, never merge them into one "status" concept.
- No new npm dependency.
- Access token / auth lifecycle already fully wired by the Foundation plan — Staff screens consume `useAuthStore()` and `authHttp`, they don't touch token or socket-auth plumbing directly.
- Match existing code style exactly: relative imports, double quotes, semicolons, trailing commas, Pinia setup-store functions, Vue 3 `<script setup lang="ts">`.
- Every new/changed file must pass `npm run typecheck` and `npm run lint` (run from `frontend/`, and `npm run typecheck` from `backend/` for the one backend task) and every new/changed test must pass `npm run test` in the relevant package.
- Backend tests in this plan must not touch a database — the one backend change is a pure-function addition, tested with a `node:test` unit test that constructs a plain object, matching the existing convention in `backend/tests/unit/utils.node.test.ts`. Do not add or run anything from `backend/tests/smoke` or `backend/tests/workflows` (both are DB-backed) as part of this plan.
- Do not modify any file under `frontend/src/views/customer/`, `frontend/src/api/guest-sessions.ts`, `frontend/src/api/menu.ts`, `frontend/src/stores/cart.store.ts`, `frontend/src/stores/menu.store.ts`, `frontend/src/stores/orders.store.ts` (the guest one), or `frontend/src/stores/socket.store.ts` (the guest one) — the guest flow is proven and out of scope. `frontend/src/api/orders.ts` (guest) IS touched by Task 2, but only to remove one duplicated constant — no behavior change.
- Never expose a raw recovery code anywhere except the one-time API response that generates it (never log it, never put it in the URL, never send it over the socket).

---

### Task 1: Backend — expose `guestSessionId` on `SafeOrder`

**Files:**
- Modify: `backend/src/modules/orders/order.types.ts`
- Modify: `backend/src/modules/orders/order.service.ts`
- Test: `backend/tests/unit/order-safe-mapping.node.test.ts`

**Interfaces:**
- Produces: `SafeOrder.guestSessionId: string | null` — the guest session's public UUID for a DINE_IN order tied to an active session, `null` otherwise (TAKEAWAY orders, or a session that's since been cleared). This is what Task 3's `createRecoveryCode` API call needs as its `sessionId` path param.
- Consumes: `order.guestSession` — already fetched by the shared `orderInclude` (`backend/src/modules/orders/order.repository.ts:21`, `select: { id: true, uuid: true }`) on every order query, staff and guest alike. No new Prisma include needed.

- [ ] **Step 1: Write the failing test**

```ts
// backend/tests/unit/order-safe-mapping.node.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toSafeOrder } from "../../src/modules/orders/order.service.js";
import { CustomerType, OrderStatus, OrderPaymentStatus, PaymentStatus } from "../../src/generated/prisma/enums.js";
import { Prisma } from "../../src/generated/prisma/client.js";

function baseOrder(overrides: Partial<Parameters<typeof toSafeOrder>[0]> = {}) {
  return {
    uuid: "order-uuid-1",
    orderNumber: "ORD-1",
    billNumber: "BILL-1",
    customerType: CustomerType.DINE_IN,
    status: OrderStatus.PENDING,
    paymentStatus: OrderPaymentStatus.UNPAID,
    customerName: null,
    customerPhone: null,
    subtotal: new Prisma.Decimal("100.00"),
    taxAmount: new Prisma.Decimal("0.00"),
    serviceChargeAmount: new Prisma.Decimal("0.00"),
    discountAmount: new Prisma.Decimal("0.00"),
    totalAmount: new Prisma.Decimal("100.00"),
    estimatedReadyAt: null,
    customerNotes: null,
    rejectionReason: null,
    cancellationReason: null,
    receiptImagePath: null,
    acceptedAt: null,
    preparingAt: null,
    readyAt: null,
    servedAt: null,
    completedAt: null,
    rejectedAt: null,
    cancelledAt: null,
    createdAt: new Date("2026-07-20T00:00:00.000Z"),
    updatedAt: new Date("2026-07-20T00:00:00.000Z"),
    restaurantTable: null,
    customer: null,
    guestSession: undefined,
    items: [],
    payments: [],
    ...overrides,
  };
}

describe("toSafeOrder guestSessionId mapping", () => {
  it("includes the guest session uuid when a guestSession relation is present", () => {
    const safe = toSafeOrder(baseOrder({ guestSession: { uuid: "session-uuid-42" } }));
    assert.equal(safe.guestSessionId, "session-uuid-42");
  });

  it("is null when there is no guestSession relation (e.g. a TAKEAWAY order)", () => {
    const safe = toSafeOrder(
      baseOrder({ customerType: CustomerType.TAKEAWAY, guestSession: undefined }),
    );
    assert.equal(safe.guestSessionId, null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `npx tsx --test tests/unit/order-safe-mapping.node.test.ts`
Expected: FAIL — `safe.guestSessionId` is `undefined`, not `"session-uuid-42"` / not present on the type.

- [ ] **Step 3: Add the field to `order.types.ts`**

Find the `SafeOrder` type in `backend/src/modules/orders/order.types.ts` and add one field (place it near `tableId`/`customerId`, the other cross-reference identifiers):

```ts
  guestSessionId: string | null;
```

- [ ] **Step 4: Map it in `toSafeOrder` (`order.service.ts`)**

In the `return { ... }` object inside `toSafeOrder`, add one line near `customerId: order.customer?.uuid ?? null,`:

```ts
    guestSessionId: order.guestSession?.uuid ?? null,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx tsx --test tests/unit/order-safe-mapping.node.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Run the backend's non-DB checks**

Run: `npm run typecheck` (from `backend/`) — must be clean. Run `npx tsx --test tests/unit/utils.node.test.ts tests/unit/order-safe-mapping.node.test.ts` together to confirm no interference with the existing unit test file. Do NOT run `test:smoke` or `test:workflows` (DB-backed, out of scope for this task).

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/orders/order.types.ts backend/src/modules/orders/order.service.ts backend/tests/unit/order-safe-mapping.node.test.ts
git commit -m "feat(backend): expose guestSessionId on SafeOrder for staff recovery-code flow"
```

---

### Task 2: Frontend cleanup — remove duplicate status-label maps, dedupe API_BASE_URL

**Files:**
- Delete: `frontend/src/constants/order-status-labels.ts`
- Delete: `frontend/src/constants/payment-status-labels.ts`
- Modify: `frontend/tests/shared-utils.test.ts` (remove the "status label maps" describe block that tested the deleted files; keep every other describe block in that file untouched)
- Modify: `frontend/src/api/http.ts` (export `API_BASE_URL`)
- Modify: `frontend/src/api/orders.ts` (guest) (import `API_BASE_URL` from `./http` instead of redefining it)
- Modify: `frontend/src/types/order.ts` (add `guestSessionId` field, matching Task 1's backend addition)

**Interfaces:**
- Removes: `ORDER_STATUS_LABELS`, `PAYMENT_STATUS_LABELS` — confirmed zero consumers anywhere in `src/` outside their own now-deleted test (the Foundation plan created them but nothing was ever built to use them; the codebase already has `ORDER_STATUS_LABEL`/`ORDER_STATUS_BADGE_CLASS`/`PAYMENT_STATUS_LABEL`/`PAYMENT_STATUS_BADGE_CLASS` in `frontend/src/constants/order-status.ts`, actively used by `OrderStatusBadge.vue`/`PaymentStatusBadge.vue` in the Customer flow — that's the one source of truth Staff will reuse).
- Produces: `API_BASE_URL` exported from `frontend/src/api/http.ts` — the one place it's now defined; every other file that needs it (the existing guest `orders.ts`, and this plan's new `staff-orders.ts`) imports it from there instead of redefining the same `import.meta.env.VITE_API_BASE_URL ?? "/api/v1"` line.
- Produces: `SafeOrder.guestSessionId: string | null` on the frontend type, mirroring Task 1's backend field exactly.

- [ ] **Step 1: Confirm zero consumers before deleting (evidence, not assumption)**

Run (from `frontend/`): `git grep -n "ORDER_STATUS_LABELS\|PAYMENT_STATUS_LABELS" -- ':!frontend/src/constants/order-status-labels.ts' ':!frontend/src/constants/payment-status-labels.ts' ':!frontend/tests/shared-utils.test.ts'`
Expected: no output (zero matches outside the files being deleted and their test). If this finds any other reference, STOP and report BLOCKED — do not delete anything a live reference depends on.

- [ ] **Step 2: Delete the two duplicate constant files**

```bash
git rm frontend/src/constants/order-status-labels.ts frontend/src/constants/payment-status-labels.ts
```

- [ ] **Step 3: Remove their test coverage from `shared-utils.test.ts`**

Open `frontend/tests/shared-utils.test.ts`. Remove:
- The two now-broken imports: `import { ORDER_STATUS_LABELS } from "../src/constants/order-status-labels";` and `import { PAYMENT_STATUS_LABELS } from "../src/constants/payment-status-labels";`
- The entire `describe("status label maps", ...)` block that references them.

Leave every other import and describe block in that file exactly as-is (currency, datetime, media-url, error-message, idempotency tests are unrelated and must keep passing).

- [ ] **Step 4: Export `API_BASE_URL` from `http.ts`**

In `frontend/src/api/http.ts`, change:
```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
```
to:
```ts
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
```
(Only the `export` keyword changes — nothing else about this constant or the file's behavior changes.)

- [ ] **Step 5: Update the guest `orders.ts` to import it instead of redefining it**

In `frontend/src/api/orders.ts`, find:
```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
```
Remove that line, and add `API_BASE_URL` to the existing `import { http } from "./http";` line so it reads:
```ts
import { API_BASE_URL, http } from "./http";
```
Do not change anything else in this file — `getGuestReceiptUrl` and every other export must behave identically.

- [ ] **Step 6: Add `guestSessionId` to the frontend `SafeOrder` type**

In `frontend/src/types/order.ts`, add one field to `SafeOrder`, next to `customerId`:
```ts
  guestSessionId: string | null;
```

- [ ] **Step 7: Run verification**

Run (from `frontend/`): `npx vitest run tests/shared-utils.test.ts` — must pass with the status-label tests gone and every other test in the file still present and passing.
Run the full suite: `npx vitest run` — zero regressions (in particular, no test should reference the deleted files).
Run `npm run typecheck` and `npm run lint` — both clean.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(frontend): remove unused duplicate status-label maps, dedupe API_BASE_URL, add guestSessionId to SafeOrder"
```

---

### Task 3: Staff domain types and API modules

**Files:**
- Create: `frontend/src/types/customer.ts`
- Create: `frontend/src/types/settings.ts`
- Create: `frontend/src/api/staff-orders.ts`
- Create: `frontend/src/api/staff-customers.ts`
- Create: `frontend/src/api/staff-guest-sessions.ts`
- Create: `frontend/src/api/settings.ts`
- Test: `frontend/tests/api-staff.test.ts`

**Interfaces:**
- Produces (`types/customer.ts`): `SafeCustomer { id, name, phone: string | null, imagePath: string | null, imageUrl: string | null, createdAt: string, updatedAt: string }`, `CustomerFinancialSummary { orderCount, unpaidOrderCount, partiallyPaidOrderCount, outstandingBalance: string }`, `CustomerDetail = SafeCustomer & { summary: CustomerFinancialSummary }` — mirrors the backend's `customer.types.ts` exactly (backend dates are serialized as ISO strings over JSON, so `createdAt`/`updatedAt` are `string` here, not `Date`, matching this codebase's existing convention for `SafeOrder`/`SafeGuestSession`).
- Produces (`types/settings.ts`): `CafeSettings { taxRatePercent: string; serviceChargePercent: string }`.
- Produces (`api/staff-orders.ts`): `listStaffOrders(filters?: { status?: OrderStatus; paymentStatus?: OrderPaymentStatus }): Promise<{ orders: SafeOrder[] }>`, `getStaffOrder(orderId: string): Promise<{ order: SafeOrder }>`, `acceptOrder(orderId)`, `startPreparingOrder(orderId)`, `markOrderReady(orderId)`, `markOrderServed(orderId)`, `rejectOrder(orderId, reason: string)`, `attachCustomerToOrder(orderId, input: { customerId: string } | { name: string; phone?: string })`, `getStaffReceiptUrl(orderId: string): string` — all via `authHttp` from `../api/http` (Task 2 of Foundation), matching the real backend paths from `backend/src/modules/orders/order.routes.ts` exactly.
- Produces (`api/staff-customers.ts`): `searchCustomers(query: { search?: string; phone?: string }): Promise<{ customers: SafeCustomer[] }>`.
- Produces (`api/staff-guest-sessions.ts`): `generateRecoveryCode(sessionId: string): Promise<{ recoveryCode: string; expiresAt: string }>`.
- Produces (`api/settings.ts`): `getSettings(): Promise<{ settings: CafeSettings }>` — GET only in this plan; the Admin plan will add the PATCH.
- Consumes: `authHttp`, `API_BASE_URL` from `../api/http` (Foundation Task 2 / this plan's Task 2); `SafeOrder` from `../types/order`; `OrderStatus`, `OrderPaymentStatus` from `../types/enums`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/api-staff.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { configureAuthIntegration } from "../src/api/http";
import {
  acceptOrder,
  attachCustomerToOrder,
  getStaffOrder,
  getStaffReceiptUrl,
  listStaffOrders,
  markOrderReady,
  markOrderServed,
  rejectOrder,
  startPreparingOrder,
} from "../src/api/staff-orders";
import { searchCustomers } from "../src/api/staff-customers";
import { generateRecoveryCode } from "../src/api/staff-guest-sessions";
import { getSettings } from "../src/api/settings";

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(body) }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  configureAuthIntegration({ getToken: () => null, refresh: () => Promise.resolve(null), onUnauthorized: () => {} });
});

describe("staff orders api", () => {
  it("listStaffOrders builds query params from filters and attaches the bearer token", async () => {
    configureAuthIntegration({ getToken: () => "tok", refresh: () => Promise.resolve(null), onUnauthorized: () => {} });
    mockFetchOnce({ success: true, message: "ok", data: { orders: [] } });

    await listStaffOrders({ status: "PENDING", paymentStatus: "UNPAID" });

    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/orders?status=PENDING&paymentStatus=UNPAID");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("listStaffOrders with no filters calls the bare endpoint", async () => {
    mockFetchOnce({ success: true, message: "ok", data: { orders: [] } });
    await listStaffOrders();
    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/orders");
    expect(url).not.toContain("?");
  });

  it("getStaffOrder calls GET /orders/:orderId", async () => {
    mockFetchOnce({ success: true, message: "ok", data: { order: { id: "o1" } } });
    await getStaffOrder("o1");
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/orders/o1");
    expect(init.method).toBe("GET");
  });

  it.each([
    ["accept", acceptOrder, "accept"],
    ["start-preparing", startPreparingOrder, "start-preparing"],
    ["mark-ready", markOrderReady, "mark-ready"],
    ["mark-served", markOrderServed, "mark-served"],
  ])("%s posts to /orders/:orderId/%s", async (_label, fn, segment) => {
    mockFetchOnce({ success: true, message: "ok", data: { order: { id: "o1" } } });
    await fn("o1");
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain(`/orders/o1/${segment}`);
    expect(init.method).toBe("POST");
  });

  it("rejectOrder posts the reason", async () => {
    mockFetchOnce({ success: true, message: "ok", data: { order: { id: "o1" } } });
    await rejectOrder("o1", "Kitchen is out of this item.");
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/orders/o1/reject");
    expect(JSON.parse(init.body)).toEqual({ reason: "Kitchen is out of this item." });
  });

  it("attachCustomerToOrder posts a customerId payload", async () => {
    mockFetchOnce({ success: true, message: "ok", data: { order: { id: "o1" } } });
    await attachCustomerToOrder("o1", { customerId: "c1" });
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/orders/o1/customer");
    expect(JSON.parse(init.body)).toEqual({ customerId: "c1" });
  });

  it("attachCustomerToOrder posts a name/phone payload", async () => {
    mockFetchOnce({ success: true, message: "ok", data: { order: { id: "o1" } } });
    await attachCustomerToOrder("o1", { name: "Ali", phone: "03001234567" });
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ name: "Ali", phone: "03001234567" });
  });

  it("getStaffReceiptUrl builds a URL without fetching", () => {
    expect(getStaffReceiptUrl("o1")).toContain("/orders/o1/receipt");
  });
});

describe("staff customers api", () => {
  it("searchCustomers passes the search query string", async () => {
    mockFetchOnce({ success: true, message: "ok", data: { customers: [] } });
    await searchCustomers({ search: "ali" });
    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/customers?search=ali");
  });
});

describe("staff guest-sessions api", () => {
  it("generateRecoveryCode posts to the sessionId-scoped route", async () => {
    mockFetchOnce({ success: true, message: "ok", data: { recoveryCode: "ABC123", expiresAt: "2026-07-20T00:05:00.000Z" } });
    const result = await generateRecoveryCode("session-uuid-1");
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/guest-sessions/session-uuid-1/recovery-codes");
    expect(init.method).toBe("POST");
    expect(result.recoveryCode).toBe("ABC123");
  });
});

describe("settings api", () => {
  it("getSettings calls GET /settings", async () => {
    mockFetchOnce({ success: true, message: "ok", data: { settings: { taxRatePercent: "5.00", serviceChargePercent: "10.00" } } });
    const result = await getSettings();
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/settings");
    expect(init.method).toBe("GET");
    expect(result.settings.taxRatePercent).toBe("5.00");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api-staff.test.ts`
Expected: FAIL — none of the modules exist yet.

- [ ] **Step 3: Write `src/types/customer.ts`**

```ts
// frontend/src/types/customer.ts
export type SafeCustomer = {
  id: string;
  name: string;
  phone: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerFinancialSummary = {
  orderCount: number;
  unpaidOrderCount: number;
  partiallyPaidOrderCount: number;
  outstandingBalance: string;
};

export type CustomerDetail = SafeCustomer & {
  summary: CustomerFinancialSummary;
};
```

- [ ] **Step 4: Write `src/types/settings.ts`**

```ts
// frontend/src/types/settings.ts
export type CafeSettings = {
  taxRatePercent: string;
  serviceChargePercent: string;
};
```

- [ ] **Step 5: Write `src/api/staff-orders.ts`**

```ts
// frontend/src/api/staff-orders.ts
import { API_BASE_URL, authHttp } from "./http";
import type { OrderPaymentStatus, OrderStatus } from "../types/enums";
import type { SafeOrder } from "../types/order";

export type StaffOrderFilters = {
  status?: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
};

export type AttachCustomerInput = { customerId: string } | { name: string; phone?: string };

function buildQuery(filters?: StaffOrderFilters): string {
  if (!filters) {
    return "";
  }
  const params = new URLSearchParams();
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.paymentStatus) {
    params.set("paymentStatus", filters.paymentStatus);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function listStaffOrders(filters?: StaffOrderFilters) {
  return authHttp.get<{ orders: SafeOrder[] }>(`/orders${buildQuery(filters)}`);
}

export function getStaffOrder(orderId: string) {
  return authHttp.get<{ order: SafeOrder }>(`/orders/${orderId}`);
}

export function acceptOrder(orderId: string) {
  return authHttp.post<{ order: SafeOrder }>(`/orders/${orderId}/accept`);
}

export function startPreparingOrder(orderId: string) {
  return authHttp.post<{ order: SafeOrder }>(`/orders/${orderId}/start-preparing`);
}

export function markOrderReady(orderId: string) {
  return authHttp.post<{ order: SafeOrder }>(`/orders/${orderId}/mark-ready`);
}

export function markOrderServed(orderId: string) {
  return authHttp.post<{ order: SafeOrder }>(`/orders/${orderId}/mark-served`);
}

export function rejectOrder(orderId: string, reason: string) {
  return authHttp.post<{ order: SafeOrder }>(`/orders/${orderId}/reject`, { reason });
}

export function attachCustomerToOrder(orderId: string, input: AttachCustomerInput) {
  return authHttp.post<{ order: SafeOrder }>(`/orders/${orderId}/customer`, input);
}

export function getStaffReceiptUrl(orderId: string): string {
  return `${API_BASE_URL}/orders/${orderId}/receipt`;
}
```

- [ ] **Step 6: Write `src/api/staff-customers.ts`**

```ts
// frontend/src/api/staff-customers.ts
import { authHttp } from "./http";
import type { SafeCustomer } from "../types/customer";

export type SearchCustomersQuery = { search?: string; phone?: string };

function buildQuery(query: SearchCustomersQuery): string {
  const params = new URLSearchParams();
  if (query.search) {
    params.set("search", query.search);
  }
  if (query.phone) {
    params.set("phone", query.phone);
  }
  const built = params.toString();
  return built ? `?${built}` : "";
}

export function searchCustomers(query: SearchCustomersQuery) {
  return authHttp.get<{ customers: SafeCustomer[] }>(`/customers${buildQuery(query)}`);
}
```

- [ ] **Step 7: Write `src/api/staff-guest-sessions.ts`**

```ts
// frontend/src/api/staff-guest-sessions.ts
import { authHttp } from "./http";

export function generateRecoveryCode(sessionId: string) {
  return authHttp.post<{ recoveryCode: string; expiresAt: string }>(
    `/guest-sessions/${sessionId}/recovery-codes`,
  );
}
```

- [ ] **Step 8: Write `src/api/settings.ts`**

```ts
// frontend/src/api/settings.ts
import { authHttp } from "./http";
import type { CafeSettings } from "../types/settings";

export function getSettings() {
  return authHttp.get<{ settings: CafeSettings }>("/settings");
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run tests/api-staff.test.ts`
Expected: PASS (all cases)

- [ ] **Step 10: Run the full suite, typecheck, lint**

Run: `npx vitest run`, `npm run typecheck`, `npm run lint` — all clean.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/types/customer.ts frontend/src/types/settings.ts frontend/src/api/staff-orders.ts frontend/src/api/staff-customers.ts frontend/src/api/staff-guest-sessions.ts frontend/src/api/settings.ts frontend/tests/api-staff.test.ts
git commit -m "feat(frontend): add staff domain types and API modules"
```

---

### Task 4: Staff orders store

**Files:**
- Create: `frontend/src/stores/staff-orders.store.ts`
- Test: `frontend/tests/staff-orders-store.test.ts`

**Interfaces:**
- Produces: `useStaffOrdersStore()` with state `orders: Ref<SafeOrder[]>`, `loading`, `error: Ref<ApiError | null>`, `activeFilters: Ref<StaffOrderFilters>`; actions `fetchOrders(filters?: StaffOrderFilters): Promise<void>` (updates `activeFilters` and refetches), `fetchOrder(orderId): Promise<void>` (upserts into `orders`), `refetchCurrentFilters(): Promise<void>` (re-runs `fetchOrders(activeFilters.value)` — used by the socket store for event-triggered refetches), `accept`, `startPreparing`, `markReady`, `markServed`, `reject(orderId, reason)`, `attachCustomer(orderId, input)` — every mutation calls the matching `api/staff-orders.ts` function then upserts the returned order into `orders`, mirroring the existing guest `orders.store.ts`'s `upsert`/`findOrder` pattern.
- Consumes: `listStaffOrders`, `getStaffOrder`, `acceptOrder`, `startPreparingOrder`, `markOrderReady`, `markOrderServed`, `rejectOrder`, `attachCustomerToOrder` from `../api/staff-orders`; `ApiError` from `../api/http`; `SafeOrder` from `../types/order`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/staff-orders-store.test.ts
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as staffOrdersApi from "../src/api/staff-orders";
import { useStaffOrdersStore } from "../src/stores/staff-orders.store";
import { OrderStatus, OrderPaymentStatus } from "../src/types/enums";
import type { SafeOrder } from "../src/types/order";

function makeOrder(overrides: Partial<SafeOrder> = {}): SafeOrder {
  return {
    id: "o1",
    orderNumber: "ORD-1",
    billNumber: "BILL-1",
    orderType: "DINE_IN",
    orderStatus: OrderStatus.PENDING,
    paymentStatus: OrderPaymentStatus.UNPAID,
    tableId: "t1",
    tableNumber: "5",
    customerId: null,
    customerName: null,
    customerPhone: null,
    guestSessionId: "s1",
    subtotal: "100.00",
    taxAmount: "0.00",
    serviceChargeAmount: "0.00",
    discountAmount: "0.00",
    totalAmount: "100.00",
    paidAmount: "0.00",
    remainingAmount: "100.00",
    estimatedPreparationMinutes: 10,
    estimatedReadyAt: null,
    customerNotes: null,
    rejectionReason: null,
    cancellationReason: null,
    receiptImagePath: null,
    receiptImageUrl: null,
    items: [],
    acceptedAt: null,
    preparingAt: null,
    readyAt: null,
    servedAt: null,
    completedAt: null,
    rejectedAt: null,
    cancelledAt: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  } as SafeOrder;
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("staff orders store", () => {
  it("fetchOrders stores the result and remembers the filters used", async () => {
    vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({ orders: [makeOrder()] });
    const store = useStaffOrdersStore();

    await store.fetchOrders({ status: OrderStatus.PENDING });

    expect(store.orders).toHaveLength(1);
    expect(store.activeFilters).toEqual({ status: OrderStatus.PENDING });
  });

  it("refetchCurrentFilters re-runs the last fetch with the same filters", async () => {
    const listSpy = vi
      .spyOn(staffOrdersApi, "listStaffOrders")
      .mockResolvedValue({ orders: [makeOrder()] });
    const store = useStaffOrdersStore();
    await store.fetchOrders({ paymentStatus: OrderPaymentStatus.UNPAID });

    await store.refetchCurrentFilters();

    expect(listSpy).toHaveBeenCalledTimes(2);
    expect(listSpy).toHaveBeenLastCalledWith({ paymentStatus: OrderPaymentStatus.UNPAID });
  });

  it("accept updates the order in place after the server responds", async () => {
    vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({ orders: [makeOrder()] });
    vi.spyOn(staffOrdersApi, "acceptOrder").mockResolvedValue({
      order: makeOrder({ orderStatus: OrderStatus.ACCEPTED }),
    });
    const store = useStaffOrdersStore();
    await store.fetchOrders();

    await store.accept("o1");

    expect(store.orders[0].orderStatus).toBe(OrderStatus.ACCEPTED);
  });

  it("reject sends the reason and updates the order", async () => {
    const rejectSpy = vi
      .spyOn(staffOrdersApi, "rejectOrder")
      .mockResolvedValue({ order: makeOrder({ orderStatus: OrderStatus.REJECTED, rejectionReason: "Out of stock" }) });
    const store = useStaffOrdersStore();

    await store.reject("o1", "Out of stock");

    expect(rejectSpy).toHaveBeenCalledWith("o1", "Out of stock");
    expect(store.orders[0].orderStatus).toBe(OrderStatus.REJECTED);
  });

  it("attachCustomer updates the order with the returned customer info", async () => {
    vi.spyOn(staffOrdersApi, "attachCustomerToOrder").mockResolvedValue({
      order: makeOrder({ customerId: "c1", customerName: "Ali" }),
    });
    const store = useStaffOrdersStore();

    await store.attachCustomer("o1", { customerId: "c1" });

    expect(store.orders[0].customerName).toBe("Ali");
  });

  it("fetchOrder upserts a single order without touching the rest of the list", async () => {
    vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({
      orders: [makeOrder({ id: "o1" }), makeOrder({ id: "o2" })],
    });
    vi.spyOn(staffOrdersApi, "getStaffOrder").mockResolvedValue({
      order: makeOrder({ id: "o2", orderStatus: OrderStatus.READY }),
    });
    const store = useStaffOrdersStore();
    await store.fetchOrders();

    await store.fetchOrder("o2");

    expect(store.orders).toHaveLength(2);
    expect(store.orders.find((o) => o.id === "o2")?.orderStatus).toBe(OrderStatus.READY);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/staff-orders-store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/stores/staff-orders.store.ts`**

```ts
// frontend/src/stores/staff-orders.store.ts
import { defineStore } from "pinia";
import { ref } from "vue";

import {
  acceptOrder,
  attachCustomerToOrder,
  getStaffOrder,
  listStaffOrders,
  markOrderReady,
  markOrderServed,
  rejectOrder,
  startPreparingOrder,
  type AttachCustomerInput,
  type StaffOrderFilters,
} from "../api/staff-orders";
import { ApiError } from "../api/http";
import type { SafeOrder } from "../types/order";

export const useStaffOrdersStore = defineStore("staffOrders", () => {
  const orders = ref<SafeOrder[]>([]);
  const loading = ref(false);
  const error = ref<ApiError | null>(null);
  const activeFilters = ref<StaffOrderFilters>({});

  function upsert(order: SafeOrder): void {
    const index = orders.value.findIndex((existing) => existing.id === order.id);
    if (index === -1) {
      orders.value.push(order);
    } else {
      orders.value[index] = order;
    }
  }

  async function fetchOrders(filters: StaffOrderFilters = {}): Promise<void> {
    loading.value = true;
    error.value = null;
    activeFilters.value = filters;

    try {
      const result = await listStaffOrders(filters);
      orders.value = result.orders;
    } catch (caught) {
      if (caught instanceof ApiError) {
        error.value = caught;
      }
    } finally {
      loading.value = false;
    }
  }

  async function refetchCurrentFilters(): Promise<void> {
    await fetchOrders(activeFilters.value);
  }

  async function fetchOrder(orderId: string): Promise<void> {
    const result = await getStaffOrder(orderId);
    upsert(result.order);
  }

  async function accept(orderId: string): Promise<void> {
    const result = await acceptOrder(orderId);
    upsert(result.order);
  }

  async function startPreparing(orderId: string): Promise<void> {
    const result = await startPreparingOrder(orderId);
    upsert(result.order);
  }

  async function markReady(orderId: string): Promise<void> {
    const result = await markOrderReady(orderId);
    upsert(result.order);
  }

  async function markServed(orderId: string): Promise<void> {
    const result = await markOrderServed(orderId);
    upsert(result.order);
  }

  async function reject(orderId: string, reason: string): Promise<void> {
    const result = await rejectOrder(orderId, reason);
    upsert(result.order);
  }

  async function attachCustomer(orderId: string, input: AttachCustomerInput): Promise<void> {
    const result = await attachCustomerToOrder(orderId, input);
    upsert(result.order);
  }

  function findOrder(orderId: string): SafeOrder | undefined {
    return orders.value.find((order) => order.id === orderId);
  }

  return {
    orders,
    loading,
    error,
    activeFilters,
    fetchOrders,
    refetchCurrentFilters,
    fetchOrder,
    accept,
    startPreparing,
    markReady,
    markServed,
    reject,
    attachCustomer,
    findOrder,
  };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/staff-orders-store.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Run full suite, typecheck, lint**

- [ ] **Step 6: Commit**

```bash
git add frontend/src/stores/staff-orders.store.ts frontend/tests/staff-orders-store.test.ts
git commit -m "feat(frontend): add staff orders store"
```

---

### Task 5: Staff customers store

**Files:**
- Create: `frontend/src/stores/staff-customers.store.ts`
- Test: `frontend/tests/staff-customers-store.test.ts`

**Interfaces:**
- Produces: `useStaffCustomersStore()` with state `results: Ref<SafeCustomer[]>`, `loading`, `error`; action `search(query: string): Promise<void>` — no-ops (clears `results`) when `query` is empty/whitespace, otherwise calls `searchCustomers({ search: query })`.
- Consumes: `searchCustomers` from `../api/staff-customers`; `ApiError` from `../api/http`; `SafeCustomer` from `../types/customer`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/staff-customers-store.test.ts
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as staffCustomersApi from "../src/api/staff-customers";
import { useStaffCustomersStore } from "../src/stores/staff-customers.store";
import type { SafeCustomer } from "../src/types/customer";

function makeCustomer(overrides: Partial<SafeCustomer> = {}): SafeCustomer {
  return {
    id: "c1",
    name: "Ali",
    phone: "03001234567",
    imagePath: null,
    imageUrl: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("staff customers store", () => {
  it("search populates results", async () => {
    vi.spyOn(staffCustomersApi, "searchCustomers").mockResolvedValue({ customers: [makeCustomer()] });
    const store = useStaffCustomersStore();

    await store.search("ali");

    expect(store.results).toHaveLength(1);
    expect(store.results[0].name).toBe("Ali");
  });

  it("search with an empty/whitespace query clears results without calling the API", async () => {
    const searchSpy = vi.spyOn(staffCustomersApi, "searchCustomers").mockResolvedValue({ customers: [] });
    const store = useStaffCustomersStore();
    store.results = [makeCustomer()];

    await store.search("   ");

    expect(store.results).toHaveLength(0);
    expect(searchSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/staff-customers-store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/stores/staff-customers.store.ts`**

```ts
// frontend/src/stores/staff-customers.store.ts
import { defineStore } from "pinia";
import { ref } from "vue";

import { searchCustomers } from "../api/staff-customers";
import { ApiError } from "../api/http";
import type { SafeCustomer } from "../types/customer";

export const useStaffCustomersStore = defineStore("staffCustomers", () => {
  const results = ref<SafeCustomer[]>([]);
  const loading = ref(false);
  const error = ref<ApiError | null>(null);

  async function search(query: string): Promise<void> {
    const trimmed = query.trim();
    if (!trimmed) {
      results.value = [];
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const result = await searchCustomers({ search: trimmed });
      results.value = result.customers;
    } catch (caught) {
      if (caught instanceof ApiError) {
        error.value = caught;
      }
    } finally {
      loading.value = false;
    }
  }

  return { results, loading, error, search };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/staff-customers-store.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Run full suite, typecheck, lint**

- [ ] **Step 6: Commit**

```bash
git add frontend/src/stores/staff-customers.store.ts frontend/tests/staff-customers-store.test.ts
git commit -m "feat(frontend): add staff customers search store"
```

---

### Task 6: Shared components — reason-confirmation dialog, staff order card

**Files:**
- Create: `frontend/src/components/feedback/ReasonConfirmationDialog.vue`
- Create: `frontend/src/components/domain/StaffOrderCard.vue`
- Test: `frontend/tests/reason-confirmation-dialog.test.ts`

**Interfaces:**
- Produces (`ReasonConfirmationDialog.vue`): props `open: boolean`, `title: string`, `description: string`, `confirmLabel?: string`, `cancelLabel?: string`, `confirming?: boolean`, `minLength?: number` (default 3, matching the backend's `rejectOrderSchema`/`cancelOrderSchema` minimum); emits `cancel: []`, `confirm: [reason: string]`. Same visual shell as the existing `ActionConfirmationDialog.vue` (which has no text field) plus a required `<textarea>`; the confirm button is disabled until the trimmed reason meets `minLength`.
- Produces (`StaffOrderCard.vue`): props `order: SafeOrder`; renders a `RouterLink` to `{ name: "staff.order-detail", params: { orderId: order.id } }` (not the customer route), reusing `OrderStatusBadge`/`PaymentStatusBadge` from `../../components/domain/`, and additionally surfacing `order.tableNumber` (DINE_IN) or a "Takeaway" label, and `order.customerName` when present — information a Staff member scanning a queue needs that a Customer's own order card doesn't.
- Consumes: `OrderStatusBadge`, `PaymentStatusBadge` (existing, unchanged); `SafeOrder` from `../../types/order`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/reason-confirmation-dialog.test.ts
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ReasonConfirmationDialog from "../src/components/feedback/ReasonConfirmationDialog.vue";

describe("ReasonConfirmationDialog", () => {
  it("disables confirm until the reason meets the minimum length", async () => {
    const wrapper = mount(ReasonConfirmationDialog, {
      props: {
        open: true,
        title: "Reject order",
        description: "Tell the customer why.",
      },
    });

    const confirmButton = wrapper.find("[data-test=confirm]");
    expect((confirmButton.element as HTMLButtonElement).disabled).toBe(true);

    await wrapper.find("textarea").setValue("ok");
    expect((wrapper.find("[data-test=confirm]").element as HTMLButtonElement).disabled).toBe(true);

    await wrapper.find("textarea").setValue("Kitchen is out of stock");
    expect((wrapper.find("[data-test=confirm]").element as HTMLButtonElement).disabled).toBe(false);
  });

  it("emits confirm with the trimmed reason", async () => {
    const wrapper = mount(ReasonConfirmationDialog, {
      props: { open: true, title: "Reject order", description: "Tell the customer why." },
    });

    await wrapper.find("textarea").setValue("  Kitchen is out of stock  ");
    await wrapper.find("[data-test=confirm]").trigger("click");

    expect(wrapper.emitted("confirm")).toEqual([["Kitchen is out of stock"]]);
  });

  it("emits cancel", async () => {
    const wrapper = mount(ReasonConfirmationDialog, {
      props: { open: true, title: "Reject order", description: "Tell the customer why." },
    });

    await wrapper.find("[data-test=cancel]").trigger("click");

    expect(wrapper.emitted("cancel")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/reason-confirmation-dialog.test.ts`
Expected: FAIL — component not found.

- [ ] **Step 3: Write `src/components/feedback/ReasonConfirmationDialog.vue`**

```vue
<!-- frontend/src/components/feedback/ReasonConfirmationDialog.vue -->
<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    confirming?: boolean;
    minLength?: number;
  }>(),
  { confirmLabel: "Confirm", cancelLabel: "Cancel", confirming: false, minLength: 3 },
);

const emit = defineEmits<{ confirm: [reason: string]; cancel: [] }>();

const reason = ref("");

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      reason.value = "";
    }
  },
);

const trimmedReason = computed(() => reason.value.trim());
const canConfirm = computed(() => trimmedReason.value.length >= props.minLength);

function onConfirm(): void {
  if (!canConfirm.value) {
    return;
  }
  emit("confirm", trimmedReason.value);
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
    @click.self="emit('cancel')"
  >
    <div class="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-bz-lg sm:rounded-2xl">
      <h2 class="text-base font-semibold text-bz-ink-900">{{ title }}</h2>
      <p class="mt-2 text-sm text-bz-ink-500">{{ description }}</p>
      <textarea
        v-model="reason"
        rows="3"
        class="mt-3 w-full rounded-xl border border-bz-border bg-white px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
      />
      <div class="mt-5 flex gap-3">
        <button
          type="button"
          data-test="cancel"
          class="flex-1 rounded-full border border-bz-border py-2.5 text-sm font-medium text-bz-ink-700"
          @click="emit('cancel')"
        >
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          data-test="confirm"
          class="flex-1 rounded-full bg-bz-red py-2.5 text-sm font-medium text-white disabled:opacity-60"
          :disabled="confirming || !canConfirm"
          @click="onConfirm"
        >
          {{ confirming ? "Please wait..." : confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Write `src/components/domain/StaffOrderCard.vue`**

```vue
<!-- frontend/src/components/domain/StaffOrderCard.vue -->
<script setup lang="ts">
import type { SafeOrder } from "../../types/order";
import OrderStatusBadge from "./OrderStatusBadge.vue";
import PaymentStatusBadge from "./PaymentStatusBadge.vue";

defineProps<{ order: SafeOrder }>();
</script>

<template>
  <RouterLink
    :to="{ name: 'staff.order-detail', params: { orderId: order.id } }"
    class="block rounded-2xl border border-bz-border bg-white p-4 shadow-bz-sm"
  >
    <div class="flex items-center justify-between">
      <span class="font-semibold text-bz-ink-900">{{ order.orderNumber }}</span>
      <div class="flex items-center gap-2">
        <OrderStatusBadge :status="order.orderStatus" />
        <PaymentStatusBadge :status="order.paymentStatus" />
      </div>
    </div>
    <div class="mt-2 text-sm text-bz-ink-500">
      <span v-if="order.tableNumber">Table {{ order.tableNumber }}</span>
      <span v-else>Takeaway</span>
      <span v-if="order.customerName"> · {{ order.customerName }}</span>
    </div>
    <div class="mt-3 flex items-center justify-between text-sm text-bz-ink-500">
      <span>{{ order.items.length }} item(s)</span>
      <span class="font-medium text-bz-ink-900">Rs. {{ order.totalAmount }}</span>
    </div>
    <div v-if="Number(order.remainingAmount) > 0" class="mt-1 text-xs text-bz-red">
      Rs. {{ order.remainingAmount }} remaining
    </div>
  </RouterLink>
</template>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/reason-confirmation-dialog.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Run full suite, typecheck, lint**

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/feedback/ReasonConfirmationDialog.vue frontend/src/components/domain/StaffOrderCard.vue frontend/tests/reason-confirmation-dialog.test.ts
git commit -m "feat(frontend): add reason-confirmation dialog and staff order card components"
```

---

### Task 7: Order queue view

**Files:**
- Create: `frontend/src/views/staff/OrderQueueView.vue`
- Delete: `frontend/src/views/staff/HomePlaceholder.vue`
- Modify: `frontend/src/router/index.ts` (point `staff.home`'s component at `OrderQueueView.vue`; add the `staff.order-detail` route — component created in Task 8, reference it here since both routes are needed together for navigation to work, but the FILE is created in Task 8)
- Test: `frontend/tests/staff-order-queue.test.ts`

**Interfaces:**
- Produces: the `staff.home` route now renders a real order queue: status-filter chips (`All`, `Pending`, `Accepted`, `Preparing`, `Ready`, `Served`), each calling `staffOrdersStore.fetchOrders({ status })` (or no filter for "All"), rendering `StaffOrderCard` per order, with `LoadingState`/`EmptyState`/`ErrorState` for the three non-happy-path states, plus a manual refresh button and a sign-out control reusing `useAuthStore().logout()`.
- Consumes: `useStaffOrdersStore` (Task 4), `StaffOrderCard` (Task 6), `LoadingState`/`EmptyState`/`ErrorState` (existing), `useAuthStore` (Foundation), `OrderStatus` from `../../types/enums`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/staff-order-queue.test.ts
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as staffOrdersApi from "../src/api/staff-orders";
import OrderQueueView from "../src/views/staff/OrderQueueView.vue";
import { OrderStatus, OrderPaymentStatus } from "../src/types/enums";
import router from "../src/router";

function makeOrder(id: string, status: OrderStatus) {
  return {
    id,
    orderNumber: `ORD-${id}`,
    billNumber: `BILL-${id}`,
    orderType: "DINE_IN",
    orderStatus: status,
    paymentStatus: OrderPaymentStatus.UNPAID,
    tableId: "t1",
    tableNumber: "5",
    customerId: null,
    customerName: null,
    customerPhone: null,
    guestSessionId: "s1",
    subtotal: "100.00",
    taxAmount: "0.00",
    serviceChargeAmount: "0.00",
    discountAmount: "0.00",
    totalAmount: "100.00",
    paidAmount: "0.00",
    remainingAmount: "100.00",
    estimatedPreparationMinutes: 10,
    estimatedReadyAt: null,
    customerNotes: null,
    rejectionReason: null,
    cancellationReason: null,
    receiptImagePath: null,
    receiptImageUrl: null,
    items: [],
    acceptedAt: null,
    preparingAt: null,
    readyAt: null,
    servedAt: null,
    completedAt: null,
    rejectedAt: null,
    cancelledAt: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("OrderQueueView", () => {
  it("loads and renders orders on mount", async () => {
    vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({
      orders: [makeOrder("o1", OrderStatus.PENDING) as never],
    });
    await router.isReady();

    const wrapper = mount(OrderQueueView, { global: { plugins: [router] } });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.text()).toContain("ORD-o1");
  });

  it("refetches with a status filter when a chip is clicked", async () => {
    const listSpy = vi
      .spyOn(staffOrdersApi, "listStaffOrders")
      .mockResolvedValue({ orders: [] });
    await router.isReady();
    const wrapper = mount(OrderQueueView, { global: { plugins: [router] } });
    await new Promise((resolve) => setTimeout(resolve, 0));

    await wrapper.find("[data-test='filter-PENDING']").trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(listSpy).toHaveBeenLastCalledWith({ status: OrderStatus.PENDING });
  });

  it("shows an empty state when there are no orders", async () => {
    vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({ orders: [] });
    await router.isReady();

    const wrapper = mount(OrderQueueView, { global: { plugins: [router] } });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.text()).toMatch(/no orders/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/staff-order-queue.test.ts`
Expected: FAIL — view not found.

- [ ] **Step 3: Delete the placeholder and write the real view**

```bash
git rm frontend/src/views/staff/HomePlaceholder.vue
```

```vue
<!-- frontend/src/views/staff/OrderQueueView.vue -->
<script setup lang="ts">
import { onMounted, ref } from "vue";

import EmptyState from "../../components/feedback/EmptyState.vue";
import ErrorState from "../../components/feedback/ErrorState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import StaffOrderCard from "../../components/domain/StaffOrderCard.vue";
import { useAuthStore } from "../../stores/auth.store";
import { useStaffOrdersStore } from "../../stores/staff-orders.store";
import { OrderStatus } from "../../types/enums";
import { toUserSafeErrorMessage } from "../../utils/error-message";
import { useRouter } from "vue-router";

const authStore = useAuthStore();
const staffOrdersStore = useStaffOrdersStore();
const router = useRouter();

const FILTERS: Array<{ key: string; label: string; status?: OrderStatus }> = [
  { key: "ALL", label: "All" },
  { key: OrderStatus.PENDING, label: "Pending", status: OrderStatus.PENDING },
  { key: OrderStatus.ACCEPTED, label: "Accepted", status: OrderStatus.ACCEPTED },
  { key: OrderStatus.PREPARING, label: "Preparing", status: OrderStatus.PREPARING },
  { key: OrderStatus.READY, label: "Ready", status: OrderStatus.READY },
  { key: OrderStatus.SERVED, label: "Served", status: OrderStatus.SERVED },
];

const activeFilterKey = ref("ALL");

async function selectFilter(key: string, status?: OrderStatus): Promise<void> {
  activeFilterKey.value = key;
  await staffOrdersStore.fetchOrders(status ? { status } : {});
}

onMounted(() => {
  void staffOrdersStore.fetchOrders();
});

async function onLogout(): Promise<void> {
  await authStore.logout();
  router.replace({ name: "staff.login" });
}
</script>

<template>
  <main class="flex min-h-dvh flex-col px-5 py-6 pb-10">
    <header class="flex items-center justify-between">
      <div>
        <p class="text-sm font-semibold tracking-widest text-bz-gold-700 uppercase">BAZM Café</p>
        <h1 class="mt-1 text-xl font-bold text-bz-ink-900">Order Queue</h1>
      </div>
      <button type="button" class="text-sm text-bz-ink-500 underline underline-offset-2" @click="onLogout">
        Sign out
      </button>
    </header>

    <div class="mt-4 flex gap-2 overflow-x-auto pb-1">
      <button
        v-for="filter in FILTERS"
        :key="filter.key"
        type="button"
        :data-test="`filter-${filter.key}`"
        class="shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium"
        :class="
          activeFilterKey === filter.key
            ? 'border-bz-gold-600 bg-bz-gold-600 text-white'
            : 'border-bz-border bg-white text-bz-ink-700'
        "
        @click="selectFilter(filter.key, filter.status)"
      >
        {{ filter.label }}
      </button>
    </div>

    <LoadingState v-if="staffOrdersStore.loading && staffOrdersStore.orders.length === 0" label="Loading orders..." />

    <ErrorState
      v-else-if="staffOrdersStore.error"
      :message="toUserSafeErrorMessage(staffOrdersStore.error)"
      @retry="() => staffOrdersStore.refetchCurrentFilters()"
    />

    <EmptyState
      v-else-if="staffOrdersStore.orders.length === 0"
      class="mt-6"
      title="No orders"
      description="Orders matching this filter will show up here."
    />

    <div v-else class="mt-4 space-y-3">
      <StaffOrderCard v-for="order in staffOrdersStore.orders" :key="order.id" :order="order" />
    </div>
  </main>
</template>
```

- [ ] **Step 4: Update the router**

In `frontend/src/router/index.ts`, change the `/staff` branch's `staff.home` route and add `staff.order-detail` (component file created in Task 8 — `import()`-ing it here is fine since Task 8 immediately follows in this plan's execution order; if running this task in isolation, confirm Task 8 runs next before relying on this route in a browser):

```ts
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
          component: () => import("../views/staff/OrderQueueView.vue"),
          meta: { role: "STAFF" },
        },
        {
          path: "orders/:orderId",
          name: "staff.order-detail",
          component: () => import("../views/staff/OrderDetailView.vue"),
          props: true,
          meta: { role: "STAFF" },
        },
      ],
    },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/staff-order-queue.test.ts`
Expected: this will only fully pass once Task 8's `OrderDetailView.vue` exists (same dynamic-import interdependency pattern as Foundation's Tasks 7+8) — implement Task 8 immediately after this one, in the same session, before treating this task as done.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(frontend): add staff order queue view with status filters"
```

---

### Task 8: Order detail view — transitions, customer attach, recovery code, receipt

**Files:**
- Create: `frontend/src/views/staff/OrderDetailView.vue`
- Create: `frontend/src/components/domain/CustomerAttachPanel.vue`
- Test: `frontend/tests/staff-order-detail.test.ts`

**Interfaces:**
- Produces (`OrderDetailView.vue`): loads the order via `staffOrdersStore.fetchOrder(orderId)`; renders `OrderStatusBadge`/`PaymentStatusBadge`/`OrderStatusTimeline` (all existing, reused as-is); shows exactly one primary action button matching the order's current `orderStatus` (`PENDING` → Accept + Reject; `ACCEPTED` → Start Preparing; `PREPARING` → Mark Ready; `READY` → Mark Served, disabled with an inline note if `orderType === "DINE_IN"` and `customerId === null`, matching the backend's `CUSTOMER_REQUIRED_BEFORE_SERVED` rule; terminal statuses show no action); Reject opens `ReasonConfirmationDialog`; below the actions, a `CustomerAttachPanel` when `customerId === null`; below that, for DINE_IN orders with a `guestSessionId`, a "Generate Recovery Code" button that calls `generateRecoveryCode(order.guestSessionId)` and displays the one-time code + expiry inline (never persisted, never logged); at the bottom, receipt links using `getStaffReceiptUrl(order.id)`.
- Produces (`CustomerAttachPanel.vue`): props `orderId: string`; emits `attached: []`; a debounced search input wired to `useStaffCustomersStore().search`, a results list where clicking a result calls `staffOrdersStore.attachCustomer(orderId, { customerId })`, and a "New customer" toggle exposing name/phone inputs that call `attachCustomer(orderId, { name, phone })`.
- Consumes: `useStaffOrdersStore` (Task 4), `useStaffCustomersStore` (Task 5), `generateRecoveryCode` (Task 3), `ReasonConfirmationDialog` (Task 6), `OrderStatusTimeline`/`OrderStatusBadge`/`PaymentStatusBadge` (existing), `toUserSafeErrorMessage` (Foundation), `getStaffReceiptUrl` (Task 3).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/staff-order-detail.test.ts
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as staffOrdersApi from "../src/api/staff-orders";
import * as staffGuestSessionsApi from "../src/api/staff-guest-sessions";
import OrderDetailView from "../src/views/staff/OrderDetailView.vue";
import { OrderStatus, OrderPaymentStatus } from "../src/types/enums";
import router from "../src/router";

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "o1",
    orderNumber: "ORD-1",
    billNumber: "BILL-1",
    orderType: "DINE_IN",
    orderStatus: OrderStatus.PENDING,
    paymentStatus: OrderPaymentStatus.UNPAID,
    tableId: "t1",
    tableNumber: "5",
    customerId: null,
    customerName: null,
    customerPhone: null,
    guestSessionId: "s1",
    subtotal: "100.00",
    taxAmount: "0.00",
    serviceChargeAmount: "0.00",
    discountAmount: "0.00",
    totalAmount: "100.00",
    paidAmount: "0.00",
    remainingAmount: "100.00",
    estimatedPreparationMinutes: 10,
    estimatedReadyAt: null,
    customerNotes: null,
    rejectionReason: null,
    cancellationReason: null,
    receiptImagePath: null,
    receiptImageUrl: null,
    items: [],
    acceptedAt: null,
    preparingAt: null,
    readyAt: null,
    servedAt: null,
    completedAt: null,
    rejectedAt: null,
    cancelledAt: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("OrderDetailView", () => {
  it("shows Accept and Reject for a PENDING order and accepts on click", async () => {
    vi.spyOn(staffOrdersApi, "getStaffOrder").mockResolvedValue({ order: makeOrder() as never });
    const acceptSpy = vi
      .spyOn(staffOrdersApi, "acceptOrder")
      .mockResolvedValue({ order: makeOrder({ orderStatus: OrderStatus.ACCEPTED }) as never });
    await router.isReady();

    const wrapper = mount(OrderDetailView, { props: { orderId: "o1" }, global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.text()).toContain("Accept");
    expect(wrapper.text()).toContain("Reject");

    await wrapper.find("[data-test='accept']").trigger("click");
    await flushPromises();

    expect(acceptSpy).toHaveBeenCalledWith("o1");
  });

  it("rejecting opens the reason dialog and submits the reason", async () => {
    vi.spyOn(staffOrdersApi, "getStaffOrder").mockResolvedValue({ order: makeOrder() as never });
    const rejectSpy = vi
      .spyOn(staffOrdersApi, "rejectOrder")
      .mockResolvedValue({ order: makeOrder({ orderStatus: OrderStatus.REJECTED }) as never });
    await router.isReady();

    const wrapper = mount(OrderDetailView, { props: { orderId: "o1" }, global: { plugins: [router] } });
    await flushPromises();

    await wrapper.find("[data-test='reject']").trigger("click");
    await wrapper.find("textarea").setValue("Kitchen is out of this item");
    await wrapper.find("[data-test='confirm']").trigger("click");
    await flushPromises();

    expect(rejectSpy).toHaveBeenCalledWith("o1", "Kitchen is out of this item");
  });

  it("disables Mark Served for a DINE_IN READY order with no attached customer", async () => {
    vi.spyOn(staffOrdersApi, "getStaffOrder").mockResolvedValue({
      order: makeOrder({ orderStatus: OrderStatus.READY, customerId: null }) as never,
    });
    await router.isReady();

    const wrapper = mount(OrderDetailView, { props: { orderId: "o1" }, global: { plugins: [router] } });
    await flushPromises();

    const button = wrapper.find("[data-test='mark-served']");
    expect((button.element as HTMLButtonElement).disabled).toBe(true);
  });

  it("generates and displays a recovery code for a DINE_IN order", async () => {
    vi.spyOn(staffOrdersApi, "getStaffOrder").mockResolvedValue({ order: makeOrder() as never });
    vi.spyOn(staffGuestSessionsApi, "generateRecoveryCode").mockResolvedValue({
      recoveryCode: "ABC123",
      expiresAt: "2026-07-20T00:05:00.000Z",
    });
    await router.isReady();

    const wrapper = mount(OrderDetailView, { props: { orderId: "o1" }, global: { plugins: [router] } });
    await flushPromises();

    await wrapper.find("[data-test='generate-recovery-code']").trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("ABC123");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/staff-order-detail.test.ts`
Expected: FAIL — view not found.

- [ ] **Step 3: Write `src/components/domain/CustomerAttachPanel.vue`**

```vue
<!-- frontend/src/components/domain/CustomerAttachPanel.vue -->
<script setup lang="ts">
import { ref } from "vue";

import { useStaffCustomersStore } from "../../stores/staff-customers.store";
import { useStaffOrdersStore } from "../../stores/staff-orders.store";

const props = defineProps<{ orderId: string }>();
const emit = defineEmits<{ attached: [] }>();

const staffCustomersStore = useStaffCustomersStore();
const staffOrdersStore = useStaffOrdersStore();

const query = ref("");
const showNewCustomerForm = ref(false);
const newName = ref("");
const newPhone = ref("");
const attaching = ref(false);

async function onSearchInput(): Promise<void> {
  await staffCustomersStore.search(query.value);
}

async function attachExisting(customerId: string): Promise<void> {
  attaching.value = true;
  try {
    await staffOrdersStore.attachCustomer(props.orderId, { customerId });
    emit("attached");
  } finally {
    attaching.value = false;
  }
}

async function attachNew(): Promise<void> {
  if (!newName.value.trim()) {
    return;
  }
  attaching.value = true;
  try {
    await staffOrdersStore.attachCustomer(props.orderId, {
      name: newName.value.trim(),
      phone: newPhone.value.trim() || undefined,
    });
    emit("attached");
  } finally {
    attaching.value = false;
  }
}
</script>

<template>
  <div class="rounded-2xl border border-bz-border bg-white p-4">
    <h2 class="text-sm font-semibold text-bz-ink-900">Attach a customer</h2>

    <template v-if="!showNewCustomerForm">
      <input
        v-model="query"
        type="text"
        placeholder="Search by name or phone"
        class="mt-2 w-full rounded-xl border border-bz-border bg-white px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        @input="onSearchInput"
      />
      <ul class="mt-2 space-y-1">
        <li v-for="customer in staffCustomersStore.results" :key="customer.id">
          <button
            type="button"
            class="w-full rounded-xl border border-bz-border px-3 py-2 text-left text-sm disabled:opacity-60"
            :disabled="attaching"
            @click="attachExisting(customer.id)"
          >
            {{ customer.name }} <span v-if="customer.phone" class="text-bz-ink-500">· {{ customer.phone }}</span>
          </button>
        </li>
      </ul>
      <button
        type="button"
        class="mt-2 text-sm text-bz-gold-700 underline underline-offset-2"
        @click="showNewCustomerForm = true"
      >
        + New customer
      </button>
    </template>

    <template v-else>
      <input
        v-model="newName"
        type="text"
        placeholder="Name"
        class="mt-2 w-full rounded-xl border border-bz-border bg-white px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
      />
      <input
        v-model="newPhone"
        type="tel"
        placeholder="Phone (optional)"
        class="mt-2 w-full rounded-xl border border-bz-border bg-white px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
      />
      <div class="mt-2 flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-full border border-bz-border py-2 text-sm font-medium text-bz-ink-700"
          @click="showNewCustomerForm = false"
        >
          Back to search
        </button>
        <button
          type="button"
          class="flex-1 rounded-full bg-bz-gold-600 py-2 text-sm font-medium text-white disabled:opacity-60"
          :disabled="attaching || !newName.trim()"
          @click="attachNew"
        >
          Attach
        </button>
      </div>
    </template>
  </div>
</template>
```

- [ ] **Step 4: Write `src/views/staff/OrderDetailView.vue`**

```vue
<!-- frontend/src/views/staff/OrderDetailView.vue -->
<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import CustomerAttachPanel from "../../components/domain/CustomerAttachPanel.vue";
import ErrorState from "../../components/feedback/ErrorState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import ReasonConfirmationDialog from "../../components/feedback/ReasonConfirmationDialog.vue";
import OrderStatusBadge from "../../components/domain/OrderStatusBadge.vue";
import OrderStatusTimeline from "../../components/domain/OrderStatusTimeline.vue";
import PaymentStatusBadge from "../../components/domain/PaymentStatusBadge.vue";
import { generateRecoveryCode } from "../../api/staff-guest-sessions";
import { getStaffReceiptUrl } from "../../api/staff-orders";
import { useStaffOrdersStore } from "../../stores/staff-orders.store";
import { CustomerType, OrderStatus } from "../../types/enums";
import { toUserSafeErrorMessage } from "../../utils/error-message";

const props = defineProps<{ orderId: string }>();
const router = useRouter();
const staffOrdersStore = useStaffOrdersStore();

const loading = ref(true);
const loadError = ref<string | null>(null);
const actionError = ref<string | null>(null);
const showRejectDialog = ref(false);
const rejecting = ref(false);
const recoveryCode = ref<{ code: string; expiresAt: string } | null>(null);
const generatingCode = ref(false);

const order = computed(() => staffOrdersStore.findOrder(props.orderId));

const canMarkServed = computed(() => {
  if (!order.value) {
    return false;
  }
  return order.value.orderType !== CustomerType.DINE_IN || order.value.customerId !== null;
});

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    await staffOrdersStore.fetchOrder(props.orderId);
  } catch (caught) {
    loadError.value = toUserSafeErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function runAction(action: () => Promise<void>): Promise<void> {
  actionError.value = null;
  try {
    await action();
  } catch (caught) {
    actionError.value = toUserSafeErrorMessage(caught);
  }
}

async function onAccept(): Promise<void> {
  await runAction(() => staffOrdersStore.accept(props.orderId));
}

async function onStartPreparing(): Promise<void> {
  await runAction(() => staffOrdersStore.startPreparing(props.orderId));
}

async function onMarkReady(): Promise<void> {
  await runAction(() => staffOrdersStore.markReady(props.orderId));
}

async function onMarkServed(): Promise<void> {
  await runAction(() => staffOrdersStore.markServed(props.orderId));
}

async function onConfirmReject(reason: string): Promise<void> {
  rejecting.value = true;
  try {
    await staffOrdersStore.reject(props.orderId, reason);
    showRejectDialog.value = false;
  } catch (caught) {
    actionError.value = toUserSafeErrorMessage(caught);
  } finally {
    rejecting.value = false;
  }
}

async function onGenerateRecoveryCode(): Promise<void> {
  if (!order.value?.guestSessionId) {
    return;
  }
  generatingCode.value = true;
  actionError.value = null;
  try {
    const result = await generateRecoveryCode(order.value.guestSessionId);
    recoveryCode.value = { code: result.recoveryCode, expiresAt: result.expiresAt };
  } catch (caught) {
    actionError.value = toUserSafeErrorMessage(caught);
  } finally {
    generatingCode.value = false;
  }
}
</script>

<template>
  <main class="flex min-h-dvh flex-col px-5 py-6">
    <button
      type="button"
      class="mb-4 self-start text-sm text-bz-ink-500 underline underline-offset-2"
      @click="router.push({ name: 'staff.home' })"
    >
      ← Back to queue
    </button>

    <LoadingState v-if="loading" label="Loading order..." />
    <ErrorState v-else-if="loadError || !order" :message="loadError ?? 'Order not found.'" @retry="load" />

    <template v-else>
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold text-bz-ink-900">{{ order.orderNumber }}</h1>
        <div class="flex gap-2">
          <OrderStatusBadge :status="order.orderStatus" />
          <PaymentStatusBadge :status="order.paymentStatus" />
        </div>
      </div>

      <p class="mt-1 text-sm text-bz-ink-500">
        <span v-if="order.tableNumber">Table {{ order.tableNumber }}</span>
        <span v-else>Takeaway</span>
        <span v-if="order.customerName"> · {{ order.customerName }}</span>
      </p>

      <div class="mt-5 rounded-2xl border border-bz-border bg-white p-4">
        <OrderStatusTimeline :status="order.orderStatus" />
      </div>

      <div class="mt-5 rounded-2xl border border-bz-border bg-white p-4">
        <div
          v-for="(item, index) in order.items"
          :key="index"
          class="flex items-center justify-between py-1 text-sm"
        >
          <span class="text-bz-ink-700">{{ item.quantity }}× {{ item.productNameSnapshot }}</span>
          <span class="font-medium text-bz-ink-900">Rs. {{ item.lineTotal }}</span>
        </div>
        <div class="mt-3 flex justify-between border-t border-bz-border pt-3 text-sm font-semibold text-bz-ink-900">
          <span>Total</span><span>Rs. {{ order.totalAmount }}</span>
        </div>
      </div>

      <p v-if="actionError" class="mt-4 rounded-xl bg-bz-red-tint px-4 py-3 text-sm text-bz-red">{{ actionError }}</p>

      <div class="mt-5 flex gap-3">
        <template v-if="order.orderStatus === OrderStatus.PENDING">
          <button
            type="button"
            data-test="accept"
            class="flex-1 rounded-full bg-bz-gold-600 py-2.5 text-sm font-medium text-white"
            @click="onAccept"
          >
            Accept
          </button>
          <button
            type="button"
            data-test="reject"
            class="flex-1 rounded-full border border-bz-red py-2.5 text-sm font-medium text-bz-red"
            @click="showRejectDialog = true"
          >
            Reject
          </button>
        </template>
        <button
          v-else-if="order.orderStatus === OrderStatus.ACCEPTED"
          type="button"
          data-test="start-preparing"
          class="flex-1 rounded-full bg-bz-gold-600 py-2.5 text-sm font-medium text-white"
          @click="onStartPreparing"
        >
          Start Preparing
        </button>
        <button
          v-else-if="order.orderStatus === OrderStatus.PREPARING"
          type="button"
          data-test="mark-ready"
          class="flex-1 rounded-full bg-bz-gold-600 py-2.5 text-sm font-medium text-white"
          @click="onMarkReady"
        >
          Mark Ready
        </button>
        <div v-else-if="order.orderStatus === OrderStatus.READY" class="flex-1">
          <button
            type="button"
            data-test="mark-served"
            class="w-full rounded-full bg-bz-gold-600 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            :disabled="!canMarkServed"
            @click="onMarkServed"
          >
            Mark Served
          </button>
          <p v-if="!canMarkServed" class="mt-2 text-xs text-bz-red">
            Attach a customer before marking this order served.
          </p>
        </div>
      </div>

      <CustomerAttachPanel
        v-if="order.customerId === null"
        class="mt-5"
        :order-id="order.id"
        @attached="load"
      />

      <div v-if="order.orderType === CustomerType.DINE_IN && order.guestSessionId" class="mt-5 rounded-2xl border border-bz-border bg-white p-4">
        <h2 class="text-sm font-semibold text-bz-ink-900">Recovery code</h2>
        <p class="mt-1 text-xs text-bz-ink-500">
          Generate a code the guest can use to reclaim this session on another device. Valid for a few minutes.
        </p>
        <button
          type="button"
          data-test="generate-recovery-code"
          class="mt-3 rounded-full border border-bz-border px-4 py-2 text-sm font-medium text-bz-ink-900 disabled:opacity-60"
          :disabled="generatingCode"
          @click="onGenerateRecoveryCode"
        >
          {{ generatingCode ? "Generating..." : "Generate Recovery Code" }}
        </button>
        <p v-if="recoveryCode" class="mt-3 rounded-xl bg-bz-amber-tint px-3 py-2 text-sm text-bz-ink-900">
          Code: <span class="font-mono font-semibold">{{ recoveryCode.code }}</span>
        </p>
      </div>

      <a
        :href="getStaffReceiptUrl(order.id)"
        target="_blank"
        rel="noopener"
        class="mt-5 block rounded-full border border-bz-border py-2.5 text-center text-sm font-medium text-bz-ink-900"
      >
        View Receipt
      </a>
    </template>

    <ReasonConfirmationDialog
      :open="showRejectDialog"
      title="Reject this order?"
      description="Tell the customer why this order was rejected."
      confirm-label="Reject Order"
      :confirming="rejecting"
      @cancel="showRejectDialog = false"
      @confirm="onConfirmReject"
    />
  </main>
</template>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/staff-order-detail.test.ts tests/staff-order-queue.test.ts`
Expected: PASS (all — this also completes Task 7's deferred verification now that both view files exist)

- [ ] **Step 6: Run full suite, typecheck, lint**

- [ ] **Step 7: Commit**

```bash
git add frontend/src/views/staff/OrderDetailView.vue frontend/src/components/domain/CustomerAttachPanel.vue frontend/tests/staff-order-detail.test.ts
git commit -m "feat(frontend): add staff order detail view with transitions, customer attach, and recovery codes"
```

---

### Task 9: Staff socket store

**Files:**
- Create: `frontend/src/stores/staff-socket.store.ts`
- Modify: `frontend/src/views/staff/OrderQueueView.vue` (call `staffSocketStore.init()` on mount, mirroring the guest `SessionView.vue` pattern)
- Test: `frontend/tests/staff-socket-store.test.ts`

**Interfaces:**
- Produces: `useStaffSocketStore()` with state `connected: Ref<boolean>`; action `init(): void` — idempotent (an `initialized` module-level-style flag, same pattern as the existing guest `socket.store.ts`), registers `connect`/`disconnect` listeners plus one listener per relevant event (`order:created`, `order:accepted`, `order:rejected`, `order:status-updated`, `order:cancelled`, `order:payment-updated`, `order:completed`, `table:occupied`, `table:released`, `guest-session:expired`, `guest-session:closed`, `guest-session:force-closed`) that all call `staffOrdersStore.refetchCurrentFilters()` (a targeted refetch of whatever the Staff member is currently viewing, not a blind full-app reload), then calls `connectSocket()`. No `teardown` call site is added in this task (matching the existing guest pattern's own gap, already noted as a pre-existing minor finding — not introduced here, not this task's job to fix a Foundation/guest-flow issue).
- Consumes: `connectSocket`, `getSocket` from `../socket/client` (Foundation); `SOCKET_EVENTS` from `../constants/socket-events` (existing); `useStaffOrdersStore` (Task 4).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/staff-socket-store.test.ts
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/socket/client", () => {
  const handlers: Record<string, Array<() => void>> = {};
  const socket = {
    on: vi.fn((event: string, handler: () => void) => {
      handlers[event] = handlers[event] ?? [];
      handlers[event].push(handler);
    }),
    __emit: (event: string) => {
      (handlers[event] ?? []).forEach((handler) => handler());
    },
  };
  return {
    getSocket: vi.fn(() => socket),
    connectSocket: vi.fn(() => socket),
    disconnectSocket: vi.fn(),
  };
});

import { getSocket } from "../src/socket/client";
import { useStaffOrdersStore } from "../src/stores/staff-orders.store";
import { useStaffSocketStore } from "../src/stores/staff-socket.store";
import { SOCKET_EVENTS } from "../src/constants/socket-events";

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("staff socket store", () => {
  it("refetches the current filters when an order event arrives", () => {
    const staffOrdersStore = useStaffOrdersStore();
    const refetchSpy = vi.spyOn(staffOrdersStore, "refetchCurrentFilters").mockResolvedValue();
    const staffSocketStore = useStaffSocketStore();

    staffSocketStore.init();
    const socket = getSocket() as unknown as { __emit: (event: string) => void };
    socket.__emit(SOCKET_EVENTS.ORDER_STATUS_UPDATED);

    expect(refetchSpy).toHaveBeenCalled();
  });

  it("init is idempotent — calling it twice registers listeners once", () => {
    const staffSocketStore = useStaffSocketStore();
    staffSocketStore.init();
    staffSocketStore.init();

    const socket = getSocket() as unknown as { on: ReturnType<typeof vi.fn> };
    const orderCreatedCalls = socket.on.mock.calls.filter(
      ([event]) => event === SOCKET_EVENTS.ORDER_CREATED,
    );
    expect(orderCreatedCalls).toHaveLength(1);
  });

  it("sets connected to true/false on socket connect/disconnect events", () => {
    const staffSocketStore = useStaffSocketStore();
    staffSocketStore.init();
    const socket = getSocket() as unknown as { __emit: (event: string) => void };

    socket.__emit("connect");
    expect(staffSocketStore.connected).toBe(true);

    socket.__emit("disconnect");
    expect(staffSocketStore.connected).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/staff-socket-store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/stores/staff-socket.store.ts`**

```ts
// frontend/src/stores/staff-socket.store.ts
import { defineStore } from "pinia";
import { ref } from "vue";

import { connectSocket, getSocket } from "../socket/client";
import { SOCKET_EVENTS } from "../constants/socket-events";
import { useStaffOrdersStore } from "./staff-orders.store";

export const useStaffSocketStore = defineStore("staffSocket", () => {
  const connected = ref(false);
  let initialized = false;

  function init(): void {
    if (initialized) {
      connectSocket();
      return;
    }
    initialized = true;

    const socket = getSocket();

    socket.on("connect", () => {
      connected.value = true;
    });

    socket.on("disconnect", () => {
      connected.value = false;
    });

    const refetch = () => {
      const staffOrdersStore = useStaffOrdersStore();
      void staffOrdersStore.refetchCurrentFilters();
    };

    for (const eventName of [
      SOCKET_EVENTS.ORDER_CREATED,
      SOCKET_EVENTS.ORDER_ACCEPTED,
      SOCKET_EVENTS.ORDER_REJECTED,
      SOCKET_EVENTS.ORDER_STATUS_UPDATED,
      SOCKET_EVENTS.ORDER_CANCELLED,
      SOCKET_EVENTS.ORDER_PAYMENT_UPDATED,
      SOCKET_EVENTS.ORDER_COMPLETED,
      SOCKET_EVENTS.TABLE_OCCUPIED,
      SOCKET_EVENTS.TABLE_RELEASED,
      SOCKET_EVENTS.GUEST_SESSION_EXPIRED,
      SOCKET_EVENTS.GUEST_SESSION_CLOSED,
      SOCKET_EVENTS.GUEST_SESSION_FORCE_CLOSED,
    ]) {
      socket.on(eventName, refetch);
    }

    connectSocket();
  }

  return { connected, init };
});
```

- [ ] **Step 4: Wire `init()` into `OrderQueueView.vue`**

In `frontend/src/views/staff/OrderQueueView.vue`, add the import and call `staffSocketStore.init()` alongside the existing `onMounted` fetch:

```ts
import { useStaffSocketStore } from "../../stores/staff-socket.store";
```
```ts
const staffSocketStore = useStaffSocketStore();
```
```ts
onMounted(() => {
  staffSocketStore.init();
  void staffOrdersStore.fetchOrders();
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/staff-socket-store.test.ts tests/staff-order-queue.test.ts`
Expected: PASS (all)

- [ ] **Step 6: Run full suite, typecheck, lint**

- [ ] **Step 7: Commit**

```bash
git add frontend/src/stores/staff-socket.store.ts frontend/src/views/staff/OrderQueueView.vue frontend/tests/staff-socket-store.test.ts
git commit -m "feat(frontend): add staff socket store wired to order-queue refetch"
```

---

### Task 10: Settings read view

**Files:**
- Create: `frontend/src/views/staff/SettingsView.vue`
- Modify: `frontend/src/router/index.ts` (add `staff.settings` route)
- Modify: `frontend/src/layouts/StaffLayout.vue` (add a simple nav link between Queue and Settings)
- Test: `frontend/tests/staff-settings-view.test.ts`

**Interfaces:**
- Produces: a read-only view showing `taxRatePercent`/`serviceChargePercent` from `getSettings()`, with the existing `LoadingState`/`ErrorState` pattern. No form, no submit — PATCH is Admin-only and out of scope here.
- Consumes: `getSettings` from `../../api/settings` (Task 3).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/staff-settings-view.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/staff-settings-view.test.ts`
Expected: FAIL — view not found.

- [ ] **Step 3: Write `src/views/staff/SettingsView.vue`**

```vue
<!-- frontend/src/views/staff/SettingsView.vue -->
<script setup lang="ts">
import { onMounted, ref } from "vue";

import ErrorState from "../../components/feedback/ErrorState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import { getSettings } from "../../api/settings";
import type { CafeSettings } from "../../types/settings";
import { toUserSafeErrorMessage } from "../../utils/error-message";

const settings = ref<CafeSettings | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    const result = await getSettings();
    settings.value = result.settings;
  } catch (caught) {
    loadError.value = toUserSafeErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <main class="flex min-h-dvh flex-col px-5 py-6">
    <h1 class="text-xl font-bold text-bz-ink-900">Café Settings</h1>

    <LoadingState v-if="loading" label="Loading settings..." />
    <ErrorState v-else-if="loadError || !settings" :message="loadError ?? 'Could not load settings.'" @retry="load" />

    <div v-else class="mt-4 space-y-3 rounded-2xl border border-bz-border bg-white p-4">
      <div class="flex justify-between text-sm">
        <span class="text-bz-ink-500">Tax rate</span>
        <span class="font-medium text-bz-ink-900">{{ settings.taxRatePercent }}%</span>
      </div>
      <div class="flex justify-between text-sm">
        <span class="text-bz-ink-500">Service charge</span>
        <span class="font-medium text-bz-ink-900">{{ settings.serviceChargePercent }}%</span>
      </div>
    </div>
  </main>
</template>
```

- [ ] **Step 4: Add the route**

In `frontend/src/router/index.ts`, add to the `/staff` children array (after `staff.order-detail`):

```ts
        {
          path: "settings",
          name: "staff.settings",
          component: () => import("../views/staff/SettingsView.vue"),
          meta: { role: "STAFF" },
        },
```

- [ ] **Step 5: Add a nav link in `StaffLayout.vue`**

Update `frontend/src/layouts/StaffLayout.vue`'s header bar to include a link to Settings alongside the existing "BAZM Staff" label:

```vue
<script setup lang="ts"></script>

<template>
  <div class="min-h-dvh bg-bz-bg font-sans text-bz-ink-900">
    <div class="flex items-center justify-between border-b border-bz-border bg-white px-4 py-2">
      <span class="text-xs font-semibold uppercase tracking-wide text-bz-ink-500">BAZM Staff</span>
      <RouterLink :to="{ name: 'staff.settings' }" class="text-xs font-medium text-bz-gold-700 underline underline-offset-2">
        Settings
      </RouterLink>
    </div>
    <RouterView />
  </div>
</template>
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/staff-settings-view.test.ts`
Expected: PASS

- [ ] **Step 7: Run full suite, typecheck, lint**

- [ ] **Step 8: Commit**

```bash
git add frontend/src/views/staff/SettingsView.vue frontend/src/router/index.ts frontend/src/layouts/StaffLayout.vue frontend/tests/staff-settings-view.test.ts
git commit -m "feat(frontend): add staff read-only settings view"
```

---

### Task 11: Final regression pass

**Files:** none created — verification only.

- [ ] **Step 1: Run the full frontend suite**

Run (from `frontend/`): `npm run typecheck && npm run lint && npm run test`
Expected: all clean, all tests passing (Foundation's 55 plus every test added in this plan).

- [ ] **Step 2: Run the backend's safe (non-DB) checks**

Run (from `backend/`): `npm run typecheck` and `npx tsx --test tests/unit/utils.node.test.ts tests/unit/order-safe-mapping.node.test.ts`
Expected: clean.

- [ ] **Step 3: Manually trace the role boundary one more time**

Read through `frontend/src/views/staff/*.vue` and confirm none of them import or call anything from `frontend/src/api/staff-*` that isn't in this plan (no payments, no cancellation, no table release, no CRUD) — a simple `grep -rn "cancel\|payment\|force-release\|/tables" frontend/src/views/staff frontend/src/api/staff-*.ts` should return nothing.

- [ ] **Step 4: Commit (if the above surfaced any fix)**

Only if Step 3 found something to correct — otherwise no commit needed for this task.

---

## Self-Review

**Spec coverage:** Login/logout (Foundation, reused) ✅; operational order queue with filters ✅ (Task 7); order details ✅ (Task 8); accept/reject ✅; start preparing/mark ready/mark served ✅; customer search/create/attach ✅ (Task 8 + `CustomerAttachPanel`); recovery-code generation ✅ (Task 8, unblocked by Task 1's backend fix); safe table release — explicitly **excluded** per the confirmed backend-authorization finding, not silently dropped; settings read ✅ (Task 10); media operations — the docs say "if present," and Staff has no product/category screens to attach media to in this plan, so there is nothing for a media action to attach to; correctly omitted, not overlooked.

**Placeholder scan:** no TBD/TODO, no "similar to Task N" without code, every step has complete runnable code.

**Type consistency:** `SafeOrder.guestSessionId` (Task 1 backend, Task 2 frontend) is the same field name and semantics used in Task 8's recovery-code button (`order.guestSessionId`). `AttachCustomerInput` (Task 3) matches exactly what `staffOrdersStore.attachCustomer` (Task 4) and `CustomerAttachPanel` (Task 8) pass. `StaffOrderFilters` (Task 3) matches `staffOrdersStore.fetchOrders`'s parameter (Task 4) and `OrderQueueView`'s filter chips (Task 7).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-20-bazm-staff-app.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
