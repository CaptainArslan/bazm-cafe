# Admin Foundation: Media/Image-Upload Plumbing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `authHttp` the ability to send `multipart/form-data` and add one reusable `ImageUploadField.vue` component so every later Admin phase (Catalog, Tables, Staff, Customer management) can attach an optional image to an entity without reimplementing upload plumbing.

**Architecture:** Extend the existing `request()` function in `frontend/src/api/http.ts` to special-case a `FormData` body (skip `JSON.stringify` and the `Content-Type` header so the browser sets the correct multipart boundary). Add a thin `frontend/src/api/media.ts` wrapper over `POST /api/v1/media` and `DELETE /api/v1/media`, and one `ImageUploadField.vue` component that owns upload/delete/preview/error state and exposes a `v-model` of the entity's `imagePath`.

**Tech Stack:** Vue 3 `<script setup>` + TypeScript (strict), vitest + @vue/test-utils, Tailwind with the existing `bz-*` design tokens.

## Global Constraints

- No new npm dependency.
- Access token / HTTP client lifecycle is already fully wired (Foundation plan) — this plan only extends `request()`'s body handling, it does not touch auth/refresh logic.
- Match existing code style exactly: relative imports, double quotes, semicolons, trailing commas, `<script setup lang="ts">`.
- Every new/changed file must pass `npm run typecheck` and `npm run lint` (run from `frontend/`) and every new/changed test must pass `npm run test` (`vitest run`).
- Client-side validation (file type/size) must mirror the backend's own limits exactly: allowed types `image/jpeg`, `image/png`, `image/webp`, `image/gif`; max size 5MB (`5 * 1024 * 1024` bytes) — these are the backend's actual constants in `backend/src/modules/media/media.constants.ts` (`MEDIA_ALLOWED_MIME_TYPES`, `MEDIA_MAX_BYTES`), not independently chosen values.
- Old-file cleanup (on replace or remove) is always best-effort: a failed `deleteMedia` call must never block emitting the new value, never throw out of the component, and never show an error to the user — only upload failures surface an inline error.
- This plan does not touch any Admin screen, route, or nav entry — those are later phases. It also does not touch the backend (the media module is already fully implemented).

---

### Task 1: FormData support in `authHttp`

**Files:**
- Modify: `frontend/src/api/http.ts`
- Test: `frontend/tests/http-auth.test.ts` (extend the existing file — add two new `it` blocks to the existing `describe("authHttp", ...)` block; do not touch any existing test)

**Interfaces:**
- Consumes: nothing new.
- Produces: no new exports — `authHttp.post`/`authHttp.patch`/`authHttp.put` (all already accept `body?: unknown`) now correctly forward a `FormData` instance to `fetch` unmodified, with no `Content-Type` header set. Every existing JSON call path is byte-identical to before.

- [ ] **Step 1: Write the two failing tests**

Add these two `it` blocks inside the existing `describe("authHttp", ...)` block in `frontend/tests/http-auth.test.ts` (after the last existing `it` block, before the closing `});`):

```ts
  it("sends a FormData body without JSON-stringifying it or setting Content-Type", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, { success: true, message: "ok", data: { media: { path: "/uploads/media/products/x.png" } } }),
    );

    const formData = new FormData();
    formData.append("file", new File(["x"], "x.png", { type: "image/png" }));

    await authHttp.post("/media?folder=products", formData);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(formData);
    expect(init.headers["Content-Type"]).toBeUndefined();
  });

  it("still JSON-stringifies and sets Content-Type for a plain object body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: true, message: "ok", data: { ok: true } }));

    await authHttp.post("/staff", { name: "Ada" });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(JSON.stringify({ name: "Ada" }));
    expect(init.headers["Content-Type"]).toBe("application/json");
  });
```

- [ ] **Step 2: Run the tests to verify the FormData case fails**

Run (from `frontend/`): `npx vitest run tests/http-auth.test.ts`
Expected: the new "sends a FormData body..." test FAILS — `init.body` is currently `JSON.stringify(formData)` (which serializes to the string `"{}"`), not the same object reference as `formData`, so `expect(init.body).toBe(formData)` fails. The "still JSON-stringifies..." test passes already (it describes current behavior) — that's fine, it's here to pin the behavior against regression, not to prove a bug.

- [ ] **Step 3: Modify `request()` in `frontend/src/api/http.ts`**

Find this block:

```ts
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
```

Replace it with:

```ts
  const isFormData = body instanceof FormData;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body !== undefined && !isFormData && { "Content-Type": "application/json" }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    ...(body !== undefined && { body: isFormData ? body : JSON.stringify(body) }),
  });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/http-auth.test.ts`
Expected: PASS (all — the existing 9 cases plus the 2 new ones, 11 total)

- [ ] **Step 5: Run the full frontend suite to confirm no regression**

Run: `npx vitest run`
Expected: all existing tests still PASS (93 from before this plan, now 95 with this task's 2 new cases).

- [ ] **Step 6: Typecheck and lint**

Run: `npm run typecheck` and `npm run lint`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/http.ts frontend/tests/http-auth.test.ts
git commit -m "feat(frontend): support FormData bodies in authHttp for media uploads"
```

---

### Task 2: Media types and API wrapper

**Files:**
- Create: `frontend/src/types/media.ts`
- Create: `frontend/src/api/media.ts`
- Test: `frontend/tests/api-media.test.ts`

**Interfaces:**
- Consumes: `authHttp` from `../api/http` (Task 1's `FormData` support).
- Produces: `MediaFolder` (`"general" | "categories" | "products" | "staff" | "customers"`), `SafeMedia { path: string; url: string; folder: string; mimeType: string; sizeBytes: number; originalName: string }` (`types/media.ts`); `uploadMedia(file: File, folder: MediaFolder): Promise<SafeMedia>`, `deleteMedia(path: string): Promise<void>` (`api/media.ts`) — these are what Task 3's `ImageUploadField.vue` consumes.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/api-media.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { deleteMedia, uploadMedia } from "../src/api/media";

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("media api", () => {
  it("uploadMedia posts a FormData file to the folder-scoped endpoint and returns the media", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        success: true,
        message: "Image uploaded successfully.",
        data: {
          media: {
            path: "/uploads/media/products/abc.png",
            url: "/uploads/media/products/abc.png",
            folder: "products",
            mimeType: "image/png",
            sizeBytes: 1234,
            originalName: "photo.png",
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["content"], "photo.png", { type: "image/png" });
    const media = await uploadMedia(file, "products");

    expect(media.path).toBe("/uploads/media/products/abc.png");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/media?folder=products");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBe(file);
    expect(init.headers["Content-Type"]).toBeUndefined();
  });

  it("deleteMedia sends the path in a DELETE request body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { success: true, message: "Image deleted successfully." }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await deleteMedia("/uploads/media/products/abc.png");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/media");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body as string)).toEqual({ path: "/uploads/media/products/abc.png" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api-media.test.ts`
Expected: FAIL — `Cannot find module '../src/api/media'`

- [ ] **Step 3: Write `src/types/media.ts`**

```ts
// frontend/src/types/media.ts
export type MediaFolder = "general" | "categories" | "products" | "staff" | "customers";

export type SafeMedia = {
  path: string;
  url: string;
  folder: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
};
```

- [ ] **Step 4: Write `src/api/media.ts`**

```ts
// frontend/src/api/media.ts
import { authHttp } from "./http";
import type { MediaFolder, SafeMedia } from "../types/media";

export function uploadMedia(file: File, folder: MediaFolder): Promise<SafeMedia> {
  const formData = new FormData();
  formData.append("file", file);
  return authHttp.post<{ media: SafeMedia }>(`/media?folder=${folder}`, formData).then((result) => result.media);
}

export function deleteMedia(path: string): Promise<void> {
  return authHttp.delete<void>("/media", { body: { path } });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/api-media.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Run the full suite, typecheck, lint**

Run: `npx vitest run`, `npm run typecheck`, `npm run lint` — all clean.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/media.ts frontend/src/api/media.ts frontend/tests/api-media.test.ts
git commit -m "feat(frontend): add media types and upload/delete API wrapper"
```

---

### Task 3: `ImageUploadField.vue` component

**Files:**
- Create: `frontend/src/components/domain/ImageUploadField.vue`
- Test: `frontend/tests/image-upload-field.test.ts`

**Interfaces:**
- Consumes: `uploadMedia`, `deleteMedia` from `../../api/media` (Task 2); `resolveMediaUrl` from `../../utils/media-url` (existing, Foundation); `toUserSafeErrorMessage` from `../../utils/error-message` (existing, Foundation); `MediaFolder` from `../../types/media` (Task 2).
- Produces: `ImageUploadField.vue` with props `modelValue: string | null`, `folder: MediaFolder`, `label?: string`; emits `"update:modelValue": [path: string | null]`. This is the component every later Admin phase (Catalog, Tables, Staff, Customer forms) mounts via `v-model="form.imagePath"` with the appropriate `folder`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/image-upload-field.test.ts
import { mount, flushPromises } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import ImageUploadField from "../src/components/domain/ImageUploadField.vue";

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

function selectFile(wrapper: ReturnType<typeof mount>, file: File): Promise<void> {
  const input = wrapper.find('[data-test="file-input"]');
  Object.defineProperty(input.element, "files", { value: [file], configurable: true });
  return input.trigger("change");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ImageUploadField", () => {
  it("uploads a valid file and emits the returned path", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(201, {
        success: true,
        message: "ok",
        data: { media: { path: "/uploads/media/products/new.png", url: "/uploads/media/products/new.png" } },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ImageUploadField, { props: { modelValue: null, folder: "products" } });
    const file = new File(["content"], "photo.png", { type: "image/png" });
    await selectFile(wrapper, file);
    await flushPromises();

    expect(wrapper.emitted("update:modelValue")).toEqual([["/uploads/media/products/new.png"]]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a file that is too large without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ImageUploadField, { props: { modelValue: null, folder: "products" } });
    const oversized = new File([new Uint8Array(6 * 1024 * 1024)], "big.png", { type: "image/png" });
    await selectFile(wrapper, oversized);
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toMatch(/5MB/);
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("rejects a file with a disallowed type without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ImageUploadField, { props: { modelValue: null, folder: "products" } });
    const badType = new File(["content"], "doc.pdf", { type: "application/pdf" });
    await selectFile(wrapper, badType);
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toMatch(/JPEG, PNG, WebP, and GIF/);
  });

  it("deletes the previous image after a successful replace", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(201, {
          success: true,
          message: "ok",
          data: { media: { path: "/uploads/media/products/new.png", url: "/uploads/media/products/new.png" } },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { success: true, message: "deleted" }));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ImageUploadField, {
      props: { modelValue: "/uploads/media/products/old.png", folder: "products" },
    });
    const file = new File(["content"], "photo.png", { type: "image/png" });
    await selectFile(wrapper, file);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [deleteUrl, deleteInit] = fetchMock.mock.calls[1];
    expect(deleteUrl).toContain("/media");
    expect(deleteInit.method).toBe("DELETE");
    expect(JSON.parse(deleteInit.body as string)).toEqual({ path: "/uploads/media/products/old.png" });
    expect(wrapper.emitted("update:modelValue")).toEqual([["/uploads/media/products/new.png"]]);
  });

  it("clicking Remove deletes the current image and emits null", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, { success: true, message: "deleted" }));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ImageUploadField, {
      props: { modelValue: "/uploads/media/products/old.png", folder: "products" },
    });
    await wrapper.find('[data-test="remove"]').trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("update:modelValue")).toEqual([[null]]);
  });

  it("shows an inline error and leaves modelValue untouched when the upload fails", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(400, { success: false, message: "Image must be 5MB or smaller.", error: { code: "MEDIA_TOO_LARGE" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ImageUploadField, { props: { modelValue: null, folder: "products" } });
    const file = new File(["content"], "photo.png", { type: "image/png" });
    await selectFile(wrapper, file);
    await flushPromises();

    expect(wrapper.text()).toContain("Image must be 5MB or smaller.");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/image-upload-field.test.ts`
Expected: FAIL — component not found.

- [ ] **Step 3: Write `src/components/domain/ImageUploadField.vue`**

```vue
<!-- frontend/src/components/domain/ImageUploadField.vue -->
<script setup lang="ts">
import { computed, ref } from "vue";

import { deleteMedia, uploadMedia } from "../../api/media";
import type { MediaFolder } from "../../types/media";
import { toUserSafeErrorMessage } from "../../utils/error-message";
import { resolveMediaUrl } from "../../utils/media-url";

const props = defineProps<{ modelValue: string | null; folder: MediaFolder; label?: string }>();
const emit = defineEmits<{ "update:modelValue": [path: string | null] }>();

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;

const uploading = ref(false);
const error = ref<string | null>(null);

const previewUrl = computed(() => resolveMediaUrl(props.modelValue));

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) {
    return;
  }

  error.value = null;

  if (!ALLOWED_TYPES.includes(file.type)) {
    error.value = "Only JPEG, PNG, WebP, and GIF images are allowed.";
    return;
  }
  if (file.size > MAX_BYTES) {
    error.value = "Image must be 5MB or smaller.";
    return;
  }

  const previousPath = props.modelValue;
  uploading.value = true;
  try {
    const media = await uploadMedia(file, props.folder);
    if (previousPath) {
      try {
        await deleteMedia(previousPath);
      } catch {
        // Best-effort cleanup of the replaced file; the new image is already attached.
      }
    }
    emit("update:modelValue", media.path);
  } catch (caught) {
    error.value = toUserSafeErrorMessage(caught);
  } finally {
    uploading.value = false;
  }
}

async function onRemove(): Promise<void> {
  const currentPath = props.modelValue;
  if (!currentPath) {
    return;
  }
  try {
    await deleteMedia(currentPath);
  } catch {
    // Best-effort cleanup; the reference is cleared below regardless.
  }
  emit("update:modelValue", null);
}
</script>

<template>
  <div class="rounded-2xl border border-bz-border bg-white p-4">
    <label v-if="label" class="text-sm font-semibold text-bz-ink-900">{{ label }}</label>

    <div v-if="previewUrl" class="mt-2 flex items-center gap-3">
      <img :src="previewUrl" alt="" class="h-16 w-16 rounded-xl object-cover" />
      <button
        type="button"
        data-test="remove"
        class="rounded-full border border-bz-border px-3 py-1.5 text-sm font-medium text-bz-ink-700"
        @click="onRemove"
      >
        Remove
      </button>
    </div>

    <input
      type="file"
      data-test="file-input"
      accept="image/jpeg,image/png,image/webp,image/gif"
      class="mt-2 block w-full text-sm text-bz-ink-700"
      :disabled="uploading"
      @change="onFileChange"
    />

    <p v-if="uploading" class="mt-2 text-xs text-bz-ink-500">Uploading...</p>
    <p v-if="error" class="mt-2 text-xs text-bz-red">{{ error }}</p>
  </div>
</template>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/image-upload-field.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Run the full suite, typecheck, lint**

Run: `npx vitest run`, `npm run typecheck`, `npm run lint` — all clean.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/domain/ImageUploadField.vue frontend/tests/image-upload-field.test.ts
git commit -m "feat(frontend): add reusable ImageUploadField component"
```

---

### Task 4: Final regression pass

**Files:** none created — verification only.

- [ ] **Step 1: Run the full frontend suite**

Run (from `frontend/`): `npm run typecheck && npm run lint && npm run test`
Expected: all clean, all tests passing (95 from before this plan's Task 1 additions, plus this plan's own 2 + 2 + 6 = 10 new tests — 103 total; exact count may differ slightly if the pre-existing suite size has changed, but zero failures is the requirement).

- [ ] **Step 2: Confirm no backend changes were made**

Run: `git diff --stat main -- backend/` (or equivalent against the branch's base) — expected: no output. This plan is frontend-only; the media backend module was already complete.

- [ ] **Step 3: Commit (if the above surfaced any fix)**

Only if Step 1 or Step 2 found something to correct — otherwise no commit needed for this task.

---

## Self-Review

**Spec coverage:** FormData support in `authHttp` ✅ (Task 1); `SafeMedia`/`MediaFolder` types + `uploadMedia`/`deleteMedia` API wrapper ✅ (Task 2); `ImageUploadField.vue` with preview/upload/remove/replace/error states ✅ (Task 3); client-side type/size validation mirroring backend constants ✅ (Task 3); best-effort delete-on-replace and delete-on-remove, never blocking or surfacing errors ✅ (Task 3); no Admin screen/nav/backend changes — correctly out of scope, not overlooked.

**Placeholder scan:** no TBD/TODO, no "similar to Task N" without code, every step has complete runnable code.

**Type consistency:** `SafeMedia` (Task 2) fields match exactly what Task 3's `ImageUploadField.vue` reads (`media.path`). `MediaFolder` (Task 2) is the same union type used in Task 3's props. `uploadMedia`/`deleteMedia` signatures (Task 2) match exactly how Task 3 calls them.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-21-admin-media-upload-foundation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
