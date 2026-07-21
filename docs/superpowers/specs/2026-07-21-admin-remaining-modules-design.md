# Admin Remaining Modules — Design

## Context

The admin nav shell + dashboard slice (previous plan) left 11 modules as
"Coming soon" placeholders: Staff, Customers, Tables/QR, Categories,
Products, Stock, Media, Settings, Orders, Cancellations, Payments. All
backend modules for these already exist and are complete except one gap
(Media has no list endpoint — see below). This design covers building all
11 as real, working admin screens.

Given the scale (11 modules), this plan uses **module-level tasks** rather
than per-file tasks: each task specifies exact API contracts, exact test
cases, and points to an existing sibling component as the structural
pattern to follow (e.g. "list+detail like `staff/OrderQueueView.vue` +
`staff/OrderDetailView.vue`") rather than embedding full template code for
every one of ~40 new files. Sibling components are complete, reviewed,
readable references — this is a completeness trade appropriate to a
10x-larger-than-usual slice, not a placeholder.

## Shared conventions (apply to every module below)

- **Routing:** each module's placeholder route in `router/index.ts` gets its
  `component:` swapped from `ComingSoonView.vue` to the real list view;
  `props: () => ({ title: ... })` is removed since the real view doesn't
  need it. Detail/sub-routes (e.g. table QR detail) are **not** separate
  routes — kept as in-page state (dialog/expanded row) to avoid growing the
  route table further. Exception: none needed, all 11 fit as single-route
  screens with dialogs for create/edit/detail.
- **List screens:** header with title + search/filter input(s) + "+ New"
  button, `LoadingState`/`ErrorState`/`EmptyState` per existing convention,
  a list of rows (card style matching `StaffOrderCard.vue`'s density, not a
  dense HTML `<table>` — consistent with the rest of the app's card-based
  UI), each row showing key fields + a status badge where relevant + action
  buttons.
- **Create/Edit:** a shared new `AdminFormDialog.vue` wrapper component
  (title + slot for fields + Save/Cancel, loading + inline field-error
  display) — one new reusable component instead of 5 near-identical modal
  shells. Individual field markup lives in each module's own form content
  (not generalized — forms differ too much to share beyond the shell).
- **Destructive/reason-required actions** (deactivate, cancel, reverse,
  force-release): reuse existing `ReasonConfirmationDialog.vue` /
  `ActionConfirmationDialog.vue` exactly as-is.
- **API wrappers:** new files under `frontend/src/api/admin-*.ts`, all using
  `authHttp`, following the exact shape of `frontend/src/api/admin-payments.ts`
  (thin functions returning typed promises, no client-side business logic).
- **Types:** new files under `frontend/src/types/*.ts` mirroring backend
  `Safe*` shapes exactly (dates as `string`, matching every existing type
  file's convention).
- **Tests:** flat files under `frontend/tests/`, named `admin-<module>-*.test.ts`,
  following the mocking/mounting conventions already used throughout (see
  `frontend/tests/admin-dashboard-view.test.ts`, `frontend/tests/staff-order-detail.test.ts`).
- **No backend changes** except the one Media addition below.

## Per-module specs

### 1. Settings (`admin.settings`)
Real-time editable form: tax rate %, service charge % (both `number,
0-100`). `PATCH /settings` (ADMIN). Add `updateSettings(input)` to
`frontend/src/api/settings.ts`. Screen: load current values into a form
(reuse the read display style from `staff/SettingsView.vue`), Save button
calls update, shows success/error inline, no dialog needed (whole screen
is the form).

### 2. Staff (`admin.staff`)
List (search by name/email, filter by active/inactive) + create/edit dialog
+ deactivate (via `ReasonConfirmationDialog`? — no, status toggle has no
reason field per backend, use a plain confirm) + password reset action
(separate small dialog, password field only). Endpoints: `GET/POST/PATCH
/staff`, `PATCH /staff/:id/status`, `PATCH /staff/:id/password`. New
`frontend/src/types/staff.ts` (`SafeStaff`) and `frontend/src/api/admin-staff.ts`.

### 3. Customers (`admin.customers`)
List (search/phone lookup, reuse `searchCustomers` already in
`staff-customers.ts`) + create/edit dialog + detail view (inline expand,
not a route) showing `CustomerFinancialSummary`. Add
`getCustomerRecord`/`createCustomerRecord`/`updateCustomerRecord` to
`staff-customers.ts` (existing file, customer-domain despite its name —
do not rename, out of scope). `frontend/src/types/customer.ts` already
complete, reuse as-is.

### 4. Tables & QR (`admin.tables`)
List (tableNumber, name, capacity, derived `status` badge) + create/edit
dialog + status toggle (AVAILABLE/OUT_OF_SERVICE) + per-row "View QR"
(shows `qrImageUrl` + regenerate button) + release/force-release (force
uses `ReasonConfirmationDialog`). New `frontend/src/types/table.ts` and
`frontend/src/api/admin-tables.ts` covering all 9 routes listed in the
research.

### 5. Categories (`admin.categories`)
List (name, product count not available from API — omit) + create/edit
dialog (name, description, image via existing `ImageUploadField`,
displayOrder) + visibility toggle + delete (blocked server-side with
`CATEGORY_HAS_PRODUCTS` — surface that error message plainly via
`toUserSafeErrorMessage`, no special client-side pre-check). New
`frontend/src/types/category.ts` and `frontend/src/api/admin-categories.ts`.

### 6. Products (`admin.products`)
List (name, category, price, availability badge) + create/edit dialog
(all `CreateProduct`/`UpdateProduct` fields, category picked from a
`<select>` populated by `admin-categories.ts`'s list call, image via
`ImageUploadField`) + availability toggle + delete (same
`PRODUCT_HAS_ORDER_ITEMS` pattern as categories). Add
`getAdminProduct/createProduct/updateProduct/updateProductStatus/deleteProduct`
to `frontend/src/api/admin-products.ts` (already has list).
`frontend/src/types/product.ts` already complete.

### 7. Stock (`admin.stock`)
A **distinct lens on Product data**, not duplicate CRUD: lists all
products with `stockQuantity`/`availableQuantity`/`lowStockThreshold`,
highlights rows where `availableQuantity <= lowStockThreshold` (same rule
as the dashboard tile), each row has an "Adjust" button opening a small
dialog for `{ quantityDelta, reason }` → `PATCH /products/:id/stock`. Add
`adjustProductStock(productId, input)` to `admin-products.ts`. Reuses the
same `listAdminProducts()` call as the Products screen — no new list
endpoint.

### 8. Media (`admin.media`)
**Backend addition required** (the only one in this slice): add
`GET /api/v1/media?folder=X` to `backend/src/modules/media/` — lists files
present on disk under `public/uploads/media/<folder>/` as
`SafeMedia[]` (reusing the existing folder-validation and `SafeMedia`
shaping already used by upload). ADMIN+STAFF authorized, matching the
existing upload/delete routes. Frontend: a folder-tab switcher (General/
Categories/Products/Staff/Customers) + a grid of thumbnails with a delete
button per item (reuses `deleteMedia` already in `media.ts`). Add
`listMedia(folder)` to `frontend/src/api/media.ts`.

### 9. Orders (`admin.orders`)
Full oversight list + detail, structurally identical to
`staff/OrderQueueView.vue` + `staff/OrderDetailView.vue` (same filters,
same status actions: accept/reject/start-preparing/mark-ready/mark-served),
**plus** a Cancel action (ADMIN-only) visible when status is
ACCEPTED/PREPARING/READY, using `ReasonConfirmationDialog` calling the new
`cancelOrder(orderId, reason)` wrapper (add to `staff-orders.ts` — it's
already the shared orders API file, reused by admin per the design's
"reuse `staff-orders.ts`" note from research). Import the queue/detail
views under `views/admin/` rather than literally reusing the staff ones
(different route/layout context), but copy their structure closely.

### 10. Cancellations (`admin.cancellations`)
Read-only audit list: `listStaffOrders({ status: CANCELLED })`, shows
order number, table/takeaway, cancellation reason, cancelledAt, total —
no actions (the order is terminal). One screen, no dialogs.

### 11. Payments (`admin.payments`)
List all payments (`listAdminPayments`, already exists) with method/amount/
status/reference, each row has a "Reverse" action (`ReasonConfirmationDialog`
→ new `reversePayment(paymentId, reason)`) disabled when already voided.
Separately, a "Record Payment" entry point: pick an order from a dropdown
of SERVED+unpaid orders (fetched via `listStaffOrders({ status: SERVED })`
filtered client-side to `remainingAmount > 0`), then amount/method/
reference form → new `recordPayment(orderId, input)`. Add
`getPayment/listOrderPayments/recordPayment/reversePayment` to
`admin-payments.ts`.

## Self-review

**Placeholder scan:** every module has exact routes, exact request/response
field names (from the research pass), and an exact structural reference
(existing component to mirror) — no "TBD" or vague "implement CRUD" left.

**Scope check:** 11 modules is inherently large; grouped as one design
because they share every convention above and the plan will execute them
as 11 sequential module-level tasks in one plan document (still
individually testable/reviewable, per the writing-plans skill's task
right-sizing — "a whole module" is the natural unit here given the scale).

**Consistency:** every module confirmed against the actual backend research
(routes/roles/validation schemas), not assumed. The one backend change
(Media list endpoint) is called out explicitly and scoped minimally
(read-only, reuses existing validation/shaping, no new persistence).
