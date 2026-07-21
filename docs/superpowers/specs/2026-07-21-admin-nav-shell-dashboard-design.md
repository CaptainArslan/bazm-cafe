# Admin Nav Shell + Dashboard — Design

## Context

The admin frontend currently has only a login screen and a placeholder home
(`frontend/src/views/admin/HomePlaceholder.vue`) with a one-line "coming next"
message. The backend already has 15 complete modules (auth, staff, customers,
media, tables, categories, products, stock fields on products, settings,
guest-sessions, orders, payments, receipts, audit, kitchen-placeholder) that
the admin app needs to expose. Building the whole admin app in one shot is too
large for a single plan, so this is the **first slice**: a real navigation
shell and a live dashboard home. Each subsequent module (staff, customers,
tables/QR, catalog, media, settings, orders, cancellations, payments) becomes
its own design + plan, reusing this shell.

This is a frontend-only change. No backend endpoints are added or modified.

## Scope of this slice

1. Replace `AdminLayout.vue`'s thin top bar with a responsive nav shell
   (sidebar on desktop/tablet, drawer on mobile) listing all eventual admin
   modules.
2. Replace `HomePlaceholder.vue` with a real dashboard showing four live
   stats tiles.
3. Add a reusable "coming soon" placeholder view for modules not yet built,
   wired to a route per module so the nav is fully clickable today.

Out of scope: any actual staff/customer/table/catalog/media/settings/order/
payment CRUD screens — those are future slices.

## Navigation shell

**Layout:** `AdminLayout.vue` becomes a two-region shell:
- A sidebar (`<aside>`), fixed on the left for viewports ≥768px (Tailwind
  `md:` breakpoint), containing the BAZM Admin brand, the grouped nav list,
  and a sign-out button pinned at the bottom.
- Below `md:`, the sidebar becomes an off-canvas drawer: a top bar with the
  brand and a hamburger button, and the same nav list slides in as an
  overlay when opened, closing on link click or outside-tap.
- `<RouterView />` renders in the remaining content area in both cases.

**Nav groups and routes** (all under `/admin`, `meta: { role: "ADMIN" }`):

| Group | Label | Route name | Path | This slice |
|---|---|---|---|---|
| — | Dashboard | `admin.home` | `/admin` | ✅ real |
| Operations | Orders | `admin.orders` | `/admin/orders` | placeholder |
| Operations | Cancellations | `admin.cancellations` | `/admin/cancellations` | placeholder |
| Operations | Payments | `admin.payments` | `/admin/payments` | placeholder |
| Catalog | Categories | `admin.categories` | `/admin/categories` | placeholder |
| Catalog | Products | `admin.products` | `/admin/products` | placeholder |
| Catalog | Stock | `admin.stock` | `/admin/stock` | placeholder |
| Catalog | Media | `admin.media` | `/admin/media` | placeholder |
| People | Customers | `admin.customers` | `/admin/customers` | placeholder |
| People | Staff | `admin.staff` | `/admin/staff` | placeholder |
| — | Tables & QR | `admin.tables` | `/admin/tables` | placeholder |
| — | Settings | `admin.settings` | `/admin/settings` | placeholder |

The active route's nav link gets a visual highlight (matching the existing
`bz-gold` accent used elsewhere, e.g. `staff.settings` link styling).

**Placeholder view:** a single reusable `ComingSoonView.vue` component takes
a `title` prop (e.g. "Staff") and renders a centered "Coming soon" message.
Each placeholder route passes its label via route `props`/`meta` rather than
one file per module, avoiding nine near-identical stub files.

## Dashboard

`AdminDashboardView.vue` (replaces `HomePlaceholder.vue`) fetches on mount
and renders four stat tiles, following the existing loading/error pattern
used in `staff/SettingsView.vue` (`LoadingState` / `ErrorState` with retry):

1. **Today's Orders** — count of orders with `createdAt` within the local
   calendar day, any status. Source: `GET /orders` (existing
   `listStaffOrders()` in `frontend/src/api/staff-orders.ts` — ADMIN is
   already authorized on this route).
2. **Needs Attention** — current count of orders with `orderStatus` `PENDING`
   or `ACCEPTED` (not date-filtered — this is "what's outstanding right
   now"). Same source as above.
3. **Today's Revenue** — sum of `amount` for payments with `status ===
   "COMPLETED"`, `voidedAt === null`, and `createdAt` within the local
   calendar day. Source: new `frontend/src/api/admin-payments.ts` wrapper
   calling `GET /payments` (ADMIN-only, not currently wrapped anywhere).
4. **Low Stock** — count of products where
   `stockQuantity - reservedQuantity <= lowStockThreshold`. Source: new
   `frontend/src/api/admin-products.ts` wrapper calling `GET /products`
   (ADMIN-only, not currently wrapped anywhere).

All three list calls happen in parallel (`Promise.all`) on mount; a single
loading state covers all of them, a single error state (with retry) covers
any of them failing. "Today" is computed from the browser's local time —
acceptable for a single-location cafe.

**Accepted tradeoff:** none of `GET /orders`, `GET /payments`, or
`GET /products` support server-side date filtering or pagination, so each
dashboard load fetches the full history/catalog and aggregates client-side.
Fine at this cafe's current data volume; a dedicated backend stats endpoint
is a future option if it becomes slow, not part of this slice.

## Data flow

```
AdminDashboardView.onMounted
  → Promise.all([
      listStaffOrders() → orders: SafeOrder[]
      listAdminPayments() → payments: SafePayment[]   (new)
      listAdminProducts() → products: SafeProduct[]   (new)
    ])
  → compute 4 tile values client-side from the three arrays
  → render tiles, or ErrorState on any rejection
```

`SafePayment` and `SafeProduct` types are added to `frontend/src/types/`
mirroring the backend's `SafeOrder` pattern (only the fields the dashboard
and future modules need: for payments — `amount`, `status`, `voidedAt`,
`createdAt`, `orderId`; for products — `id`, `name`, `stockQuantity`,
`reservedQuantity`, `lowStockThreshold`).

## Error handling

- Network/auth failures on any of the three dashboard fetches surface through
  the existing `toUserSafeErrorMessage()` utility into a single `ErrorState`
  with a retry button that re-runs all three fetches.
- No new error cases beyond what `authHttp` already handles (401 → redirect
  via router guard, since `admin.home` already requires `role: "ADMIN"`).

## Testing

Following the existing Vitest + Vue Test Utils pattern used for
`staff/SettingsView.spec.ts` and `ImageUploadField.spec.ts`:

- `admin-payments.spec.ts` / `admin-products.spec.ts` — API wrapper tests
  mocking `authHttp`, verifying the request path and response typing (2
  tests each, mirroring `media.spec.ts`'s structure).
- `AdminDashboardView.spec.ts` — mounts the view with mocked API modules,
  asserts: loading state shows first, tiles render correct computed values
  given fixture data (including today-vs-not-today date edge cases and the
  low-stock boundary), error state shows and retry re-fetches on failure.
- `AdminLayout.spec.ts` (or nav-specific test) — asserts all 11 nav links
  are present and point to the correct route names, drawer opens/closes on
  mobile breakpoint interaction, active link gets the highlight class.
- `ComingSoonView.spec.ts` — renders the passed title.
- Router test addition: new placeholder routes resolve and require
  `role: "ADMIN"` like existing admin routes.

## Self-review

**Placeholder scan:** none — every section has concrete field names, route
names, and file paths.

**Scope check:** frontend-only, one layout + one view + one shared
placeholder component + two new API wrappers + two new types. Sized similarly
to the earlier media-upload-foundation slice; appropriate for a single
implementation plan.

**Consistency:** nav route table matches the module list confirmed with the
user; dashboard tile definitions match what was confirmed; no module CRUD
screens are implied or half-built.
