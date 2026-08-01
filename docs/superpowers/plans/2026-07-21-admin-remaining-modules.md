# Admin Remaining Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 11 remaining "Coming soon" admin placeholders (Staff, Customers, Tables/QR, Categories, Products, Stock, Media, Settings, Orders, Cancellations, Payments) with real, working screens backed by the already-complete backend APIs.

**Architecture:** Module-level tasks (not per-file) given the scale — each task builds one full module (types + API wrapper + view + tests) and swaps its route from `ComingSoonView` to the real component. A shared `AdminFormDialog.vue` (Task 1) is used by every create/edit form. Tasks are ordered so later tasks can reuse earlier ones' API wrappers (Products needs Categories' list call; Stock needs Products; Cancellations/Orders share `staff-orders.ts`).

**Tech Stack:** Vue 3 (`<script setup lang="ts">`), Vue Router, Pinia, Tailwind CSS (existing `bz-*` tokens), Vitest + @vue/test-utils. One backend addition: a media list endpoint (Express + existing media service patterns).

**Design spec:** `docs/superpowers/specs/2026-07-21-admin-remaining-modules-design.md`

## Global Constraints

- Every module's routes/payloads/response shapes below were confirmed against the actual backend source (routes, validation schemas, service files) — treat them as exact, not illustrative.
- Frontend tests: flat files in `frontend/tests/`, named `admin-<module>-*.test.ts`, following existing mount/mock conventions (see `frontend/tests/admin-dashboard-view.test.ts`, `frontend/tests/staff-order-detail.test.ts`).
- Types: new files in `frontend/src/types/`, `Safe*` shapes with dates as `string` (matches every existing type file).
- API wrappers: new/extended files in `frontend/src/api/`, all via `authHttp` from `./http`, thin pass-through functions only (see `frontend/src/api/admin-payments.ts` as the template for a brand-new wrapper file).
- No new Tailwind colors — use only tokens already in `frontend/src/styles/tokens.css`.
- Each task: run `npm run typecheck && npm run lint && npm run test` (from `frontend/`, and `backend/` for Task 9's backend half) before committing; all clean.
- Router changes: swap the named route's `component:` from `() => import("../views/admin/ComingSoonView.vue")` to the real view, and delete its `props: () => ({ title: ... })` line (no longer needed).

---

### Task 1: Shared `AdminFormDialog.vue` + Settings screen

**Files:**
- Create: `frontend/src/components/feedback/AdminFormDialog.vue`
- Create: `frontend/tests/admin-form-dialog.test.ts`
- Modify: `frontend/src/api/settings.ts` (add `updateSettings`)
- Modify: `frontend/src/views/admin/SettingsView.vue` — **create this file** (doesn't exist yet)
- Modify: `frontend/src/router/index.ts` (swap `admin.settings`)
- Create: `frontend/tests/admin-settings-view.test.ts`

**Interfaces produced:**
- `AdminFormDialog` props: `{ open: boolean; title: string; saving?: boolean (default false); saveLabel?: string (default "Save"); cancelLabel?: string (default "Cancel"); error?: string | null (default null) }`. Emits: `save: []`, `cancel: []`. Default slot renders form field markup between the title and the error/buttons row.
- `updateSettings(input: { taxRatePercent?: number; serviceChargePercent?: number }): Promise<{ settings: CafeSettings }>` calling `PATCH /settings`.

- [ ] **Step 1: Write the failing test for `AdminFormDialog`**

```ts
// frontend/tests/admin-form-dialog.test.ts
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import AdminFormDialog from "../src/components/feedback/AdminFormDialog.vue";

describe("AdminFormDialog", () => {
  it("renders the title, slot content, and emits save/cancel", async () => {
    const wrapper = mount(AdminFormDialog, {
      props: { open: true, title: "Edit Thing" },
      slots: { default: "<input data-test='field' />" },
    });

    expect(wrapper.text()).toContain("Edit Thing");
    expect(wrapper.find("[data-test='field']").exists()).toBe(true);

    await wrapper.find('[data-test="dialog-save"]').trigger("click");
    expect(wrapper.emitted("save")).toHaveLength(1);

    await wrapper.find('[data-test="dialog-cancel"]').trigger("click");
    expect(wrapper.emitted("cancel")).toHaveLength(1);
  });

  it("shows the error message and disables save while saving", () => {
    const wrapper = mount(AdminFormDialog, {
      props: { open: true, title: "Edit Thing", saving: true, error: "Something broke" },
    });

    expect(wrapper.text()).toContain("Something broke");
    expect(wrapper.text()).toContain("Saving...");
    expect(wrapper.find('[data-test="dialog-save"]').attributes("disabled")).toBeDefined();
  });

  it("renders nothing when closed", () => {
    const wrapper = mount(AdminFormDialog, { props: { open: false, title: "Edit Thing" } });
    expect(wrapper.text()).not.toContain("Edit Thing");
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/admin-form-dialog.test.ts` from `frontend/`. Expected: FAIL, component doesn't exist.

- [ ] **Step 3: Create `AdminFormDialog.vue`**

```vue
<script setup lang="ts">
withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    saving?: boolean;
    saveLabel?: string;
    cancelLabel?: string;
    error?: string | null;
  }>(),
  { saving: false, saveLabel: "Save", cancelLabel: "Cancel", error: null },
);

const emit = defineEmits<{ save: []; cancel: [] }>();
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
    @click.self="emit('cancel')"
  >
    <div class="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-bz-lg sm:rounded-2xl">
      <h2 class="text-base font-semibold text-bz-ink-900">{{ title }}</h2>
      <div class="mt-4 space-y-3">
        <slot />
      </div>
      <p v-if="error" class="mt-3 rounded-xl bg-bz-red-tint px-3 py-2 text-sm text-bz-red">{{ error }}</p>
      <div class="mt-5 flex gap-3">
        <button
          type="button"
          data-test="dialog-cancel"
          class="flex-1 rounded-full border border-bz-border py-2.5 text-sm font-medium text-bz-ink-700"
          @click="emit('cancel')"
        >
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          data-test="dialog-save"
          class="flex-1 rounded-full bg-bz-gold-600 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          :disabled="saving"
          @click="emit('save')"
        >
          {{ saving ? "Saving..." : saveLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Run to verify it passes** — same command, expect PASS (3 tests).

- [ ] **Step 5: Write the failing test for the admin Settings view**

```ts
// frontend/tests/admin-settings-view.test.ts
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as settingsApi from "../src/api/settings";
import SettingsView from "../src/views/admin/SettingsView.vue";

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("admin SettingsView", () => {
  it("loads current rates and saves updated ones", async () => {
    vi.spyOn(settingsApi, "getSettings").mockResolvedValue({
      settings: { taxRatePercent: "5.00", serviceChargePercent: "10.00" },
    });
    const updateSpy = vi.spyOn(settingsApi, "updateSettings").mockResolvedValue({
      settings: { taxRatePercent: "7.50", serviceChargePercent: "10.00" },
    });

    const wrapper = mount(SettingsView);
    await flushPromises();

    const taxInput = wrapper.get('[data-test="tax-rate"]');
    await taxInput.setValue("7.5");
    await wrapper.get('[data-test="save"]').trigger("click");
    await flushPromises();

    expect(updateSpy).toHaveBeenCalledWith({ taxRatePercent: 7.5, serviceChargePercent: 10 });
    expect(wrapper.text()).toContain("Saved");
  });

  it("shows an error message if saving fails", async () => {
    vi.spyOn(settingsApi, "getSettings").mockResolvedValue({
      settings: { taxRatePercent: "5.00", serviceChargePercent: "10.00" },
    });
    vi.spyOn(settingsApi, "updateSettings").mockRejectedValue(new Error("network down"));

    const wrapper = mount(SettingsView);
    await flushPromises();

    await wrapper.get('[data-test="save"]').trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Couldn't reach the server");
  });
});
```

- [ ] **Step 6: Run to verify it fails** — expect FAIL (no `SettingsView.vue` under `views/admin/`, no `updateSettings` export).

- [ ] **Step 7: Add `updateSettings` to `frontend/src/api/settings.ts`**

```ts
import { authHttp } from "./http";
import type { CafeSettings } from "../types/settings";

export function getSettings() {
  return authHttp.get<{ settings: CafeSettings }>("/settings");
}

export function updateSettings(input: { taxRatePercent?: number; serviceChargePercent?: number }) {
  return authHttp.patch<{ settings: CafeSettings }>("/settings", input);
}
```

- [ ] **Step 8: Create `frontend/src/views/admin/SettingsView.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from "vue";

import ErrorState from "../../components/feedback/ErrorState.vue";
import LoadingState from "../../components/feedback/LoadingState.vue";
import { getSettings, updateSettings } from "../../api/settings";
import { toUserSafeErrorMessage } from "../../utils/error-message";

const loading = ref(true);
const loadError = ref<string | null>(null);
const saving = ref(false);
const saveError = ref<string | null>(null);
const saved = ref(false);

const taxRatePercent = ref("");
const serviceChargePercent = ref("");

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    const result = await getSettings();
    taxRatePercent.value = result.settings.taxRatePercent;
    serviceChargePercent.value = result.settings.serviceChargePercent;
  } catch (caught) {
    loadError.value = toUserSafeErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

async function save(): Promise<void> {
  saving.value = true;
  saveError.value = null;
  saved.value = false;
  try {
    const result = await updateSettings({
      taxRatePercent: Number(taxRatePercent.value),
      serviceChargePercent: Number(serviceChargePercent.value),
    });
    taxRatePercent.value = result.settings.taxRatePercent;
    serviceChargePercent.value = result.settings.serviceChargePercent;
    saved.value = true;
  } catch (caught) {
    saveError.value = toUserSafeErrorMessage(caught);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <main class="flex min-h-dvh flex-col px-5 py-6">
    <h1 class="text-xl font-bold text-bz-ink-900">Café Settings</h1>

    <LoadingState v-if="loading" label="Loading settings..." />
    <ErrorState v-else-if="loadError" :message="loadError" @retry="load" />

    <div v-else class="mt-4 space-y-4 rounded-2xl border border-bz-border bg-white p-4">
      <div>
        <label class="text-xs font-medium text-bz-ink-500">Tax rate (%)</label>
        <input
          v-model="taxRatePercent"
          data-test="tax-rate"
          type="number"
          min="0"
          max="100"
          step="0.01"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        />
      </div>
      <div>
        <label class="text-xs font-medium text-bz-ink-500">Service charge (%)</label>
        <input
          v-model="serviceChargePercent"
          data-test="service-charge"
          type="number"
          min="0"
          max="100"
          step="0.01"
          class="mt-1 w-full rounded-xl border border-bz-border px-3 py-2 text-sm outline-none focus:border-bz-gold-500"
        />
      </div>

      <p v-if="saveError" class="rounded-xl bg-bz-red-tint px-3 py-2 text-sm text-bz-red">{{ saveError }}</p>
      <p v-if="saved" class="rounded-xl bg-bz-green-tint px-3 py-2 text-sm text-bz-green">Saved.</p>

      <button
        type="button"
        data-test="save"
        class="w-full rounded-full bg-bz-gold-600 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        :disabled="saving"
        @click="save"
      >
        {{ saving ? "Saving..." : "Save changes" }}
      </button>
    </div>
  </main>
</template>
```

- [ ] **Step 9: Wire the router.** In `frontend/src/router/index.ts`, find the `admin.settings` route and replace:

```ts
        {
          path: "settings",
          name: "admin.settings",
          component: () => import("../views/admin/ComingSoonView.vue"),
          props: () => ({ title: "Settings" }),
          meta: { role: "ADMIN" },
        },
```

with:

```ts
        {
          path: "settings",
          name: "admin.settings",
          component: () => import("../views/admin/SettingsView.vue"),
          meta: { role: "ADMIN" },
        },
```

- [ ] **Step 10: Run all new tests, then full suite, typecheck, lint**

```bash
npx vitest run tests/admin-form-dialog.test.ts tests/admin-settings-view.test.ts
npm run typecheck && npm run lint && npm run test
```

- [ ] **Step 11: Commit**

```bash
git add frontend/src/components/feedback/AdminFormDialog.vue frontend/src/views/admin/SettingsView.vue frontend/src/api/settings.ts frontend/src/router/index.ts frontend/tests/admin-form-dialog.test.ts frontend/tests/admin-settings-view.test.ts
git commit -m "feat(frontend): add AdminFormDialog shared component and live admin settings screen"
```

---

### Task 2: Staff management (`admin.staff`)

**Files:**
- Create: `frontend/src/types/staff.ts`
- Create: `frontend/src/api/admin-staff.ts`
- Create: `frontend/src/views/admin/StaffView.vue`
- Modify: `frontend/src/router/index.ts`
- Create: `frontend/tests/admin-staff-view.test.ts`, `frontend/tests/api-admin-staff.test.ts`

**Backend contract (confirmed):**
- `GET /staff?search=&isActive=` → `{ staff: SafeStaff[] }`
- `GET /staff/:id` → `{ staff: SafeStaff }`
- `POST /staff` body `{ name, email, phone?, password, imagePath? }` → `{ staff: SafeStaff }`
- `PATCH /staff/:id` body (all optional) `{ name?, email?, phone?, imagePath? }` → `{ staff: SafeStaff }`
- `PATCH /staff/:id/status` body `{ isActive: boolean }` → `{ staff: SafeStaff }`
- `PATCH /staff/:id/password` body `{ password: string }` → `{ staff: SafeStaff }`
- `SafeStaff`: `{ id: string; name: string; email: string; phone: string | null; imagePath: string | null; imageUrl: string | null; role: "STAFF"; isActive: boolean; lastLoginAt: string | null; createdAt: string; updatedAt: string }`

- [ ] **Step 1: Write `frontend/src/types/staff.ts`**

```ts
export type SafeStaff = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  role: "STAFF";
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateStaffInput = { name: string; email: string; phone?: string; password: string; imagePath?: string };
export type UpdateStaffInput = { name?: string; email?: string; phone?: string | null; imagePath?: string | null };
```

- [ ] **Step 2: Write the failing API test**

```ts
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
```

- [ ] **Step 3: Run to verify it fails** — `npx vitest run tests/api-admin-staff.test.ts`. Expected: FAIL, module missing.

- [ ] **Step 4: Create `frontend/src/api/admin-staff.ts`**

```ts
import { authHttp } from "./http";
import type { CreateStaffInput, SafeStaff, UpdateStaffInput } from "../types/staff";

export type ListStaffQuery = { search?: string; isActive?: boolean };

function buildQuery(query?: ListStaffQuery): string {
  if (!query) return "";
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.isActive !== undefined) params.set("isActive", String(query.isActive));
  const built = params.toString();
  return built ? `?${built}` : "";
}

export function listStaff(query?: ListStaffQuery) {
  return authHttp.get<{ staff: SafeStaff[] }>(`/staff${buildQuery(query)}`);
}

export function getStaffMember(staffId: string) {
  return authHttp.get<{ staff: SafeStaff }>(`/staff/${staffId}`);
}

export function createStaff(input: CreateStaffInput) {
  return authHttp.post<{ staff: SafeStaff }>("/staff", input);
}

export function updateStaff(staffId: string, input: UpdateStaffInput) {
  return authHttp.patch<{ staff: SafeStaff }>(`/staff/${staffId}`, input);
}

export function updateStaffStatus(staffId: string, isActive: boolean) {
  return authHttp.patch<{ staff: SafeStaff }>(`/staff/${staffId}/status`, { isActive });
}

export function updateStaffPassword(staffId: string, password: string) {
  return authHttp.patch<{ staff: SafeStaff }>(`/staff/${staffId}/password`, { password });
}
```

- [ ] **Step 5: Run to verify it passes** — expect PASS (5 tests).

- [ ] **Step 6: Write the failing view test**

```ts
// frontend/tests/admin-staff-view.test.ts
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as adminStaffApi from "../src/api/admin-staff";
import StaffView from "../src/views/admin/StaffView.vue";
import type { SafeStaff } from "../src/types/staff";

function makeStaff(overrides: Partial<SafeStaff> = {}): SafeStaff {
  return {
    id: "s1",
    name: "Ada Staff",
    email: "ada@bazm.test",
    phone: null,
    imagePath: null,
    imageUrl: null,
    role: "STAFF",
    isActive: true,
    lastLoginAt: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("admin StaffView", () => {
  it("loads and renders the staff list", async () => {
    vi.spyOn(adminStaffApi, "listStaff").mockResolvedValue({ staff: [makeStaff()] });

    const wrapper = mount(StaffView);
    await flushPromises();

    expect(wrapper.text()).toContain("Ada Staff");
  });

  it("creates a new staff member via the dialog", async () => {
    vi.spyOn(adminStaffApi, "listStaff").mockResolvedValue({ staff: [] });
    const createSpy = vi.spyOn(adminStaffApi, "createStaff").mockResolvedValue({ staff: makeStaff() });

    const wrapper = mount(StaffView);
    await flushPromises();

    await wrapper.get('[data-test="new-staff"]').trigger("click");
    await wrapper.get('[data-test="field-name"]').setValue("Ada Staff");
    await wrapper.get('[data-test="field-email"]').setValue("ada@bazm.test");
    await wrapper.get('[data-test="field-password"]').setValue("Password1");
    await wrapper.get('[data-test="dialog-save"]').trigger("click");
    await flushPromises();

    expect(createSpy).toHaveBeenCalledWith({ name: "Ada Staff", email: "ada@bazm.test", password: "Password1" });
  });

  it("toggles a staff member's active status", async () => {
    vi.spyOn(adminStaffApi, "listStaff").mockResolvedValue({ staff: [makeStaff({ isActive: true })] });
    const statusSpy = vi
      .spyOn(adminStaffApi, "updateStaffStatus")
      .mockResolvedValue({ staff: makeStaff({ isActive: false }) });

    const wrapper = mount(StaffView);
    await flushPromises();

    await wrapper.get('[data-test="toggle-active-s1"]').trigger("click");
    await flushPromises();

    expect(statusSpy).toHaveBeenCalledWith("s1", false);
  });
});
```

- [ ] **Step 7: Run to verify it fails** — expect FAIL (`StaffView.vue` missing).

- [ ] **Step 8: Create `frontend/src/views/admin/StaffView.vue`**

Structure: header with search input (`data-test="search"`) + "+ New Staff" button (`data-test="new-staff"`); `LoadingState`/`ErrorState`/`EmptyState` per convention; list of staff cards (name, email, phone, active/inactive badge, "Deactivate"/"Activate" button `data-test="toggle-active-<id>"`, "Edit" button, "Reset Password" button); `AdminFormDialog` (from Task 1) for create/edit with fields `data-test="field-name"`, `data-test="field-email"`, `data-test="field-phone"`, `data-test="field-password"` (create only), save button `data-test="dialog-save"`; a second small `AdminFormDialog` for password reset with `data-test="field-new-password"`. On search input change, debounce-free refetch via `listStaff({ search })`. Follow the loading/error/list structure of `frontend/src/views/staff/OrderQueueView.vue` for the list-rendering shape, and `frontend/src/components/feedback/ActionConfirmationDialog.vue`'s usage pattern (open/cancel/confirm ref flow) for how dialogs are toggled open via a `ref<boolean>`.

- [ ] **Step 9: Run to verify it passes** — expect PASS (3 tests).

- [ ] **Step 10: Wire the router** — swap `admin.staff`'s component to `StaffView.vue`, remove its `props`.

- [ ] **Step 11: Run full suite, typecheck, lint. Commit.**

```bash
git add frontend/src/types/staff.ts frontend/src/api/admin-staff.ts frontend/src/views/admin/StaffView.vue frontend/src/router/index.ts frontend/tests/api-admin-staff.test.ts frontend/tests/admin-staff-view.test.ts
git commit -m "feat(frontend): add admin staff management screen"
```

---

### Task 3: Customers management (`admin.customers`)

**Files:**
- Modify: `frontend/src/api/staff-customers.ts` (add `getCustomerRecord`, `createCustomerRecord`, `updateCustomerRecord`)
- Create: `frontend/src/views/admin/CustomersView.vue`
- Modify: `frontend/src/router/index.ts`
- Create: `frontend/tests/admin-customers-view.test.ts`, extend `frontend/tests/api-staff.test.ts` (check if this file covers `staff-customers.ts`; if not, create `frontend/tests/api-staff-customers.test.ts`)

**Backend contract:**
- `GET /customers/:id` → `{ customer: CustomerDetail }` where `CustomerDetail = SafeCustomer & { summary: { orderCount: number; unpaidOrderCount: number; partiallyPaidOrderCount: number; outstandingBalance: string } }`
- `POST /customers` body `{ name, phone?, imagePath? }` → `{ customer: SafeCustomer; matchedByPhone: SafeCustomer[] }`
- `PATCH /customers/:id` body (optional) `{ name?, phone?, imagePath? }` → `{ customer: SafeCustomer }`
- `frontend/src/types/customer.ts` already has `SafeCustomer`, `CustomerFinancialSummary`, `CustomerDetail` — reuse, do not redefine.

- [ ] **Step 1: Write the failing test for the new API functions**

Create `frontend/tests/api-staff-customers.test.ts` (check first if `frontend/tests/api-staff.test.ts` already tests `staff-customers.ts`'s `searchCustomers` — if so, add these cases to that file instead of creating a new one; use whichever file already covers this module):

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { createCustomerRecord, getCustomerRecord, updateCustomerRecord } from "../src/api/staff-customers";

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("customer record api", () => {
  it("getCustomerRecord fetches the detail with financial summary", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        message: "ok",
        data: { customer: { id: "c1", summary: { orderCount: 2, unpaidOrderCount: 1, partiallyPaidOrderCount: 0, outstandingBalance: "50.00" } } },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getCustomerRecord("c1");

    expect(result.customer.summary.outstandingBalance).toBe("50.00");
    expect(fetchMock.mock.calls[0][0]).toContain("/customers/c1");
  });

  it("createCustomerRecord posts name/phone and returns matchedByPhone", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, { success: true, message: "ok", data: { customer: { id: "c1" }, matchedByPhone: [] } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createCustomerRecord({ name: "Ali", phone: "03001234567" });

    expect(result.matchedByPhone).toEqual([]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/customers");
    expect(init.method).toBe("POST");
  });

  it("updateCustomerRecord patches the given fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { customer: { id: "c1" } } }));
    vi.stubGlobal("fetch", fetchMock);

    await updateCustomerRecord("c1", { name: "Ali B" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/customers/c1");
    expect(init.method).toBe("PATCH");
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Add the three functions to `frontend/src/api/staff-customers.ts`** (append, do not remove `searchCustomers`)

```ts
import type { CustomerDetail, SafeCustomer } from "../types/customer";

export type CreateCustomerInput = { name: string; phone?: string; imagePath?: string };
export type UpdateCustomerInput = { name?: string; phone?: string | null; imagePath?: string | null };

export function getCustomerRecord(customerId: string) {
  return authHttp.get<{ customer: CustomerDetail }>(`/customers/${customerId}`);
}

export function createCustomerRecord(input: CreateCustomerInput) {
  return authHttp.post<{ customer: SafeCustomer; matchedByPhone: SafeCustomer[] }>("/customers", input);
}

export function updateCustomerRecord(customerId: string, input: UpdateCustomerInput) {
  return authHttp.patch<{ customer: SafeCustomer }>(`/customers/${customerId}`, input);
}
```

(Add the `CustomerDetail` import to the existing top-of-file import from `../types/customer`, alongside `SafeCustomer` already imported there.)

- [ ] **Step 4: Run to verify it passes.**

- [ ] **Step 5: Write the failing view test**

```ts
// frontend/tests/admin-customers-view.test.ts
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as customersApi from "../src/api/staff-customers";
import CustomersView from "../src/views/admin/CustomersView.vue";
import type { SafeCustomer } from "../src/types/customer";

function makeCustomer(overrides: Partial<SafeCustomer> = {}): SafeCustomer {
  return {
    id: "c1",
    name: "Ali Khan",
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

describe("admin CustomersView", () => {
  it("loads and renders the customer list", async () => {
    vi.spyOn(customersApi, "searchCustomers").mockResolvedValue({ customers: [makeCustomer()] });

    const wrapper = mount(CustomersView);
    await flushPromises();

    expect(wrapper.text()).toContain("Ali Khan");
  });

  it("shows financial summary when a customer is expanded", async () => {
    vi.spyOn(customersApi, "searchCustomers").mockResolvedValue({ customers: [makeCustomer()] });
    vi.spyOn(customersApi, "getCustomerRecord").mockResolvedValue({
      customer: { ...makeCustomer(), summary: { orderCount: 3, unpaidOrderCount: 1, partiallyPaidOrderCount: 0, outstandingBalance: "75.00" } },
    });

    const wrapper = mount(CustomersView);
    await flushPromises();

    await wrapper.get('[data-test="expand-c1"]').trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("75.00");
  });

  it("creates a new customer via the dialog", async () => {
    vi.spyOn(customersApi, "searchCustomers").mockResolvedValue({ customers: [] });
    const createSpy = vi
      .spyOn(customersApi, "createCustomerRecord")
      .mockResolvedValue({ customer: makeCustomer(), matchedByPhone: [] });

    const wrapper = mount(CustomersView);
    await flushPromises();

    await wrapper.get('[data-test="new-customer"]').trigger("click");
    await wrapper.get('[data-test="field-name"]').setValue("Ali Khan");
    await wrapper.get('[data-test="dialog-save"]').trigger("click");
    await flushPromises();

    expect(createSpy).toHaveBeenCalledWith({ name: "Ali Khan" });
  });
});
```

- [ ] **Step 6: Run to verify it fails.**

- [ ] **Step 7: Create `frontend/src/views/admin/CustomersView.vue`**

Search input (`data-test="search"`, calls `searchCustomers({ search })`) + "+ New Customer" (`data-test="new-customer"`); list of customer cards (name, phone) each with an "Expand" button `data-test="expand-<id>"` that lazily calls `getCustomerRecord(id)` and shows the summary fields (`orderCount`, `outstandingBalance`, etc.) inline when expanded; `AdminFormDialog` for create/edit with `data-test="field-name"`/`field-phone"`, save `data-test="dialog-save"`; on create, if `matchedByPhone.length > 0`, show a non-blocking warning message listing the possible duplicates (still keep the newly-created customer). Follow the same list/dialog structure as Task 2's `StaffView.vue`.

- [ ] **Step 8: Run to verify it passes.**

- [ ] **Step 9: Wire the router** — swap `admin.customers`.

- [ ] **Step 10: Full suite, typecheck, lint. Commit.**

```bash
git add frontend/src/api/staff-customers.ts frontend/src/views/admin/CustomersView.vue frontend/src/router/index.ts frontend/tests/api-staff-customers.test.ts frontend/tests/admin-customers-view.test.ts
git commit -m "feat(frontend): add admin customer management screen"
```

---

### Task 4: Tables & QR (`admin.tables`)

**Files:**
- Create: `frontend/src/types/table.ts`
- Create: `frontend/src/api/admin-tables.ts`
- Create: `frontend/src/views/admin/TablesView.vue`
- Modify: `frontend/src/router/index.ts`
- Create: `frontend/tests/admin-tables-view.test.ts`, `frontend/tests/api-admin-tables.test.ts`

**Backend contract:**
- `GET /tables` → `{ tables: SafeTable[] }`
- `GET /tables/:id` → `{ table: SafeTable }`
- `POST /tables` body `{ tableNumber, name?, capacity? }` → `{ table: SafeTable }`
- `PATCH /tables/:id` body (optional) `{ tableNumber?, name?, capacity? }` → `{ table: SafeTable }`
- `PATCH /tables/:id/status` body `{ operationalStatus: "AVAILABLE" | "OUT_OF_SERVICE"; isActive?: boolean }` → `{ table: SafeTable }`
- `GET /tables/:id/qr-code` → `{ tableId, tableNumber, qrVersion, qrImagePath, qrImageUrl, qrGeneratedAt, qrRegeneratedAt }`
- `POST /tables/:id/qr-code/regenerate` → `{ table: SafeTable }`
- `POST /tables/:id/release` → `{ table: SafeTable; receiptRawToken: string; receiptAccessExpiresAt: string }`
- `POST /tables/:id/force-release` body `{ reason: string }` → same shape as release
- `SafeTable`: `{ id: string; tableNumber: string; name: string | null; capacity: number; operationalStatus: "AVAILABLE" | "OUT_OF_SERVICE"; status: "AVAILABLE" | "OCCUPIED" | "OUT_OF_SERVICE"; isActive: boolean; qrVersion: number; qrImagePath: string | null; qrImageUrl: string | null; qrGeneratedAt: string; qrRegeneratedAt: string | null; createdAt: string; updatedAt: string }`

- [ ] **Step 1: Write `frontend/src/types/table.ts`**

```ts
export type TableOperationalStatus = "AVAILABLE" | "OUT_OF_SERVICE";
export type TableDerivedStatus = "AVAILABLE" | "OCCUPIED" | "OUT_OF_SERVICE";

export type SafeTable = {
  id: string;
  tableNumber: string;
  name: string | null;
  capacity: number;
  operationalStatus: TableOperationalStatus;
  status: TableDerivedStatus;
  isActive: boolean;
  qrVersion: number;
  qrImagePath: string | null;
  qrImageUrl: string | null;
  qrGeneratedAt: string;
  qrRegeneratedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateTableInput = { tableNumber: string; name?: string; capacity?: number };
export type UpdateTableInput = { tableNumber?: string; name?: string; capacity?: number };
```

- [ ] **Step 2: Write the failing API test**

```ts
// frontend/tests/api-admin-tables.test.ts
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
```

- [ ] **Step 3: Run to verify it fails.**

- [ ] **Step 4: Create `frontend/src/api/admin-tables.ts`**

```ts
import { authHttp } from "./http";
import type { CreateTableInput, SafeTable, TableOperationalStatus, UpdateTableInput } from "../types/table";

export function listTables() {
  return authHttp.get<{ tables: SafeTable[] }>("/tables");
}

export function getTable(tableId: string) {
  return authHttp.get<{ table: SafeTable }>(`/tables/${tableId}`);
}

export function createTable(input: CreateTableInput) {
  return authHttp.post<{ table: SafeTable }>("/tables", input);
}

export function updateTable(tableId: string, input: UpdateTableInput) {
  return authHttp.patch<{ table: SafeTable }>(`/tables/${tableId}`, input);
}

export function updateTableStatus(
  tableId: string,
  input: { operationalStatus: TableOperationalStatus; isActive?: boolean },
) {
  return authHttp.patch<{ table: SafeTable }>(`/tables/${tableId}/status`, input);
}

export function getTableQrCode(tableId: string) {
  return authHttp.get<{
    tableId: string;
    tableNumber: string;
    qrVersion: number;
    qrImagePath: string | null;
    qrImageUrl: string | null;
    qrGeneratedAt: string;
    qrRegeneratedAt: string | null;
  }>(`/tables/${tableId}/qr-code`);
}

export function regenerateTableQr(tableId: string) {
  return authHttp.post<{ table: SafeTable }>(`/tables/${tableId}/qr-code/regenerate`);
}

export function releaseTable(tableId: string) {
  return authHttp.post<{ table: SafeTable; receiptRawToken: string; receiptAccessExpiresAt: string }>(
    `/tables/${tableId}/release`,
  );
}

export function forceReleaseTable(tableId: string, reason: string) {
  return authHttp.post<{ table: SafeTable; receiptRawToken: string; receiptAccessExpiresAt: string }>(
    `/tables/${tableId}/force-release`,
    { reason },
  );
}
```

- [ ] **Step 5: Run to verify it passes.**

- [ ] **Step 6: Write the failing view test**

```ts
// frontend/tests/admin-tables-view.test.ts
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
```

- [ ] **Step 7: Run to verify it fails.**

- [ ] **Step 8: Create `frontend/src/views/admin/TablesView.vue`**

List of table cards (tableNumber, name, capacity, derived `status` badge) + "+ New Table" (`data-test="new-table"`) opening `AdminFormDialog` with `data-test="field-tableNumber"`/`"field-name"`/`"field-capacity"`; each card has "Edit", "View QR" (`data-test="view-qr-<id>"` — expands to show `<img data-test="qr-image" :src="table.qrImageUrl">` + "Regenerate" button `data-test="regenerate-qr"` calling `regenerateTableQr`), and a release control: "Release" (calls `releaseTable`, catches `SESSION_NOT_RELEASABLE` and offers "Force Release" which opens `ReasonConfirmationDialog` — its textarea has no `data-test` attribute, select it via `wrapper.find("textarea")`; its buttons are `data-test="cancel"` and `data-test="confirm"`). Status toggle available too (`updateTableStatus`). Follow `TablesView`'s list/dialog shape from the same pattern as Task 2.

- [ ] **Step 9: Run to verify it passes.**

- [ ] **Step 10: Wire the router** — swap `admin.tables`.

- [ ] **Step 11: Full suite, typecheck, lint. Commit.**

```bash
git add frontend/src/types/table.ts frontend/src/api/admin-tables.ts frontend/src/views/admin/TablesView.vue frontend/src/router/index.ts frontend/tests/api-admin-tables.test.ts frontend/tests/admin-tables-view.test.ts
git commit -m "feat(frontend): add admin tables and QR code management screen"
```

---

### Task 5: Categories (`admin.categories`)

**Files:**
- Create: `frontend/src/types/category.ts`
- Create: `frontend/src/api/admin-categories.ts`
- Create: `frontend/src/views/admin/CategoriesView.vue`
- Modify: `frontend/src/router/index.ts`
- Create: `frontend/tests/admin-categories-view.test.ts`, `frontend/tests/api-admin-categories.test.ts`

**Backend contract:**
- `GET /categories` → `{ categories: SafeCategory[] }`
- `GET /categories/:id` → `{ category: SafeCategory }`
- `POST /categories` body `{ name, description?, imagePath?, displayOrder? }` → `{ category: SafeCategory }`
- `PATCH /categories/:id` body (optional, ≥1 required) `{ name?, description?, imagePath?, displayOrder? }` → `{ category: SafeCategory }`
- `PATCH /categories/:id/status` body `{ isVisible: boolean }` → `{ category: SafeCategory }`
- `DELETE /categories/:id` → `{}` (may 409 with code `CATEGORY_HAS_PRODUCTS`)
- `SafeCategory`: `{ id: string; name: string; slug: string; description: string | null; imagePath: string | null; imageUrl: string | null; displayOrder: number; isVisible: boolean; createdAt: string; updatedAt: string }`

- [ ] **Step 1: Write `frontend/src/types/category.ts`**

```ts
export type SafeCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  displayOrder: number;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateCategoryInput = { name: string; description?: string; imagePath?: string; displayOrder?: number };
export type UpdateCategoryInput = { name?: string; description?: string; imagePath?: string; displayOrder?: number };
```

- [ ] **Step 2: Write the failing API test**

```ts
// frontend/tests/api-admin-categories.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
  updateCategoryStatus,
} from "../src/api/admin-categories";

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin categories api", () => {
  it("listCategories fetches all categories", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { categories: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    await listCategories();
    expect(fetchMock.mock.calls[0][0]).toContain("/categories");
  });

  it("createCategory posts the payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { success: true, message: "ok", data: { category: { id: "c1" } } }));
    vi.stubGlobal("fetch", fetchMock);
    await createCategory({ name: "Drinks" });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
  });

  it("updateCategory patches fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { category: { id: "c1" } } }));
    vi.stubGlobal("fetch", fetchMock);
    await updateCategory("c1", { name: "Beverages" });
    expect(fetchMock.mock.calls[0][0]).toContain("/categories/c1");
  });

  it("updateCategoryStatus toggles visibility", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { category: { id: "c1" } } }));
    vi.stubGlobal("fetch", fetchMock);
    await updateCategoryStatus("c1", false);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/categories/c1/status");
    expect(JSON.parse(init.body)).toEqual({ isVisible: false });
  });

  it("deleteCategory sends a DELETE request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok" }));
    vi.stubGlobal("fetch", fetchMock);
    await deleteCategory("c1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/categories/c1");
    expect(init.method).toBe("DELETE");
  });
});
```

- [ ] **Step 3: Run to verify it fails.**

- [ ] **Step 4: Create `frontend/src/api/admin-categories.ts`**

```ts
import { authHttp } from "./http";
import type { CreateCategoryInput, SafeCategory, UpdateCategoryInput } from "../types/category";

export function listCategories() {
  return authHttp.get<{ categories: SafeCategory[] }>("/categories");
}

export function getCategory(categoryId: string) {
  return authHttp.get<{ category: SafeCategory }>(`/categories/${categoryId}`);
}

export function createCategory(input: CreateCategoryInput) {
  return authHttp.post<{ category: SafeCategory }>("/categories", input);
}

export function updateCategory(categoryId: string, input: UpdateCategoryInput) {
  return authHttp.patch<{ category: SafeCategory }>(`/categories/${categoryId}`, input);
}

export function updateCategoryStatus(categoryId: string, isVisible: boolean) {
  return authHttp.patch<{ category: SafeCategory }>(`/categories/${categoryId}/status`, { isVisible });
}

export function deleteCategory(categoryId: string) {
  return authHttp.delete<Record<string, never>>(`/categories/${categoryId}`);
}
```

- [ ] **Step 5: Run to verify it passes.**

- [ ] **Step 6: Write the failing view test**

```ts
// frontend/tests/admin-categories-view.test.ts
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../src/api/http";
import * as categoriesApi from "../src/api/admin-categories";
import CategoriesView from "../src/views/admin/CategoriesView.vue";
import type { SafeCategory } from "../src/types/category";

function makeCategory(overrides: Partial<SafeCategory> = {}): SafeCategory {
  return {
    id: "cat1",
    name: "Drinks",
    slug: "drinks",
    description: null,
    imagePath: null,
    imageUrl: null,
    displayOrder: 0,
    isVisible: true,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("admin CategoriesView", () => {
  it("loads and renders the category list", async () => {
    vi.spyOn(categoriesApi, "listCategories").mockResolvedValue({ categories: [makeCategory()] });
    const wrapper = mount(CategoriesView);
    await flushPromises();
    expect(wrapper.text()).toContain("Drinks");
  });

  it("creates a category via the dialog", async () => {
    vi.spyOn(categoriesApi, "listCategories").mockResolvedValue({ categories: [] });
    const createSpy = vi.spyOn(categoriesApi, "createCategory").mockResolvedValue({ category: makeCategory() });

    const wrapper = mount(CategoriesView);
    await flushPromises();

    await wrapper.get('[data-test="new-category"]').trigger("click");
    await wrapper.get('[data-test="field-name"]').setValue("Drinks");
    await wrapper.get('[data-test="dialog-save"]').trigger("click");
    await flushPromises();

    expect(createSpy).toHaveBeenCalledWith({ name: "Drinks" });
  });

  it("toggles category visibility", async () => {
    vi.spyOn(categoriesApi, "listCategories").mockResolvedValue({ categories: [makeCategory({ isVisible: true })] });
    const statusSpy = vi
      .spyOn(categoriesApi, "updateCategoryStatus")
      .mockResolvedValue({ category: makeCategory({ isVisible: false }) });

    const wrapper = mount(CategoriesView);
    await flushPromises();

    await wrapper.get('[data-test="toggle-visible-cat1"]').trigger("click");
    await flushPromises();

    expect(statusSpy).toHaveBeenCalledWith("cat1", false);
  });

  it("surfaces the CATEGORY_HAS_PRODUCTS error plainly when delete is blocked", async () => {
    vi.spyOn(categoriesApi, "listCategories").mockResolvedValue({ categories: [makeCategory()] });
    vi.spyOn(categoriesApi, "deleteCategory").mockRejectedValue(
      new ApiError(409, "This category still has products.", { code: "CATEGORY_HAS_PRODUCTS" }),
    );

    const wrapper = mount(CategoriesView);
    await flushPromises();

    await wrapper.get('[data-test="delete-cat1"]').trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("This category still has products.");
  });
});
```

- [ ] **Step 7: Run to verify it fails.**

- [ ] **Step 8: Create `frontend/src/views/admin/CategoriesView.vue`**

List of category cards (name, description, visibility badge, displayOrder) + "+ New Category" (`data-test="new-category"`) opening `AdminFormDialog` with fields `data-test="field-name"`/`"field-description"`/`"field-displayOrder"` and an `ImageUploadField` (folder `"categories"`) bound to `imagePath`; per-card "Edit", visibility toggle `data-test="toggle-visible-<id>"`, "Delete" `data-test="delete-<id>"` — delete errors render via `toUserSafeErrorMessage` in a dismissible inline error banner (a 422/409 message shows verbatim per that util's behavior). Follow Task 2/4's list+dialog shape.

- [ ] **Step 9: Run to verify it passes.**

- [ ] **Step 10: Wire the router** — swap `admin.categories`.

- [ ] **Step 11: Full suite, typecheck, lint. Commit.**

```bash
git add frontend/src/types/category.ts frontend/src/api/admin-categories.ts frontend/src/views/admin/CategoriesView.vue frontend/src/router/index.ts frontend/tests/api-admin-categories.test.ts frontend/tests/admin-categories-view.test.ts
git commit -m "feat(frontend): add admin category management screen"
```

---

### Task 6: Products (`admin.products`)

**Files:**
- Modify: `frontend/src/api/admin-products.ts` (add create/update/status/delete — list already exists)
- Create: `frontend/src/views/admin/ProductsView.vue`
- Modify: `frontend/src/router/index.ts`
- Create: `frontend/tests/admin-products-view.test.ts`, extend `frontend/tests/api-admin-products.test.ts`

**Backend contract:**
- `GET /products/:id` → `{ product: SafeProduct }`
- `POST /products` body `{ categoryId, name, description?, imagePath?, price, preparationMinutes?, stockQuantity?, lowStockThreshold?, trackStock?, isAvailable?, displayOrder? }` → `{ product: SafeProduct }`
- `PATCH /products/:id` body (optional, ≥1) same minus `stockQuantity`/`isAvailable` → `{ product: SafeProduct }`
- `PATCH /products/:id/status` body `{ isAvailable: boolean }` → `{ product: SafeProduct }`
- `DELETE /products/:id` → `{}` (may 409 `PRODUCT_HAS_ORDER_ITEMS`)
- `SafeProduct` already fully defined in `frontend/src/types/product.ts` — reuse.

- [ ] **Step 1: Write the failing tests, appended to `frontend/tests/api-admin-products.test.ts`** (after the existing `listAdminProducts` test, inside the same `describe` block or a new one in the same file)

```ts
import { createProduct, deleteProduct, getAdminProduct, updateProduct, updateProductStatus } from "../src/api/admin-products";

// ...(add to the same file, following the existing jsonResponse helper already defined there)

describe("admin products api — mutations", () => {
  it("getAdminProduct fetches one product", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { product: { id: "p1" } } }));
    vi.stubGlobal("fetch", fetchMock);
    await getAdminProduct("p1");
    expect(fetchMock.mock.calls[0][0]).toContain("/products/p1");
  });

  it("createProduct posts the payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { success: true, message: "ok", data: { product: { id: "p1" } } }));
    vi.stubGlobal("fetch", fetchMock);
    await createProduct({ categoryId: "cat1", name: "Espresso", price: 3 });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
  });

  it("updateProduct patches fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { product: { id: "p1" } } }));
    vi.stubGlobal("fetch", fetchMock);
    await updateProduct("p1", { name: "Double Espresso" });
    expect(fetchMock.mock.calls[0][0]).toContain("/products/p1");
  });

  it("updateProductStatus toggles availability", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { product: { id: "p1" } } }));
    vi.stubGlobal("fetch", fetchMock);
    await updateProductStatus("p1", false);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/products/p1/status");
    expect(JSON.parse(init.body)).toEqual({ isAvailable: false });
  });

  it("deleteProduct sends a DELETE request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok" }));
    vi.stubGlobal("fetch", fetchMock);
    await deleteProduct("p1");
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Extend `frontend/src/api/admin-products.ts`** (keep the existing `listAdminProducts`, append the rest)

```ts
export type CreateProductInput = {
  categoryId: string;
  name: string;
  description?: string;
  imagePath?: string;
  price: number;
  preparationMinutes?: number;
  stockQuantity?: number;
  lowStockThreshold?: number;
  trackStock?: boolean;
  isAvailable?: boolean;
  displayOrder?: number;
};
export type UpdateProductInput = Omit<Partial<CreateProductInput>, "stockQuantity" | "isAvailable">;

export function getAdminProduct(productId: string) {
  return authHttp.get<{ product: SafeProduct }>(`/products/${productId}`);
}

export function createProduct(input: CreateProductInput) {
  return authHttp.post<{ product: SafeProduct }>("/products", input);
}

export function updateProduct(productId: string, input: UpdateProductInput) {
  return authHttp.patch<{ product: SafeProduct }>(`/products/${productId}`, input);
}

export function updateProductStatus(productId: string, isAvailable: boolean) {
  return authHttp.patch<{ product: SafeProduct }>(`/products/${productId}/status`, { isAvailable });
}

export function deleteProduct(productId: string) {
  return authHttp.delete<Record<string, never>>(`/products/${productId}`);
}
```

- [ ] **Step 4: Run to verify it passes.**

- [ ] **Step 5: Write the failing view test**

```ts
// frontend/tests/admin-products-view.test.ts
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as categoriesApi from "../src/api/admin-categories";
import * as productsApi from "../src/api/admin-products";
import ProductsView from "../src/views/admin/ProductsView.vue";
import type { SafeCategory } from "../src/types/category";
import type { SafeProduct } from "../src/types/product";

function makeCategory(overrides: Partial<SafeCategory> = {}): SafeCategory {
  return {
    id: "cat1", name: "Drinks", slug: "drinks", description: null, imagePath: null, imageUrl: null,
    displayOrder: 0, isVisible: true, createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

function makeProduct(overrides: Partial<SafeProduct> = {}): SafeProduct {
  return {
    id: "p1", categoryId: "cat1", categoryName: "Drinks", name: "Espresso", slug: "espresso", description: null,
    imagePath: null, price: "3.00", preparationMinutes: 5, stockQuantity: 10, reservedQuantity: 0,
    availableQuantity: 10, lowStockThreshold: 2, trackStock: true, isAvailable: true, displayOrder: 0,
    createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("admin ProductsView", () => {
  it("loads categories and products, and renders the product list", async () => {
    vi.spyOn(categoriesApi, "listCategories").mockResolvedValue({ categories: [makeCategory()] });
    vi.spyOn(productsApi, "listAdminProducts").mockResolvedValue({ products: [makeProduct()] });

    const wrapper = mount(ProductsView);
    await flushPromises();

    expect(wrapper.text()).toContain("Espresso");
  });

  it("creates a product via the dialog with a category picker", async () => {
    vi.spyOn(categoriesApi, "listCategories").mockResolvedValue({ categories: [makeCategory()] });
    vi.spyOn(productsApi, "listAdminProducts").mockResolvedValue({ products: [] });
    const createSpy = vi.spyOn(productsApi, "createProduct").mockResolvedValue({ product: makeProduct() });

    const wrapper = mount(ProductsView);
    await flushPromises();

    await wrapper.get('[data-test="new-product"]').trigger("click");
    await wrapper.get('[data-test="field-name"]').setValue("Espresso");
    await wrapper.get('[data-test="field-price"]').setValue("3.00");
    await wrapper.get('[data-test="field-category"]').setValue("cat1");
    await wrapper.get('[data-test="dialog-save"]').trigger("click");
    await flushPromises();

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ categoryId: "cat1", name: "Espresso", price: 3 }));
  });

  it("toggles product availability", async () => {
    vi.spyOn(categoriesApi, "listCategories").mockResolvedValue({ categories: [makeCategory()] });
    vi.spyOn(productsApi, "listAdminProducts").mockResolvedValue({ products: [makeProduct({ isAvailable: true })] });
    const statusSpy = vi
      .spyOn(productsApi, "updateProductStatus")
      .mockResolvedValue({ product: makeProduct({ isAvailable: false }) });

    const wrapper = mount(ProductsView);
    await flushPromises();

    await wrapper.get('[data-test="toggle-available-p1"]').trigger("click");
    await flushPromises();

    expect(statusSpy).toHaveBeenCalledWith("p1", false);
  });
});
```

- [ ] **Step 6: Run to verify it fails.**

- [ ] **Step 7: Create `frontend/src/views/admin/ProductsView.vue`**

On mount, fetch both `listCategories()` (for the picker) and `listAdminProducts()` in parallel. List of product cards (name, category name, price, availability badge) + "+ New Product" opening `AdminFormDialog` with fields `data-test="field-name"`, `"field-price"`, `"field-category"` (a `<select data-test="field-category">` populated from the fetched categories, `v-model` bound to a `categoryId` ref), `"field-description"`, `"field-preparationMinutes"`, and an `ImageUploadField` (folder `"products"`); per-card "Edit", availability toggle `data-test="toggle-available-<id>"`, "Delete" (same error-surfacing pattern as Task 5). Follow the same list+dialog shape as prior tasks.

- [ ] **Step 8: Run to verify it passes.**

- [ ] **Step 9: Wire the router** — swap `admin.products`.

- [ ] **Step 10: Full suite, typecheck, lint. Commit.**

```bash
git add frontend/src/api/admin-products.ts frontend/src/views/admin/ProductsView.vue frontend/src/router/index.ts frontend/tests/api-admin-products.test.ts frontend/tests/admin-products-view.test.ts
git commit -m "feat(frontend): add admin product catalog management screen"
```

---

### Task 7: Stock (`admin.stock`)

**Files:**
- Modify: `frontend/src/api/admin-products.ts` (add `adjustProductStock`)
- Create: `frontend/src/views/admin/StockView.vue`
- Modify: `frontend/src/router/index.ts`
- Create: `frontend/tests/admin-stock-view.test.ts`, extend `frontend/tests/api-admin-products.test.ts`

**Backend contract:**
- `PATCH /products/:id/stock` body `{ quantityDelta: number (non-zero int); reason: string (3-500) }` → `{ product: SafeProduct }` (409 `INVALID_STOCK` if it would go negative)

- [ ] **Step 1: Write the failing API test**, appended to `frontend/tests/api-admin-products.test.ts`

```ts
import { adjustProductStock } from "../src/api/admin-products";

describe("admin products api — stock", () => {
  it("adjustProductStock sends the delta and reason", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { product: { id: "p1" } } }));
    vi.stubGlobal("fetch", fetchMock);

    await adjustProductStock("p1", { quantityDelta: -5, reason: "Spoiled stock" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/products/p1/stock");
    expect(JSON.parse(init.body)).toEqual({ quantityDelta: -5, reason: "Spoiled stock" });
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Add to `frontend/src/api/admin-products.ts`**

```ts
export function adjustProductStock(productId: string, input: { quantityDelta: number; reason: string }) {
  return authHttp.patch<{ product: SafeProduct }>(`/products/${productId}/stock`, input);
}
```

- [ ] **Step 4: Run to verify it passes.**

- [ ] **Step 5: Write the failing view test**

```ts
// frontend/tests/admin-stock-view.test.ts
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as productsApi from "../src/api/admin-products";
import StockView from "../src/views/admin/StockView.vue";
import type { SafeProduct } from "../src/types/product";

function makeProduct(overrides: Partial<SafeProduct> = {}): SafeProduct {
  return {
    id: "p1", categoryId: "cat1", categoryName: "Drinks", name: "Espresso", slug: "espresso", description: null,
    imagePath: null, price: "3.00", preparationMinutes: 5, stockQuantity: 10, reservedQuantity: 0,
    availableQuantity: 10, lowStockThreshold: 2, trackStock: true, isAvailable: true, displayOrder: 0,
    createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("admin StockView", () => {
  it("highlights products at or below their low-stock threshold", async () => {
    vi.spyOn(productsApi, "listAdminProducts").mockResolvedValue({
      products: [makeProduct({ id: "p1", availableQuantity: 2, lowStockThreshold: 5 }), makeProduct({ id: "p2", availableQuantity: 10, lowStockThreshold: 5 })],
    });

    const wrapper = mount(StockView);
    await flushPromises();

    expect(wrapper.get('[data-test="stock-row-p1"]').classes().join(" ")).toContain("bz-red");
    expect(wrapper.get('[data-test="stock-row-p2"]').classes().join(" ")).not.toContain("bz-red");
  });

  it("adjusts stock via the dialog with a delta and reason", async () => {
    vi.spyOn(productsApi, "listAdminProducts").mockResolvedValue({ products: [makeProduct()] });
    const adjustSpy = vi.spyOn(productsApi, "adjustProductStock").mockResolvedValue({
      product: makeProduct({ stockQuantity: 15, availableQuantity: 15 }),
    });

    const wrapper = mount(StockView);
    await flushPromises();

    await wrapper.get('[data-test="adjust-p1"]').trigger("click");
    await wrapper.get('[data-test="field-delta"]').setValue("5");
    await wrapper.get('[data-test="field-reason"]').setValue("Restocked from supplier");
    await wrapper.get('[data-test="dialog-save"]').trigger("click");
    await flushPromises();

    expect(adjustSpy).toHaveBeenCalledWith("p1", { quantityDelta: 5, reason: "Restocked from supplier" });
  });
});
```

- [ ] **Step 6: Run to verify it fails.**

- [ ] **Step 7: Create `frontend/src/views/admin/StockView.vue`**

Fetch `listAdminProducts()` on mount (same data source as Products, no new endpoint). List rows: name, `stockQuantity`, `reservedQuantity`, `availableQuantity`, `lowStockThreshold`, each row `data-test="stock-row-<id>"` with a conditional class (e.g. `text-bz-red` / a light red background) applied when `product.availableQuantity <= product.lowStockThreshold`, matching the same `<=` rule as the dashboard tile. Per-row "Adjust" button `data-test="adjust-<id>"` opening `AdminFormDialog` with a numeric delta field `data-test="field-delta"` (accepts negative/positive) and a reason field `data-test="field-reason"`, calling `adjustProductStock(id, { quantityDelta: Number(delta), reason })`.

- [ ] **Step 8: Run to verify it passes.**

- [ ] **Step 9: Wire the router** — swap `admin.stock`.

- [ ] **Step 10: Full suite, typecheck, lint. Commit.**

```bash
git add frontend/src/api/admin-products.ts frontend/src/views/admin/StockView.vue frontend/src/router/index.ts frontend/tests/api-admin-products.test.ts frontend/tests/admin-stock-view.test.ts
git commit -m "feat(frontend): add admin stock management screen"
```

---

### Task 8: Media library (`admin.media`) — includes one backend addition

**Files:**
- Create: `backend/src/modules/media/media.routes.ts` addition (new `GET /` route) — **read the existing file first**, add alongside existing POST/DELETE
- Modify: `backend/src/modules/media/media.controller.ts` (add `list` handler)
- Modify: `backend/src/modules/media/media.service.ts` (add a function that reads the folder's files from disk and maps each to `SafeMedia`)
- Create: `backend/tests/unit/media-list.node.test.ts`
- Modify: `frontend/src/api/media.ts` (add `listMedia`)
- Create: `frontend/src/views/admin/MediaView.vue`
- Modify: `frontend/src/router/index.ts`
- Create: `frontend/tests/admin-media-view.test.ts`, extend or create `frontend/tests/api-media.test.ts` coverage for `listMedia`

**Backend design:**
- New route: `GET /api/v1/media?folder=X` (X ∈ `general|categories|products|staff|customers`, default `general` — same validation as the existing upload route; read the existing `folder` query validation in `media.validation.ts` or wherever the upload route validates it, and reuse the same schema/constant for the list route rather than duplicating the enum).
- Service: read `backend/public/uploads/media/<folder>/` (or wherever `MEDIA_UPLOADS_DIR`/equivalent constant points — check `media.service.ts`'s existing upload function for the exact base directory constant and reuse it) via `fs.readdir`, filter to files only (skip directories), map each filename to `SafeMedia`: `{ path: "/uploads/media/<folder>/<filename>", url: <APP_URL>+path, folder, mimeType: <derive from extension via a small extension→mimeType map, or use the `mime-types` package if already a dependency — check `package.json` first>, sizeBytes: <fs.statSync(...).size>, originalName: filename }`. If the directory doesn't exist yet (no uploads in that folder ever), return an empty array rather than throwing.
- Route auth: `authenticate` + `authorize([ADMIN, STAFF])`, matching the existing upload/delete routes exactly.

- [ ] **Step 1: Read the existing media module fully first** — `backend/src/modules/media/media.routes.ts`, `media.controller.ts`, `media.service.ts`, `media.validation.ts` (or wherever folder validation lives) — to match exact naming/import/error-handling conventions before adding anything.

- [ ] **Step 2: Write the failing backend test**

```ts
// backend/tests/unit/media-list.node.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

import { listMediaInFolder } from "../../src/modules/media/media.service.js";

describe("listMediaInFolder", () => {
  it("returns an empty array for a folder with no uploads", async () => {
    const result = await listMediaInFolder("general");
    assert.ok(Array.isArray(result));
  });

  it("returns SafeMedia entries for files that exist in the folder", async (t) => {
    // Find the actual uploads base dir the service uses (import the same constant it uses,
    // or write directly under wherever media.service.ts reads from — adjust this test to use
    // the module's real exported/imported directory constant rather than hardcoding a path).
    const testFileName = `test-${Date.now()}.png`;
    // ... write a tiny fake file into the general folder using the same base-dir constant the
    // service itself resolves internally (import it, don't hardcode), then:
    const result = await listMediaInFolder("general");
    const found = result.find((entry) => entry.originalName === testFileName);
    assert.ok(found, "expected the just-written test file to appear in the listing");
    assert.equal(found?.folder, "general");
    t.after(() => fs.promises.unlink(path.join(/* same base dir */ "", "general", testFileName)).catch(() => {}));
  });
});
```

(The implementer should replace the base-dir placeholder above with the actual constant/path the existing `media.service.ts` uses for uploads — read that file first per Step 1 and use the same resolution so the test writes to and reads from the exact same place the service does.)

- [ ] **Step 3: Run to verify it fails** — `npm test` (or the specific unit test runner command) from `backend/`.

- [ ] **Step 4: Implement `listMediaInFolder` in `media.service.ts`** and a `list` controller handler in `media.controller.ts`, following the exact code style, error handling, and `SafeMedia` shaping already used by the existing upload function in the same file (do not invent a different response envelope).

- [ ] **Step 5: Add the `GET /` route** in `media.routes.ts`, same middleware chain as the existing routes.

- [ ] **Step 6: Run to verify the backend test passes. Run `npm run typecheck` from `backend/`.**

- [ ] **Step 7: Write the failing frontend API test**, appended to `frontend/tests/api-media.test.ts`

```ts
import { listMedia } from "../src/api/media";

describe("media api — list", () => {
  it("listMedia fetches media for a folder", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { success: true, message: "ok", data: { media: [] } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await listMedia("products");

    expect(fetchMock.mock.calls[0][0]).toContain("/media?folder=products");
  });
});
```

- [ ] **Step 8: Run to verify it fails.**

- [ ] **Step 9: Add `listMedia` to `frontend/src/api/media.ts`**

```ts
export function listMedia(folder: MediaFolder) {
  return authHttp.get<{ media: SafeMedia[] }>(`/media?folder=${folder}`);
}
```

- [ ] **Step 10: Run to verify it passes.**

- [ ] **Step 11: Write the failing view test**

```ts
// frontend/tests/admin-media-view.test.ts
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as mediaApi from "../src/api/media";
import MediaView from "../src/views/admin/MediaView.vue";

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("admin MediaView", () => {
  it("loads media for the default folder and switches folders on tab click", async () => {
    const listSpy = vi.spyOn(mediaApi, "listMedia").mockResolvedValue({
      media: [{ path: "/uploads/media/general/a.png", url: "http://x/a.png", folder: "general", mimeType: "image/png", sizeBytes: 100, originalName: "a.png" }],
    });

    const wrapper = mount(MediaView);
    await flushPromises();

    expect(wrapper.text()).toContain("a.png");
    expect(listSpy).toHaveBeenCalledWith("general");

    await wrapper.get('[data-test="folder-tab-products"]').trigger("click");
    await flushPromises();

    expect(listSpy).toHaveBeenLastCalledWith("products");
  });

  it("deletes a media item", async () => {
    vi.spyOn(mediaApi, "listMedia").mockResolvedValue({
      media: [{ path: "/uploads/media/general/a.png", url: "http://x/a.png", folder: "general", mimeType: "image/png", sizeBytes: 100, originalName: "a.png" }],
    });
    const deleteSpy = vi.spyOn(mediaApi, "deleteMedia").mockResolvedValue(undefined as never);

    const wrapper = mount(MediaView);
    await flushPromises();

    await wrapper.get('[data-test="delete-media"]').trigger("click");
    await flushPromises();

    expect(deleteSpy).toHaveBeenCalledWith("/uploads/media/general/a.png");
  });
});
```

- [ ] **Step 12: Run to verify it fails.**

- [ ] **Step 13: Create `frontend/src/views/admin/MediaView.vue`**

Folder tabs (`data-test="folder-tab-<folder>"` for each of the 5 `MediaFolder` values, active tab highlighted) + grid of thumbnails (`<img>` per item using `.url`, filename caption, delete button `data-test="delete-media"` calling `deleteMedia(path)` then refetching the current folder's list). No upload control here — uploads happen via `ImageUploadField` on the entity forms (Categories/Products/Staff/Customers); this screen is browse + delete only, per the design spec.

- [ ] **Step 14: Run to verify it passes.**

- [ ] **Step 15: Wire the router** — swap `admin.media`.

- [ ] **Step 16: Full suite (backend + frontend), typecheck, lint both. Commit.**

```bash
git add backend/src/modules/media/ backend/tests/unit/media-list.node.test.ts frontend/src/api/media.ts frontend/src/views/admin/MediaView.vue frontend/src/router/index.ts frontend/tests/api-media.test.ts frontend/tests/admin-media-view.test.ts
git commit -m "feat: add media library listing endpoint and admin browse/delete screen"
```

---

### Task 9: Orders (`admin.orders`)

**Files:**
- Modify: `frontend/src/api/staff-orders.ts` (add `cancelOrder`)
- Create: `frontend/src/views/admin/OrdersView.vue`, `frontend/src/views/admin/OrderDetailPanel.vue` (or inline detail — implementer's call, but keep the list view file focused; a separate detail component is preferred if the inline logic grows past ~150 lines)
- Modify: `frontend/src/router/index.ts`
- Create: `frontend/tests/admin-orders-view.test.ts`, extend `frontend/tests/api-staff.test.ts` (or wherever `staff-orders.ts` is tested) for `cancelOrder`

**Backend contract:**
- `POST /orders/:id/cancel` body `{ reason: string (3-1000) }` → `{ order: SafeOrder }`. Only valid from `ACCEPTED | PREPARING | READY`.
- Everything else (list, accept, reject, start-preparing, mark-ready, mark-served, attach-customer) is already wrapped in `staff-orders.ts` and directly reusable.

- [ ] **Step 1: Write the failing test for `cancelOrder`**, appended to whichever test file already covers `staff-orders.ts` (find it — likely `frontend/tests/api-staff.test.ts` based on Task 2's research; confirm by grepping for `rejectOrder` across `frontend/tests/`)

```ts
import { cancelOrder } from "../src/api/staff-orders";

describe("staff orders api — cancel", () => {
  it("cancelOrder posts the reason to the cancel endpoint", async () => {
    // follow this file's existing configureAuthIntegration/stubGlobal pattern exactly
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { order: { id: "o1" } } }));
    vi.stubGlobal("fetch", fetchMock);

    await cancelOrder("o1", "Table double-booked");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/orders/o1/cancel");
    expect(JSON.parse(init.body)).toEqual({ reason: "Table double-booked" });
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Add to `frontend/src/api/staff-orders.ts`**

```ts
export function cancelOrder(orderId: string, reason: string) {
  return authHttp.post<{ order: SafeOrder }>(`/orders/${orderId}/cancel`, { reason });
}
```

- [ ] **Step 4: Run to verify it passes.**

- [ ] **Step 5: Write the failing view test**

```ts
// frontend/tests/admin-orders-view.test.ts
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as staffOrdersApi from "../src/api/staff-orders";
import OrdersView from "../src/views/admin/OrdersView.vue";
import { OrderStatus, OrderPaymentStatus } from "../src/types/enums";

function makeOrder(id: string, status: OrderStatus) {
  return {
    id, orderNumber: `ORD-${id}`, billNumber: `BILL-${id}`, orderType: "DINE_IN", orderStatus: status,
    paymentStatus: OrderPaymentStatus.UNPAID, tableId: "t1", tableNumber: "5", customerId: null,
    customerName: null, customerPhone: null, guestSessionId: "s1", subtotal: "100.00", taxAmount: "0.00",
    serviceChargeAmount: "0.00", discountAmount: "0.00", totalAmount: "100.00", paidAmount: "0.00",
    remainingAmount: "100.00", estimatedPreparationMinutes: 10, estimatedReadyAt: null, customerNotes: null,
    rejectionReason: null, cancellationReason: null, receiptImagePath: null, receiptImageUrl: null, items: [],
    acceptedAt: null, preparingAt: null, readyAt: null, servedAt: null, completedAt: null, rejectedAt: null,
    cancelledAt: null, createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T00:00:00.000Z",
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("admin OrdersView", () => {
  it("loads and renders the order queue", async () => {
    vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({ orders: [makeOrder("o1", OrderStatus.PENDING) as never] });
    const wrapper = mount(OrdersView);
    await flushPromises();
    expect(wrapper.text()).toContain("ORD-o1");
  });

  it("shows a Cancel action for an ACCEPTED order and cancels with a reason", async () => {
    vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({ orders: [makeOrder("o1", OrderStatus.ACCEPTED) as never] });
    const cancelSpy = vi
      .spyOn(staffOrdersApi, "cancelOrder")
      .mockResolvedValue({ order: makeOrder("o1", OrderStatus.CANCELLED) as never });

    const wrapper = mount(OrdersView);
    await flushPromises();

    await wrapper.get('[data-test="open-order-o1"]').trigger("click");
    await wrapper.get('[data-test="cancel-order"]').trigger("click");
    await wrapper.get("textarea").setValue("Table double-booked");
    await wrapper.get('[data-test="confirm"]').trigger("click");
    await flushPromises();

    expect(cancelSpy).toHaveBeenCalledWith("o1", "Table double-booked");
  });

  it("does not show a Cancel action for a PENDING order", async () => {
    vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({ orders: [makeOrder("o1", OrderStatus.PENDING) as never] });
    const wrapper = mount(OrdersView);
    await flushPromises();

    await wrapper.get('[data-test="open-order-o1"]').trigger("click");
    expect(wrapper.find('[data-test="cancel-order"]').exists()).toBe(false);
  });
});
```

- [ ] **Step 6: Run to verify it fails.**

- [ ] **Step 7: Build `frontend/src/views/admin/OrdersView.vue`**

Mirror `frontend/src/views/staff/OrderQueueView.vue`'s filter chips + list, and `frontend/src/views/staff/OrderDetailView.vue`'s detail actions (accept/reject/start-preparing/mark-ready/mark-served), reusing the same `staffOrdersStore`/socket wiring pattern (`useStaffOrdersStore`, `useStaffSocketStore`, both already work for ADMIN since the backend authorizes ADMIN+STAFF on the orders routes and the socket's OPERATIONS room join is role-agnostic). Add a "Cancel" button `data-test="cancel-order"` shown only when `order.orderStatus` is `ACCEPTED`, `PREPARING`, or `READY`, opening `ReasonConfirmationDialog` — its textarea has no `data-test` attribute (select via `wrapper.find("textarea")`), its buttons are `data-test="cancel"` and `data-test="confirm"` (the test above's `[data-test="confirm"]` reference is already correct). Detail can be inline (expand-in-place) rather than a route, per the design spec's shared convention — use `data-test="open-order-<id>"` on each row to expand.

- [ ] **Step 8: Run to verify it passes.**

- [ ] **Step 9: Wire the router** — swap `admin.orders`.

- [ ] **Step 10: Full suite, typecheck, lint. Commit.**

```bash
git add frontend/src/api/staff-orders.ts frontend/src/views/admin/OrdersView.vue frontend/src/router/index.ts frontend/tests/admin-orders-view.test.ts
git commit -m "feat(frontend): add admin orders screen with cancellation"
```

(If `ReasonConfirmationDialog.vue` needed new `data-test` attributes added, include that file in this commit too.)

---

### Task 10: Cancellations (`admin.cancellations`)

**Files:**
- Create: `frontend/src/views/admin/CancellationsView.vue`
- Modify: `frontend/src/router/index.ts`
- Create: `frontend/tests/admin-cancellations-view.test.ts`

**Backend contract:** reuses `listStaffOrders({ status: OrderStatus.CANCELLED })` — no new API needed.

- [ ] **Step 1: Write the failing view test**

```ts
// frontend/tests/admin-cancellations-view.test.ts
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as staffOrdersApi from "../src/api/staff-orders";
import CancellationsView from "../src/views/admin/CancellationsView.vue";
import { OrderStatus, OrderPaymentStatus } from "../src/types/enums";

function makeCancelledOrder() {
  return {
    id: "o1", orderNumber: "ORD-o1", billNumber: "BILL-o1", orderType: "DINE_IN", orderStatus: OrderStatus.CANCELLED,
    paymentStatus: OrderPaymentStatus.UNPAID, tableId: "t1", tableNumber: "5", customerId: null,
    customerName: null, customerPhone: null, guestSessionId: "s1", subtotal: "100.00", taxAmount: "0.00",
    serviceChargeAmount: "0.00", discountAmount: "0.00", totalAmount: "100.00", paidAmount: "0.00",
    remainingAmount: "0.00", estimatedPreparationMinutes: 10, estimatedReadyAt: null, customerNotes: null,
    rejectionReason: null, cancellationReason: "Table double-booked", receiptImagePath: null, receiptImageUrl: null,
    items: [], acceptedAt: "2026-07-20T00:00:00.000Z", preparingAt: null, readyAt: null, servedAt: null,
    completedAt: null, rejectedAt: null, cancelledAt: "2026-07-20T01:00:00.000Z",
    createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T01:00:00.000Z",
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("admin CancellationsView", () => {
  it("fetches only CANCELLED orders and shows the reason", async () => {
    const listSpy = vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({ orders: [makeCancelledOrder() as never] });

    const wrapper = mount(CancellationsView);
    await flushPromises();

    expect(listSpy).toHaveBeenCalledWith({ status: OrderStatus.CANCELLED });
    expect(wrapper.text()).toContain("ORD-o1");
    expect(wrapper.text()).toContain("Table double-booked");
  });

  it("has no action buttons — this is a read-only audit view", async () => {
    vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({ orders: [makeCancelledOrder() as never] });
    const wrapper = mount(CancellationsView);
    await flushPromises();
    expect(wrapper.findAll("button")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Create `frontend/src/views/admin/CancellationsView.vue`**

On mount, `listStaffOrders({ status: OrderStatus.CANCELLED })`. Render a read-only list: order number, table/takeaway, `cancellationReason`, `cancelledAt` (formatted), `totalAmount`. `LoadingState`/`ErrorState`/`EmptyState` per convention. No buttons, no dialogs.

- [ ] **Step 4: Run to verify it passes.**

- [ ] **Step 5: Wire the router** — swap `admin.cancellations`.

- [ ] **Step 6: Full suite, typecheck, lint. Commit.**

```bash
git add frontend/src/views/admin/CancellationsView.vue frontend/src/router/index.ts frontend/tests/admin-cancellations-view.test.ts
git commit -m "feat(frontend): add admin cancellations audit screen"
```

---

### Task 11: Payments (`admin.payments`)

**Files:**
- Modify: `frontend/src/api/admin-payments.ts` (add `getPayment`, `listOrderPayments`, `recordPayment`, `reversePayment`)
- Create: `frontend/src/views/admin/PaymentsView.vue`
- Modify: `frontend/src/router/index.ts`
- Create: `frontend/tests/admin-payments-view.test.ts`, extend `frontend/tests/api-admin-payments.test.ts`

**Backend contract:**
- `GET /payments/:id` → `{ payment: SafePayment }`
- `GET /orders/:orderId/payments` → `{ payments: SafePayment[] }`
- `POST /orders/:orderId/payments` body `{ amount: number, method: PaymentMethod, reference?: string, notes?: string, idempotencyKey?: string }` → `{ payment: SafePayment; order: SafeOrder; duplicated: boolean; sessionClosed: boolean; receiptRawToken: string | null }` (409 `ORDER_NOT_SERVED` if order isn't SERVED)
- `POST /payments/:id/reverse` body `{ reason: string (3-1000) }` → `{ payment: SafePayment; order: SafeOrder }`

- [ ] **Step 1: Write the failing API tests**, appended to `frontend/tests/api-admin-payments.test.ts`

```ts
import { getPayment, listOrderPayments, recordPayment, reversePayment } from "../src/api/admin-payments";

describe("admin payments api — mutations", () => {
  it("getPayment fetches one payment", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { payment: { id: "pay1" } } }));
    vi.stubGlobal("fetch", fetchMock);
    await getPayment("pay1");
    expect(fetchMock.mock.calls[0][0]).toContain("/payments/pay1");
  });

  it("listOrderPayments fetches payments for an order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, message: "ok", data: { payments: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    await listOrderPayments("o1");
    expect(fetchMock.mock.calls[0][0]).toContain("/orders/o1/payments");
  });

  it("recordPayment posts the payment payload to the order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, { success: true, message: "ok", data: { payment: { id: "pay1" }, order: { id: "o1" }, duplicated: false, sessionClosed: false, receiptRawToken: null } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await recordPayment("o1", { amount: 100, method: "CASH" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/orders/o1/payments");
    expect(init.method).toBe("POST");
  });

  it("reversePayment posts the reason", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { success: true, message: "ok", data: { payment: { id: "pay1" }, order: { id: "o1" } } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await reversePayment("pay1", "Customer disputed charge");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/payments/pay1/reverse");
    expect(JSON.parse(init.body)).toEqual({ reason: "Customer disputed charge" });
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Extend `frontend/src/api/admin-payments.ts`**

```ts
import type { PaymentMethod } from "../types/enums";
import type { SafeOrder } from "../types/order";

export type RecordPaymentInput = { amount: number; method: PaymentMethod; reference?: string; notes?: string };

export function getPayment(paymentId: string) {
  return authHttp.get<{ payment: SafePayment }>(`/payments/${paymentId}`);
}

export function listOrderPayments(orderId: string) {
  return authHttp.get<{ payments: SafePayment[] }>(`/orders/${orderId}/payments`);
}

export function recordPayment(orderId: string, input: RecordPaymentInput) {
  return authHttp.post<{ payment: SafePayment; order: SafeOrder; duplicated: boolean; sessionClosed: boolean; receiptRawToken: string | null }>(
    `/orders/${orderId}/payments`,
    input,
  );
}

export function reversePayment(paymentId: string, reason: string) {
  return authHttp.post<{ payment: SafePayment; order: SafeOrder }>(`/payments/${paymentId}/reverse`, { reason });
}
```

- [ ] **Step 4: Run to verify it passes.**

- [ ] **Step 5: Write the failing view test**

```ts
// frontend/tests/admin-payments-view.test.ts
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as adminPaymentsApi from "../src/api/admin-payments";
import * as staffOrdersApi from "../src/api/staff-orders";
import PaymentsView from "../src/views/admin/PaymentsView.vue";
import { OrderStatus, OrderPaymentStatus, PaymentMethod, PaymentStatus } from "../src/types/enums";

function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: "pay1", paymentNumber: "PAY-1", orderId: "o1", amount: "50.00", method: PaymentMethod.CASH,
    status: PaymentStatus.COMPLETED, reference: null, notes: null, paidAt: "2026-07-20T00:00:00.000Z",
    voidedAt: null, voidReason: null, createdAt: "2026-07-20T00:00:00.000Z", ...overrides,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.restoreAllMocks();
});

describe("admin PaymentsView", () => {
  it("loads and renders the payments list", async () => {
    vi.spyOn(adminPaymentsApi, "listAdminPayments").mockResolvedValue({ payments: [makePayment() as never] });
    const wrapper = mount(PaymentsView);
    await flushPromises();
    expect(wrapper.text()).toContain("PAY-1");
  });

  it("reverses a payment with a reason", async () => {
    vi.spyOn(adminPaymentsApi, "listAdminPayments").mockResolvedValue({ payments: [makePayment() as never] });
    const reverseSpy = vi
      .spyOn(adminPaymentsApi, "reversePayment")
      .mockResolvedValue({ payment: makePayment({ status: PaymentStatus.REFUNDED }) as never, order: {} as never });

    const wrapper = mount(PaymentsView);
    await flushPromises();

    await wrapper.get('[data-test="reverse-pay1"]').trigger("click");
    await wrapper.get("textarea").setValue("Customer disputed charge");
    await wrapper.get('[data-test="confirm"]').trigger("click");
    await flushPromises();

    expect(reverseSpy).toHaveBeenCalledWith("pay1", "Customer disputed charge");
  });

  it("disables reverse for an already-voided payment", async () => {
    vi.spyOn(adminPaymentsApi, "listAdminPayments").mockResolvedValue({
      payments: [makePayment({ voidedAt: "2026-07-20T02:00:00.000Z" }) as never],
    });
    const wrapper = mount(PaymentsView);
    await flushPromises();
    expect(wrapper.find('[data-test="reverse-pay1"]').attributes("disabled")).toBeDefined();
  });

  it("records a payment for a SERVED unpaid order", async () => {
    vi.spyOn(adminPaymentsApi, "listAdminPayments").mockResolvedValue({ payments: [] });
    vi.spyOn(staffOrdersApi, "listStaffOrders").mockResolvedValue({
      orders: [{ id: "o1", orderNumber: "ORD-o1", orderStatus: OrderStatus.SERVED, paymentStatus: OrderPaymentStatus.UNPAID, remainingAmount: "100.00" } as never],
    });
    const recordSpy = vi
      .spyOn(adminPaymentsApi, "recordPayment")
      .mockResolvedValue({ payment: makePayment() as never, order: {} as never, duplicated: false, sessionClosed: false, receiptRawToken: null });

    const wrapper = mount(PaymentsView);
    await flushPromises();

    await wrapper.get('[data-test="new-payment"]').trigger("click");
    await wrapper.get('[data-test="field-order"]').setValue("o1");
    await wrapper.get('[data-test="field-amount"]').setValue("100");
    await wrapper.get('[data-test="field-method"]').setValue("CASH");
    await wrapper.get('[data-test="dialog-save"]').trigger("click");
    await flushPromises();

    expect(recordSpy).toHaveBeenCalledWith("o1", expect.objectContaining({ amount: 100, method: "CASH" }));
  });
});
```

- [ ] **Step 6: Run to verify it fails.**

- [ ] **Step 7: Create `frontend/src/views/admin/PaymentsView.vue`**

On mount, `listAdminPayments()`. List of payment cards (paymentNumber, amount, method, status badge, reference) with "Reverse" `data-test="reverse-<id>"` — disabled when `payment.voidedAt !== null` or `payment.status !== PaymentStatus.COMPLETED` — opening `ReasonConfirmationDialog`. Separately, "+ Record Payment" (`data-test="new-payment"`) opens `AdminFormDialog`: fetches `listStaffOrders({ status: OrderStatus.SERVED })` filtered client-side to `Number(order.remainingAmount) > 0`, a `<select data-test="field-order">` of those orders, amount field `data-test="field-amount"`, method `<select data-test="field-method">` (values from `PaymentMethod` enum), optional reference field, calling `recordPayment(orderId, { amount: Number(...), method, reference })`.

- [ ] **Step 8: Run to verify it passes.**

- [ ] **Step 9: Wire the router** — swap `admin.payments`.

- [ ] **Step 10: Full suite, typecheck, lint. Commit.**

```bash
git add frontend/src/api/admin-payments.ts frontend/src/views/admin/PaymentsView.vue frontend/src/router/index.ts frontend/tests/api-admin-payments.test.ts frontend/tests/admin-payments-view.test.ts
git commit -m "feat(frontend): add admin payments screen with record/reverse"
```

---

### Task 12: Final regression pass

**Files:** none created — verification only.

- [ ] **Step 1: Confirm no `ComingSoonView` route remains** — `grep -rn "ComingSoonView" frontend/src/router/index.ts` should show only the import statement is gone entirely (or zero matches if the import was removed too — remove the now-unused `ComingSoonView.vue` file and its own test if nothing references it anymore; check `frontend/tests/admin-coming-soon-view.test.ts` — delete it since the component it tests is now unused, unless something still imports `ComingSoonView.vue` directly, in which case keep both).

- [ ] **Step 2: Run the full frontend suite, typecheck, lint**

```bash
cd frontend && npm run typecheck && npm run lint && npm run test
```

- [ ] **Step 3: Run the full backend suite, typecheck**

```bash
cd backend && npm run typecheck && npm test
```

- [ ] **Step 4: Confirm the only backend changes are the Media list addition**

```bash
git diff --stat main -- backend/ | grep -v media
```

Expected: no output beyond the media module files and its test.

- [ ] **Step 5: Commit any final cleanup** (e.g. `ComingSoonView.vue` removal) if Step 1 found it unused.

---

## Self-Review

**Spec coverage:** all 11 modules from the design spec have a task; Settings/Staff/Customers/Tables/Categories/Products/Stock/Media/Orders/Cancellations/Payments — every nav item accounted for, plus the shared `AdminFormDialog` prerequisite and the one required backend addition (Media list).

**Placeholder scan:** every task has exact routes, exact request/response field names verified against backend source, and exact test assertions. Where full Vue template code isn't embedded (given the 11-module scale), each task names the specific existing component to structurally mirror (`OrderQueueView.vue`, `StaffView.vue` from an earlier task, etc.) — these are complete, readable references, not vague direction.

**Type consistency:** `SafeStaff`/`SafeCategory`/`SafeTable` (new) match their backend `Safe*` shapes field-for-field as confirmed by research. `SafeProduct`/`SafeCustomer`/`SafePayment`/`SafeOrder` (pre-existing) are reused, not redefined. API function names referenced across tasks (`listCategories` used by Task 6, `listStaffOrders`/`cancelOrder` used by Tasks 9-10, `listAdminPayments` used by Task 11) match exactly what their originating task defines.

**Scope check:** one backend change (Media list, explicitly called out, minimal/read-only) — everything else frontend-only, matching the design spec.
