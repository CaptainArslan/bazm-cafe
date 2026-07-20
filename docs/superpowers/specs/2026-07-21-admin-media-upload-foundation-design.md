# Admin Foundation: Media/Image-Upload Plumbing — Design

**Status:** Approved by user, ready for implementation planning
**Depends on:** Foundation plan (`docs/superpowers/plans/2026-07-20-bazm-foundation.md`, merged) — `authHttp`, `configureAuthIntegration`, `resolveMediaUrl`, `toUserSafeErrorMessage` all already exist.
**Backend contract:** `docs/BAZM_BACKEND_ARCHITECTURE_CONTRACT.md` §"Approved image packages"; routes in `backend/src/modules/media/media.routes.ts`.

## 1. Purpose

This is the first of five Admin sub-projects (Foundation → Catalog → Tables/QR → Staff & Customer management → Orders/Payments/Settings). It exists because every later Admin phase needs to attach an optional image to an entity (product, category, staff member, customer), and today `authHttp` cannot send `multipart/form-data` — it always JSON-serializes the request body. Building this once, now, avoids reimplementing upload plumbing four more times.

This spec covers ONLY: FormData support in the HTTP client, the media API wrapper, and one reusable `ImageUploadField.vue` component. It does not touch any Admin screen, nav, or route — those come in later phases, each wiring this component into its own form.

## 2. Backend contract (reference, unchanged)

- `POST /api/v1/media?folder={general|categories|products|staff|customers}` — multipart, single field `file`. Allowed types: JPEG/PNG/WebP/GIF. Max 5MB. Requires `ADMIN` or `STAFF` role (already covered by existing auth). Response: `{ media: SafeMedia }`.
- `DELETE /api/v1/media` — JSON body `{ path: string }`. Response: success envelope, no data.
- `SafeMedia = { path: string; url: string; folder: string; mimeType: string; sizeBytes: number; originalName: string }`.

## 3. Architecture

Two layers:

1. **`authHttp` FormData support** (`frontend/src/api/http.ts`): the internal `request()` function currently always does `JSON.stringify(body)` and sets `Content-Type: application/json` whenever `body !== undefined`. Add a branch: when `body instanceof FormData`, skip both `JSON.stringify` and the `Content-Type` header (the browser sets the correct `multipart/form-data; boundary=...` header itself when given a `FormData` body — setting `Content-Type` manually would break the boundary). No new export is needed; `authHttp.post<T>(path, formData)` already accepts `unknown` for `body`, so passing a `FormData` instance works once `request()` special-cases it. This is a pure addition — every existing JSON call path is unaffected (verified by the existing `http-auth.test.ts` / `api-auth.test.ts` suites continuing to pass unchanged).
2. **Media API wrapper + component**: `frontend/src/api/media.ts` wraps the two endpoints; `frontend/src/components/domain/ImageUploadField.vue` is the one reusable UI piece every later Admin form mounts via `v-model`.

## 4. Interfaces

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

```ts
// frontend/src/api/media.ts
export function uploadMedia(file: File, folder: MediaFolder): Promise<SafeMedia>;
// builds a FormData with field "file", posts to `/media?folder=${folder}` via authHttp.post

export function deleteMedia(path: string): Promise<void>;
// authHttp.delete("/media", { body: { path } }) — DELETE with a JSON body (existing RequestOptions already supports a body on delete)
```

```vue
<!-- frontend/src/components/domain/ImageUploadField.vue -->
<script setup lang="ts">
defineProps<{ modelValue: string | null; folder: MediaFolder; label?: string }>();
defineEmits<{ "update:modelValue": [path: string | null] }>();
</script>
```

Consumes: `uploadMedia`, `deleteMedia` (this spec); `resolveMediaUrl` (existing, Foundation); `toUserSafeErrorMessage` (existing, Foundation).

## 5. Behavior & error handling

- **Client-side pre-validation** on file selection, before any network call: reject (inline error, no upload attempt) if `file.type` is not one of `image/jpeg|png|webp|gif`, or `file.size > 5 * 1024 * 1024` — mirrors the backend's own limits so obviously-bad files never round-trip.
- **Select a valid file** → `uploading = true` → `uploadMedia(file, folder)` → on success: if `modelValue` was previously set, fire `deleteMedia(oldPath)` **best-effort** (its own try/catch; failure is swallowed, never surfaced to the user, never blocks emitting the new value) → emit `update:modelValue` with the new path → `uploading = false`.
- **Remove button** (visible only when `modelValue` is set) → best-effort `deleteMedia(modelValue)` (same swallow-on-failure rule) → emit `update:modelValue` with `null` regardless of delete outcome.
- **Upload failure** (network/validation/size error from the server) → `error = toUserSafeErrorMessage(caught)`, shown inline below the field; `modelValue` unchanged; file input re-enabled for retry; `uploading = false`.
- The component has no internal "cancel in-flight upload" concept — YAGNI for a single-file admin form field; if a second upload starts before the first resolves the file input should be disabled while `uploading` is true, which already prevents this.

## 6. Testing

- `frontend/tests/api-media.test.ts` — `uploadMedia` sends a `FormData` with a `file` entry to `/media?folder=products` (and other folders) and returns the parsed `SafeMedia`; `deleteMedia` sends `DELETE /media` with `{ path }` in the body.
- `frontend/tests/image-upload-field.test.ts` — mounts the component with a mocked global `fetch`:
  - selecting a valid file uploads it and emits the returned path
  - selecting a file that's too large / wrong type shows an inline error without calling `fetch`
  - replacing an existing image (component already has a `modelValue`) calls delete on the old path after the new upload succeeds
  - clicking Remove calls delete and emits `null`
  - a server-side upload failure shows `toUserSafeErrorMessage` output and leaves `modelValue` untouched
- `frontend/tests/http-auth.test.ts` (existing file, extended) — a new case confirming a `FormData` body on `authHttp.post` is sent without a `Content-Type` header and without being JSON-stringified (assert the raw `FormData` instance reaches `fetch`'s `init.body`), and confirms existing JSON-body cases are unaffected.

## 7. Out of scope (deferred to later Admin phases)

- Any screen that uses this component (Product/Category/Staff/Customer forms) — those are Phases 2–4.
- Admin nav/routing changes — none needed for this phase (confirmed with user: incremental nav per phase, matching the Staff plan's pattern).
- Server-side changes — the media module is already fully implemented.
