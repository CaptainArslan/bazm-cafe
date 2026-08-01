# Admin Nav Shell + Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin app's placeholder home with a responsive nav shell (sidebar/drawer listing all 11 eventual admin modules) and a live dashboard showing four operational stat tiles, computed client-side from existing backend endpoints.

**Architecture:** Two new frontend-only API wrapper files (`admin-payments.ts`, `admin-products.ts`) call existing ADMIN-authorized backend list endpoints. A new `AdminLayout.vue` renders a CSS-transform-driven sidebar (static on desktop, slide-in drawer on mobile) built from a single nav-groups data structure. Ten of the eleven module routes render a shared `ComingSoonView.vue` placeholder; the eleventh (dashboard) gets a real `DashboardView.vue` that fetches orders/payments/products in parallel and derives four tile values.

**Tech Stack:** Vue 3 (`<script setup lang="ts">`), Vue Router, Pinia, Tailwind CSS (existing `bz-*` design tokens), Vitest + @vue/test-utils.

**Design spec:** `docs/superpowers/specs/2026-07-21-admin-nav-shell-dashboard-design.md`

## Global Constraints

- Frontend-only. No files under `backend/` may change.
- No new Admin CRUD screens beyond the placeholder pages — that is out of scope for this slice (future slices build each module).
- Use only existing Tailwind tokens already defined in `frontend/src/styles/tokens.css` (`bz-gold-100`..`900`, `bz-ink-900/800/700/500/300/100`, `bz-bg`, `bz-border`, etc.) — no new colors.
- Tests live in `frontend/tests/*.test.ts` (flat directory, not colocated) per existing convention — never create a `.spec.ts` file or colocate a test next to its source file.
- Follow the existing test patterns exactly: API wrapper tests stub `global.fetch` directly (see `frontend/tests/api-media.test.ts`); component tests use `mount()` + `vi.spyOn(apiModule, "fnName")` + `setActivePinia(createPinia())` in `beforeEach` (see `frontend/tests/staff-settings-view.test.ts`, `frontend/tests/staff-order-queue.test.ts`).
- Route names/paths must exactly match the table in the design spec's "Navigation shell" section.
- Run `npm run typecheck && npm run lint && npm run test` (from `frontend/`) after every task; all three must be clean before committing.

---

### Task 1: Payment types + `admin-payments` API wrapper

**Files:**
- Modify: `frontend/src/types/enums.ts` (add `PaymentStatus`)
- Create: `frontend/src/types/payment.ts`
- Create: `frontend/src/api/admin-payments.ts`
- Test: `frontend/tests/api-admin-payments.test.ts`

**Interfaces:**
- Produces: `PaymentStatus` enum (`PENDING`/`COMPLETED`/`FAILED`/`REFUNDED`) from `../types/enums`; `SafePayment` type from `../types/payment`; `listAdminPayments(): Promise<{ payments: SafePayment[] }>` from `../api/admin-payments`.

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/api-admin-payments.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { listAdminPayments } from "../src/api/admin-payments";

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin payments api", () => {
  it("listAdminPayments fetches the full payments list", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        message: "Payments retrieved successfully.",
        data: {
          payments: [
            {
              id: "p1",
              paymentNumber: "PAY-1",
              orderId: "o1",
              amount: "50.00",
              method: "CASH",
              status: "COMPLETED",
              reference: null,
              notes: null,
              paidAt: "2026-07-21T09:30:00.000Z",
              voidedAt: null,
              voidReason: null,
              createdAt: "2026-07-21T09:30:00.000Z",
            },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await listAdminPayments();

    expect(result.payments).toHaveLength(1);
    expect(result.payments[0].amount).toBe("50.00");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/payments");
    expect(init.method).toBe("GET");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `frontend/`): `npx vitest run tests/api-admin-payments.test.ts`
Expected: FAIL — `Cannot find module '../src/api/admin-payments'` (or similar resolution error).

- [ ] **Step 3: Add `PaymentStatus` to `frontend/src/types/enums.ts`**

Append to the end of the file (after the existing `PaymentMethod` block):

```ts
export const PaymentStatus = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
```

- [ ] **Step 4: Create `frontend/src/types/payment.ts`**

```ts
import type { PaymentMethod, PaymentStatus } from "./enums";

export type SafePayment = {
  id: string;
  paymentNumber: string;
  orderId: string;
  amount: string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string | null;
  notes: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
};
```

- [ ] **Step 5: Create `frontend/src/api/admin-payments.ts`**

```ts
import { authHttp } from "./http";
import type { SafePayment } from "../types/payment";

export function listAdminPayments() {
  return authHttp.get<{ payments: SafePayment[] }>("/payments");
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/api-admin-payments.test.ts`
Expected: PASS (1 test).

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/types/enums.ts frontend/src/types/payment.ts frontend/src/api/admin-payments.ts frontend/tests/api-admin-payments.test.ts
git commit -m "feat(frontend): add PaymentStatus type and admin payments list API wrapper"
```

---

### Task 2: `admin-products` API wrapper

**Files:**
- Create: `frontend/src/api/admin-products.ts`
- Test: `frontend/tests/api-admin-products.test.ts`

**Interfaces:**
- Consumes: `SafeProduct` type (already exists at `frontend/src/types/product.ts` — has `stockQuantity`, `reservedQuantity`, `availableQuantity`, `lowStockThreshold` fields already).
- Produces: `listAdminProducts(): Promise<{ products: SafeProduct[] }>` from `../api/admin-products`.

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/api-admin-products.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { listAdminProducts } from "../src/api/admin-products";

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin products api", () => {
  it("listAdminProducts fetches the full products list", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        message: "Products retrieved successfully.",
        data: {
          products: [
            {
              id: "prod1",
              categoryId: "c1",
              categoryName: "Drinks",
              name: "Espresso",
              slug: "espresso",
              description: null,
              imagePath: null,
              price: "3.00",
              preparationMinutes: 5,
              stockQuantity: 2,
              reservedQuantity: 0,
              availableQuantity: 2,
              lowStockThreshold: 5,
              trackStock: true,
              isAvailable: true,
              displayOrder: 0,
              createdAt: "2026-07-21T00:00:00.000Z",
              updatedAt: "2026-07-21T00:00:00.000Z",
            },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await listAdminProducts();

    expect(result.products).toHaveLength(1);
    expect(result.products[0].availableQuantity).toBe(2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/products");
    expect(init.method).toBe("GET");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/api-admin-products.test.ts`
Expected: FAIL — `Cannot find module '../src/api/admin-products'`.

- [ ] **Step 3: Create `frontend/src/api/admin-products.ts`**

```ts
import { authHttp } from "./http";
import type { SafeProduct } from "../types/product";

export function listAdminProducts() {
  return authHttp.get<{ products: SafeProduct[] }>("/products");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/api-admin-products.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/admin-products.ts frontend/tests/api-admin-products.test.ts
git commit -m "feat(frontend): add admin products list API wrapper"
```

---

### Task 3: `ComingSoonView.vue` placeholder component

**Files:**
- Create: `frontend/src/views/admin/ComingSoonView.vue`
- Test: `frontend/tests/admin-coming-soon-view.test.ts`

**Interfaces:**
- Produces: `ComingSoonView` component with a single required prop `title: string`, rendering `title` and the text "Coming soon".

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/admin-coming-soon-view.test.ts`:

```ts
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ComingSoonView from "../src/views/admin/ComingSoonView.vue";

describe("ComingSoonView", () => {
  it("renders the given title and a coming soon message", () => {
    const wrapper = mount(ComingSoonView, { props: { title: "Staff" } });

    expect(wrapper.text()).toContain("Staff");
    expect(wrapper.text()).toContain("Coming soon");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/admin-coming-soon-view.test.ts`
Expected: FAIL — `Cannot find module '../src/views/admin/ComingSoonView.vue'`.

- [ ] **Step 3: Create `frontend/src/views/admin/ComingSoonView.vue`**

```vue
<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
    <h1 class="text-xl font-bold text-bz-ink-900">{{ title }}</h1>
    <p class="text-sm text-bz-ink-500">Coming soon.</p>
  </main>
</template>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/admin-coming-soon-view.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/admin/ComingSoonView.vue frontend/tests/admin-coming-soon-view.test.ts
git commit -m "feat(frontend): add admin ComingSoonView placeholder component"
```

---

### Task 4: Router — placeholder routes for the 11 admin modules

**Files:**
- Modify: `frontend/src/router/index.ts`
- Test: `frontend/tests/router-guards.test.ts`

**Interfaces:**
- Consumes: `ComingSoonView` from Task 3 (`../views/admin/ComingSoonView.vue`).
- Produces: 11 new named routes, each `meta: { role: "ADMIN" }`, reachable under `/admin`: `admin.orders`, `admin.cancellations`, `admin.payments`, `admin.categories`, `admin.products`, `admin.stock`, `admin.media`, `admin.customers`, `admin.staff`, `admin.tables`, `admin.settings`.

- [ ] **Step 1: Write the failing tests**

Open `frontend/tests/router-guards.test.ts` and add two new `it` blocks inside the existing `describe("router role guards", ...)` block (after the last existing test, before the closing `});`):

```ts
  it("redirects an unauthenticated visitor away from /admin/staff to admin.login", async () => {
    const router = (await import("../src/router")).default;
    await router.push("/admin/staff");
    await router.isReady();
    expect(router.currentRoute.value.name).toBe("admin.login");
  });

  it("lets an authenticated ADMIN user reach a placeholder admin module route", async () => {
    const authStore = useAuthStore();
    // Test seam: see above.
    authStore.user = { id: "2", name: "Ali", email: "ali@bazm.test", role: "ADMIN" };
    authStore.status = "ready";

    const router = (await import("../src/router")).default;
    await router.push("/admin/staff");
    await router.isReady();
    expect(router.currentRoute.value.name).toBe("admin.staff");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/router-guards.test.ts`
Expected: FAIL — both new tests resolve `router.currentRoute.value.name` to `undefined` (no matching route for `/admin/staff` yet), so they don't equal `"admin.login"` / `"admin.staff"`.

- [ ] **Step 3: Modify `frontend/src/router/index.ts`**

Find this block (the current `/admin` route):

```ts
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
```

Replace it with:

```ts
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
        {
          path: "orders",
          name: "admin.orders",
          component: () => import("../views/admin/ComingSoonView.vue"),
          props: () => ({ title: "Orders" }),
          meta: { role: "ADMIN" },
        },
        {
          path: "cancellations",
          name: "admin.cancellations",
          component: () => import("../views/admin/ComingSoonView.vue"),
          props: () => ({ title: "Cancellations" }),
          meta: { role: "ADMIN" },
        },
        {
          path: "payments",
          name: "admin.payments",
          component: () => import("../views/admin/ComingSoonView.vue"),
          props: () => ({ title: "Payments" }),
          meta: { role: "ADMIN" },
        },
        {
          path: "categories",
          name: "admin.categories",
          component: () => import("../views/admin/ComingSoonView.vue"),
          props: () => ({ title: "Categories" }),
          meta: { role: "ADMIN" },
        },
        {
          path: "products",
          name: "admin.products",
          component: () => import("../views/admin/ComingSoonView.vue"),
          props: () => ({ title: "Products" }),
          meta: { role: "ADMIN" },
        },
        {
          path: "stock",
          name: "admin.stock",
          component: () => import("../views/admin/ComingSoonView.vue"),
          props: () => ({ title: "Stock" }),
          meta: { role: "ADMIN" },
        },
        {
          path: "media",
          name: "admin.media",
          component: () => import("../views/admin/ComingSoonView.vue"),
          props: () => ({ title: "Media" }),
          meta: { role: "ADMIN" },
        },
        {
          path: "customers",
          name: "admin.customers",
          component: () => import("../views/admin/ComingSoonView.vue"),
          props: () => ({ title: "Customers" }),
          meta: { role: "ADMIN" },
        },
        {
          path: "staff",
          name: "admin.staff",
          component: () => import("../views/admin/ComingSoonView.vue"),
          props: () => ({ title: "Staff" }),
          meta: { role: "ADMIN" },
        },
        {
          path: "tables",
          name: "admin.tables",
          component: () => import("../views/admin/ComingSoonView.vue"),
          props: () => ({ title: "Tables & QR" }),
          meta: { role: "ADMIN" },
        },
        {
          path: "settings",
          name: "admin.settings",
          component: () => import("../views/admin/ComingSoonView.vue"),
          props: () => ({ title: "Settings" }),
          meta: { role: "ADMIN" },
        },
      ],
    },
```

(`admin.home` still points at `HomePlaceholder.vue` here — Task 6 swaps it to the real dashboard.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/router-guards.test.ts`
Expected: PASS (all tests in the file, including the two new ones).

- [ ] **Step 5: Run the full frontend suite, typecheck, and lint**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all clean, all tests passing.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/router/index.ts frontend/tests/router-guards.test.ts
git commit -m "feat(frontend): add placeholder routes for the 11 admin modules"
```

---

### Task 5: `AdminLayout.vue` nav shell (sidebar/drawer)

**Files:**
- Modify: `frontend/src/layouts/AdminLayout.vue`
- Test: `frontend/tests/admin-layout.test.ts`

**Interfaces:**
- Consumes: `useAuthStore()` (`logout()`, `user`, `role` — from `frontend/src/stores/auth.store.ts`), route names from Task 4 plus `admin.home`.
- Produces: nav links with `data-test="nav-link-<routeName>"` for all 12 route names; drawer toggle button `data-test="nav-drawer-toggle"`; backdrop `data-test="nav-drawer-backdrop"` (present only while the drawer is open); sign-out button `data-test="sign-out"`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/tests/admin-layout.test.ts`:

```ts
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminLayout from "../src/layouts/AdminLayout.vue";
import { useAuthStore } from "../src/stores/auth.store";
import router from "../src/router";

// Polls with real timers until the given predicate over the router's current route is satisfied.
// router.isReady() only resolves for the *initial* navigation, so it can't be used to await a
// router.replace() triggered from onLogout: that subsequent navigation runs an async route guard
// and a dynamic import() of the destination view component (see frontend/tests/login-flow.test.ts).
async function waitForRoute(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 30 && !predicate(); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    await flushPromises();
  }
}

const ALL_ROUTE_NAMES = [
  "admin.home",
  "admin.orders",
  "admin.cancellations",
  "admin.payments",
  "admin.categories",
  "admin.products",
  "admin.stock",
  "admin.media",
  "admin.customers",
  "admin.staff",
  "admin.tables",
  "admin.settings",
];

function signInAsAdmin() {
  const authStore = useAuthStore();
  // Test seam: matches the pattern in router-guards.test.ts — writes directly to the
  // store's refs to simulate an already-authenticated session without hitting the network.
  authStore.user = { id: "1", name: "Admin", email: "admin@bazm.test", role: "ADMIN" };
  authStore.status = "ready";
  return authStore;
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("AdminLayout", () => {
  it("renders a nav link for every admin module and the dashboard", async () => {
    signInAsAdmin();
    await router.push("/admin/staff");
    await router.isReady();
    const wrapper = mount(AdminLayout, { global: { plugins: [router] } });

    for (const name of ALL_ROUTE_NAMES) {
      expect(wrapper.find(`[data-test="nav-link-${name}"]`).exists()).toBe(true);
    }
  });

  it("highlights only the active route's nav link", async () => {
    signInAsAdmin();
    await router.push("/admin/staff");
    await router.isReady();
    const wrapper = mount(AdminLayout, { global: { plugins: [router] } });

    expect(wrapper.get('[data-test="nav-link-admin.staff"]').classes()).toContain("bg-bz-gold-100");
    expect(wrapper.get('[data-test="nav-link-admin.home"]').classes()).not.toContain("bg-bz-gold-100");
  });

  it("toggles the mobile drawer backdrop open and closed", async () => {
    signInAsAdmin();
    await router.push("/admin/staff");
    await router.isReady();
    const wrapper = mount(AdminLayout, { global: { plugins: [router] } });

    expect(wrapper.find('[data-test="nav-drawer-backdrop"]').exists()).toBe(false);
    await wrapper.get('[data-test="nav-drawer-toggle"]').trigger("click");
    expect(wrapper.find('[data-test="nav-drawer-backdrop"]').exists()).toBe(true);
    await wrapper.get('[data-test="nav-drawer-backdrop"]').trigger("click");
    expect(wrapper.find('[data-test="nav-drawer-backdrop"]').exists()).toBe(false);
  });

  it("signs out and redirects to admin login", async () => {
    const authStore = signInAsAdmin();
    vi.spyOn(authStore, "logout").mockImplementation(async () => {
      authStore.user = null;
    });

    await router.push("/admin/staff");
    await router.isReady();
    const wrapper = mount(AdminLayout, { global: { plugins: [router] } });

    await wrapper.get('[data-test="sign-out"]').trigger("click");
    await waitForRoute(() => router.currentRoute.value.name === "admin.login");

    expect(authStore.logout).toHaveBeenCalledOnce();
    expect(router.currentRoute.value.name).toBe("admin.login");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/admin-layout.test.ts`
Expected: FAIL — the current `AdminLayout.vue` has no nav links, no drawer toggle, and no sign-out button.

- [ ] **Step 3: Modify `frontend/src/layouts/AdminLayout.vue`**

Replace the entire file with:

```vue
<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useAuthStore } from "../stores/auth.store";

type NavItem = { label: string; routeName: string };
type NavGroup = { label: string | null; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  { label: null, items: [{ label: "Dashboard", routeName: "admin.home" }] },
  {
    label: "Operations",
    items: [
      { label: "Orders", routeName: "admin.orders" },
      { label: "Cancellations", routeName: "admin.cancellations" },
      { label: "Payments", routeName: "admin.payments" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "Categories", routeName: "admin.categories" },
      { label: "Products", routeName: "admin.products" },
      { label: "Stock", routeName: "admin.stock" },
      { label: "Media", routeName: "admin.media" },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Customers", routeName: "admin.customers" },
      { label: "Staff", routeName: "admin.staff" },
    ],
  },
  {
    label: null,
    items: [
      { label: "Tables & QR", routeName: "admin.tables" },
      { label: "Settings", routeName: "admin.settings" },
    ],
  },
];

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const isDrawerOpen = ref(false);

function closeDrawer(): void {
  isDrawerOpen.value = false;
}

async function onLogout(): Promise<void> {
  await authStore.logout();
  router.replace({ name: "admin.login" });
}
</script>

<template>
  <div class="min-h-dvh bg-bz-bg font-sans text-bz-ink-900 md:flex">
    <div class="flex items-center justify-between border-b border-bz-border bg-white px-4 py-2 md:hidden">
      <span class="text-xs font-semibold uppercase tracking-wide text-bz-ink-500">BAZM Admin</span>
      <button
        type="button"
        data-test="nav-drawer-toggle"
        class="text-sm font-medium text-bz-ink-700"
        @click="isDrawerOpen = !isDrawerOpen"
      >
        Menu
      </button>
    </div>

    <div
      v-if="isDrawerOpen"
      data-test="nav-drawer-backdrop"
      class="fixed inset-0 z-20 bg-black/30 md:hidden"
      @click="closeDrawer"
    />

    <aside
      data-test="nav-sidebar"
      class="fixed inset-y-0 left-0 z-30 w-64 -translate-x-full overflow-y-auto border-r border-bz-border bg-white px-4 py-5 transition-transform duration-200 md:static md:z-auto md:w-64 md:translate-x-0"
      :class="{ 'translate-x-0': isDrawerOpen }"
    >
      <p class="px-2 text-xs font-semibold uppercase tracking-wide text-bz-ink-500">BAZM Admin</p>

      <nav class="mt-4 flex flex-col gap-4">
        <div v-for="(group, index) in NAV_GROUPS" :key="index">
          <p v-if="group.label" class="px-2 text-xs font-semibold uppercase tracking-wide text-bz-ink-300">
            {{ group.label }}
          </p>
          <div class="mt-1 flex flex-col gap-0.5">
            <RouterLink
              v-for="item in group.items"
              :key="item.routeName"
              :to="{ name: item.routeName }"
              :data-test="`nav-link-${item.routeName}`"
              class="rounded-lg px-2 py-1.5 text-sm font-medium"
              :class="
                route.name === item.routeName
                  ? 'bg-bz-gold-100 text-bz-gold-800'
                  : 'text-bz-ink-700 hover:bg-bz-ink-100'
              "
              @click="closeDrawer"
            >
              {{ item.label }}
            </RouterLink>
          </div>
        </div>
      </nav>

      <button
        type="button"
        data-test="sign-out"
        class="mt-6 w-full rounded-full border border-bz-border px-4 py-2 text-sm font-medium text-bz-ink-700"
        @click="onLogout"
      >
        Sign out
      </button>
    </aside>

    <main class="min-w-0 flex-1">
      <RouterView />
    </main>
  </div>
</template>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/admin-layout.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full frontend suite, typecheck, and lint**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all clean, all tests passing. (Note: `HomePlaceholder.vue`'s own "Sign out" button still exists at this point since it still renders at `admin.home` — that's expected until Task 6 removes it; it doesn't conflict with these tests since they navigate to `/admin/staff`, not `/admin`.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/layouts/AdminLayout.vue frontend/tests/admin-layout.test.ts
git commit -m "feat(frontend): add responsive admin nav shell with sidebar/drawer"
```

---

### Task 6: Live `DashboardView.vue`

**Files:**
- Create: `frontend/src/views/admin/DashboardView.vue`
- Delete: `frontend/src/views/admin/HomePlaceholder.vue`
- Modify: `frontend/src/router/index.ts` (swap `admin.home`'s component)
- Test: `frontend/tests/admin-dashboard-view.test.ts`

**Interfaces:**
- Consumes: `listStaffOrders()` from `../api/staff-orders` (returns `{ orders: SafeOrder[] }`), `listAdminPayments()` from Task 1, `listAdminProducts()` from Task 2, `useAuthStore()`.
- Produces: `DashboardView` component rendering four tiles with `data-test="tile-todays-orders"`, `data-test="tile-needs-attention"`, `data-test="tile-todays-revenue"`, `data-test="tile-low-stock"`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/tests/admin-dashboard-view.test.ts`:

```ts
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as staffOrdersApi from "../src/api/staff-orders";
import * as adminPaymentsApi from "../src/api/admin-payments";
import * as adminProductsApi from "../src/api/admin-products";
import DashboardView from "../src/views/admin/DashboardView.vue";
import { OrderPaymentStatus, OrderStatus, PaymentMethod, PaymentStatus } from "../src/types/enums";

function makeOrder(id: string, status: OrderStatus, createdAt: string) {
  return {
    id,
    orderNumber: `ORD-${id}`,
    billNumber: `BILL-${id}`,
    orderType: "DINE_IN",
    orderStatus: status,
    paymentStatus: OrderPaymentStatus.UNPAID,
    tableId: null,
    tableNumber: null,
    customerId: null,
    guestSessionId: null,
    customerName: null,
    customerPhone: null,
    subtotal: "0.00",
    taxAmount: "0.00",
    serviceChargeAmount: "0.00",
    discountAmount: "0.00",
    totalAmount: "0.00",
    paidAmount: "0.00",
    remainingAmount: "0.00",
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
    createdAt,
    updatedAt: createdAt,
  } as never;
}

function makePayment(id: string, amount: string, status: string, createdAt: string, voidedAt: string | null = null) {
  return {
    id,
    paymentNumber: `PAY-${id}`,
    orderId: "o1",
    amount,
    method: PaymentMethod.CASH,
    status,
    reference: null,
    notes: null,
    paidAt: createdAt,
    voidedAt,
    voidReason: null,
    createdAt,
  } as never;
}

function makeProduct(id: string, availableQuantity: number, lowStockThreshold: number) {
  return {
    id,
    categoryId: "c1",
    categoryName: "Drinks",
    name: `Product ${id}`,
    slug: `product-${id}`,
    description: null,
    imagePath: null,
    price: "1.00",
    preparationMinutes: 5,
    stockQuantity: availableQuantity,
    reservedQuantity: 0,
    availableQuantity,
    lowStockThreshold,
    trackStock: true,
    isAvailable: true,
    displayOrder: 0,
    createdAt: "2026-07-21T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z",
  } as never;
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-21T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("admin DashboardView", () => {
  it("computes and renders all four stat tiles from fetched data", async () => {
    vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({
      orders: [
        makeOrder("o1", OrderStatus.PENDING, "2026-07-21T09:00:00.000Z"),
        makeOrder("o2", OrderStatus.ACCEPTED, "2026-07-20T09:00:00.000Z"),
        makeOrder("o3", OrderStatus.COMPLETED, "2026-07-21T10:00:00.000Z"),
      ],
    });
    vi.spyOn(adminPaymentsApi, "listAdminPayments").mockResolvedValue({
      payments: [
        makePayment("p1", "50.00", PaymentStatus.COMPLETED, "2026-07-21T09:30:00.000Z"),
        makePayment("p2", "20.00", PaymentStatus.COMPLETED, "2026-07-20T09:30:00.000Z"),
        makePayment("p3", "15.00", PaymentStatus.COMPLETED, "2026-07-21T09:45:00.000Z", "2026-07-21T09:50:00.000Z"),
      ],
    });
    vi.spyOn(adminProductsApi, "listAdminProducts").mockResolvedValue({
      products: [makeProduct("prod1", 2, 5), makeProduct("prod2", 10, 5), makeProduct("prod3", 5, 5)],
    });

    const wrapper = mount(DashboardView);
    await flushPromises();

    // 2 orders created today (o1, o3) — o2 was yesterday.
    expect(wrapper.get('[data-test="tile-todays-orders"]').text()).toContain("2");
    // PENDING (o1) + ACCEPTED (o2) = 2, regardless of date.
    expect(wrapper.get('[data-test="tile-needs-attention"]').text()).toContain("2");
    // Only p1 is COMPLETED, not voided, and created today: 50.00. p2 is yesterday, p3 is voided.
    expect(wrapper.get('[data-test="tile-todays-revenue"]').text()).toContain("50.00");
    // prod1 (2 <= 5) and prod3 (5 <= 5, exactly at threshold) count as low stock; prod2 (10 <= 5 is false) does not.
    expect(wrapper.get('[data-test="tile-low-stock"]').text()).toContain("2");
  });

  it("shows an error state and retries all three fetches on retry click", async () => {
    const ordersSpy = vi
      .spyOn(staffOrdersApi, "listStaffOrders")
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ orders: [] });
    vi.spyOn(adminPaymentsApi, "listAdminPayments").mockResolvedValue({ payments: [] });
    vi.spyOn(adminProductsApi, "listAdminProducts").mockResolvedValue({ products: [] });

    const wrapper = mount(DashboardView);
    await flushPromises();

    expect(wrapper.text()).toContain("Couldn't reach the server");

    await wrapper.get("button").trigger("click");
    await flushPromises();

    expect(ordersSpy).toHaveBeenCalledTimes(2);
    expect(wrapper.get('[data-test="tile-todays-orders"]').text()).toContain("0");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/admin-dashboard-view.test.ts`
Expected: FAIL — `Cannot find module '../src/views/admin/DashboardView.vue'`.

- [ ] **Step 3: Create `frontend/src/views/admin/DashboardView.vue`**

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import ErrorState from "../../components/feedback/ErrorState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import { listAdminPayments } from "../../api/admin-payments";
import { listAdminProducts } from "../../api/admin-products";
import { listStaffOrders } from "../../api/staff-orders";
import { useAuthStore } from "../../stores/auth.store";
import { OrderStatus, PaymentStatus } from "../../types/enums";
import type { SafeOrder } from "../../types/order";
import type { SafePayment } from "../../types/payment";
import type { SafeProduct } from "../../types/product";
import { toUserSafeErrorMessage } from "../../utils/error-message";

const authStore = useAuthStore();

const loading = ref(true);
const loadError = ref<string | null>(null);
const orders = ref<SafeOrder[]>([]);
const payments = ref<SafePayment[]>([]);
const products = ref<SafeProduct[]>([]);

function isToday(isoDate: string): boolean {
  const date = new Date(isoDate);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

const todaysOrderCount = computed(() => orders.value.filter((order) => isToday(order.createdAt)).length);

const needsAttentionCount = computed(
  () =>
    orders.value.filter(
      (order) => order.orderStatus === OrderStatus.PENDING || order.orderStatus === OrderStatus.ACCEPTED,
    ).length,
);

const todaysRevenue = computed(() =>
  payments.value
    .filter(
      (payment) =>
        payment.status === PaymentStatus.COMPLETED && payment.voidedAt === null && isToday(payment.createdAt),
    )
    .reduce((sum, payment) => sum + Number(payment.amount), 0),
);

const lowStockCount = computed(
  () => products.value.filter((product) => product.availableQuantity <= product.lowStockThreshold).length,
);

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    const [ordersResult, paymentsResult, productsResult] = await Promise.all([
      listStaffOrders(),
      listAdminPayments(),
      listAdminProducts(),
    ]);
    orders.value = ordersResult.orders;
    payments.value = paymentsResult.payments;
    products.value = productsResult.products;
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
    <h1 class="text-xl font-bold text-bz-ink-900">Dashboard</h1>
    <p class="mt-1 text-sm text-bz-ink-500">Signed in as {{ authStore.user?.name }} ({{ authStore.role }}).</p>

    <LoadingState v-if="loading" label="Loading dashboard..." />
    <ErrorState v-else-if="loadError" :message="loadError" @retry="load" />

    <div v-else class="mt-4 grid grid-cols-2 gap-3">
      <div class="rounded-2xl border border-bz-border bg-white p-4" data-test="tile-todays-orders">
        <p class="text-xs uppercase tracking-wide text-bz-ink-500">Today's Orders</p>
        <p class="mt-1 text-2xl font-bold text-bz-ink-900">{{ todaysOrderCount }}</p>
      </div>
      <div class="rounded-2xl border border-bz-border bg-white p-4" data-test="tile-needs-attention">
        <p class="text-xs uppercase tracking-wide text-bz-ink-500">Needs Attention</p>
        <p class="mt-1 text-2xl font-bold text-bz-ink-900">{{ needsAttentionCount }}</p>
      </div>
      <div class="rounded-2xl border border-bz-border bg-white p-4" data-test="tile-todays-revenue">
        <p class="text-xs uppercase tracking-wide text-bz-ink-500">Today's Revenue</p>
        <p class="mt-1 text-2xl font-bold text-bz-ink-900">{{ todaysRevenue.toFixed(2) }}</p>
      </div>
      <div class="rounded-2xl border border-bz-border bg-white p-4" data-test="tile-low-stock">
        <p class="text-xs uppercase tracking-wide text-bz-ink-500">Low Stock</p>
        <p class="mt-1 text-2xl font-bold text-bz-ink-900">{{ lowStockCount }}</p>
      </div>
    </div>
  </main>
</template>
```

- [ ] **Step 4: Wire it into the router and delete the old placeholder**

In `frontend/src/router/index.ts`, find:

```ts
        {
          path: "",
          name: "admin.home",
          component: () => import("../views/admin/HomePlaceholder.vue"),
          meta: { role: "ADMIN" },
        },
```

Replace with:

```ts
        {
          path: "",
          name: "admin.home",
          component: () => import("../views/admin/DashboardView.vue"),
          meta: { role: "ADMIN" },
        },
```

Delete `frontend/src/views/admin/HomePlaceholder.vue`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/admin-dashboard-view.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the full frontend suite, typecheck, and lint**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all clean, all tests passing. (`admin-layout.test.ts`'s tests still pass since they navigate to `/admin/staff`, not `/admin` — unaffected by the `admin.home` component swap.)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/views/admin/DashboardView.vue frontend/src/router/index.ts frontend/tests/admin-dashboard-view.test.ts
git rm frontend/src/views/admin/HomePlaceholder.vue
git commit -m "feat(frontend): add live admin dashboard with orders/revenue/low-stock tiles"
```

---

### Task 7: Final regression pass

**Files:** none created — verification only.

- [ ] **Step 1: Run the full frontend suite**

Run (from `frontend/`): `npm run typecheck && npm run lint && npm run test`
Expected: all clean, all tests passing (105 from before this plan, plus this plan's own 1 + 1 + 1 + 2 (router) + 4 + 2 = 11 new tests — 116 total; exact count may differ slightly if the pre-existing suite size has changed, but zero failures is the requirement).

- [ ] **Step 2: Confirm no backend changes were made**

Run: `git diff --stat main -- backend/src/ backend/prisma/`
Expected: no output. This plan is frontend-only.

- [ ] **Step 3: Manually sanity-check the nav shell**

Run: `cd frontend && npm run dev`, log in as an admin (`admin@bazm.local` / `password` per `docs/README.md`), and confirm:
- All 12 nav links are visible and clickable on desktop width.
- Resizing below 768px hides the sidebar behind a "Menu" button; clicking it opens the drawer; clicking a link or the backdrop closes it.
- The dashboard shows four tiles with real numbers (not stuck on "Loading...").
- Each placeholder module route shows its title and "Coming soon."

- [ ] **Step 4: Commit (if the above surfaced any fix)**

Only if Step 1, 2, or 3 found something to correct — otherwise no commit needed for this task.

---

## Self-Review

**Spec coverage:** responsive sidebar/drawer nav shell ✅ (Task 5); all 11 module routes + dashboard route, all under `/admin`, `role: ADMIN` ✅ (Task 4, Task 6); reusable `ComingSoonView` instead of 9+ stub files ✅ (Task 3); four dashboard tiles with the confirmed definitions (today's orders, needs-attention, today's revenue, low stock via `availableQuantity <= lowStockThreshold`) ✅ (Task 6); new `admin-payments`/`admin-products` wrappers, no backend changes ✅ (Tasks 1–2); loading/error/retry pattern matching `staff/SettingsView.vue` ✅ (Task 6); active-link highlight ✅ (Task 5); sign-out moved into the shell ✅ (Task 5).

**Placeholder scan:** no TBD/TODO, no "similar to Task N" without code — every step has complete runnable code, including all 11 route objects spelled out in full in Task 4 (not abbreviated).

**Type consistency:** `SafePayment` (Task 1) fields match exactly what `DashboardView.vue` (Task 6) reads (`amount`, `status`, `voidedAt`, `createdAt`). `SafeProduct`'s existing `availableQuantity`/`lowStockThreshold` (used as-is, no new type needed) match Task 6's low-stock computation. `listAdminPayments`/`listAdminProducts`/`listStaffOrders` return shapes (`{ payments }`/`{ products }`/`{ orders }`) match exactly how Task 6 destructures them. Route names used in Task 5's `NAV_GROUPS` match exactly the route names defined in Task 4 and the pre-existing `admin.home`.

**Scope check:** frontend-only, 7 right-sized tasks, each independently testable and committed. No module CRUD screens are implied or half-built — every placeholder route explicitly renders "Coming soon."

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-21-admin-nav-shell-dashboard.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.
