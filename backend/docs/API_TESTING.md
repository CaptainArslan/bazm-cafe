# BAZM Cafe Backend — Postman & API testing

Complete reference for local testing against the running API (`/api/v1`).

## Import into Postman

1. Open Postman → **Import**
2. Import both files:
   - `docs/postman/BAZM_Cafe_Backend.postman_collection.json`
   - `docs/postman/BAZM_Cafe_Backend.local.postman_environment.json`
3. Select environment **BAZM Cafe Backend** (top-right)
4. Start API: `npm run dev`
5. Ensure admin exists: `npm run db:seed`

## Database setup & refresh

| Goal | Commands (from `backend/`) |
|------|----------------------------|
| First-time setup | `npx prisma generate` → `npx prisma migrate deploy` → `npm run db:seed` |
| Apply new migrations (keep data) | `npx prisma migrate deploy` |
| Wipe DB and retest from scratch | `npx prisma migrate reset --force` → `npm run db:seed` |
| Re-seed admin only | `npm run db:seed` |
| Migration status | `npx prisma migrate status` |
| Browse data | `npx prisma studio` |

**Seed credentials**

| Field | Value |
|-------|--------|
| Email | `admin@bazm.local` |
| Password | `password` |
| Role | `ADMIN` |

Seed also upserts cafe settings (tax / service charge default `0`). It does **not** seed staff, tables, categories, products, or orders.

**Never** run `migrate reset` against production.

## Environment variables (Postman)

| Variable | Purpose |
|----------|---------|
| `baseUrl` | `http://localhost:3000` |
| `adminEmail` / `adminPassword` | Seeded admin |
| `staffEmail` / `staffPassword` | Created by “Create staff” |
| `staffPasswordNew` | Used by “Reset staff password”; on success copied into `staffPassword` |
| `accessToken` | Filled by “Login admin” |
| `staffAccessToken` | Filled by “Login staff” |
| `staffId`, `customerId`, `tableId`, `tableNumber`, `categoryId`, `productId`, `orderId`, `paymentId`, `guestOrderId` | Auto-saved from create responses |
| `preparationMinutes` | Default product prep time for create/update examples (`15`) |
| `mediaPath` / `mediaUrl` | Category (or general) upload path/url |
| `productMediaPath` | Product upload path |
| `staffMediaPath` / `customerMediaPath` | Staff / customer upload paths |
| `tableToken` | Opaque QR secret for dine-in (see below) — **not** the table UUID |

Guest session cookie `bazm_guest_session` is HttpOnly. Postman stores it when you call **Create takeaway/dine-in session** in the same collection (cookie jar enabled).

## Images (optional)

1. `POST /api/v1/media?folder=staff|customers|categories|products|general` with form-data field **`file`** (JPEG/PNG/WebP/GIF, max 5MB).
2. Copy `data.media.path` (e.g. `/uploads/media/products/<file>.png`).
3. Pass it as optional `imagePath` on create/update for staff, customers, categories, or products.
4. Omit `imagePath`, or send `null` / `""`, to skip or clear.

Responses include both `imagePath` and absolute `imageUrl` (`{APP_URL}{imagePath}`).

Allowed folders: `general` · `categories` · `products` · `staff` · `customers`.

Media upload/delete: **ADMIN or STAFF**.

## Preparation time

- Set on product: `preparationMinutes` (integer 0–600, default `0`).
- Guest order response includes:
  - per item: `preparationTimeMinutesSnapshot`
  - order: `estimatedPreparationMinutes` (max of items) and `estimatedReadyAt` when set

## Dine-in `tableToken` (not table id)

| | **table id** | **tableToken** |
|--|--------------|----------------|
| What | Public UUID from create table | Long opaque QR secret |
| Storage | `tables.uuid` | Only **hash** in DB (`qr_token_hash`) |
| Used for | Admin CRUD `/tables/:tableId` | Guest dine-in session + resolve |
| Returned by APIs? | Yes | **No** — create/get QR never returns the raw token |

QR image encodes: `{FRONTEND_URL}/dine-in?t=<tableToken>`.

For Postman dine-in tests:

```bash
npm run postman:table
```

Copy printed `tableId` / `tableNumber` / `tableToken` into the environment.

`POST /guest/tables/resolve` only looks up the table from `tableToken` — it does **not** start a session. Starting a session is `POST /guest/sessions` with `orderType: "DINE_IN"` and the same `tableToken`.

## Recommended manual flow

1. **01 Auth → Login admin**
2. **01b Settings → Get / update rates** (optional; defaults `0`)
3. **04b Media → Upload** images (optional) for staff/customer/category/product
4. **02 Staff → Create staff** (optional `imagePath`)
5. **03 Customers → Create customer** (optional `imagePath`)
6. **04 Tables → Create table** (+ `npm run postman:table` for dine-in)
7. **05 Categories → Create category** (optional `imagePath`)
8. **06 Products → Create product** with `preparationMinutes` (optional `imagePath`)
9. **07 Guest TAKEAWAY** → session → menu → create order  
   (or **08 Dine-in** with `tableToken`)
10. **09 Orders** → Accept → Start preparing → Mark ready → Attach customer → Mark served  
    (Skip Reject/Cancel unless testing those paths on a fresh PENDING order)
11. **10 Payments** → partial then remaining (order becomes COMPLETED when fully paid while SERVED)

## Automated tests

```bash
npm test
```

- `tests/unit/utils.node.test.ts` — money/slug/token helpers
- `tests/smoke/api.smoke.node.test.ts` — health, admin login (needs DB + seed)
- `tests/workflows/finalized.workflows.node.test.ts` — session/payment workflows

```bash
npm run test:unit
npm run test:smoke
npm run test:workflows
```

---

## Endpoint cheat sheet

**Auth legend**

| Label | Meaning |
|-------|---------|
| none | No auth |
| Bearer ADMIN | `Authorization: Bearer <accessToken>`, role `ADMIN` |
| Bearer ADMIN/STAFF | Bearer, role `ADMIN` or `STAFF` |
| guest cookie | HttpOnly `bazm_guest_session` |
| receipt cookie | HttpOnly `bazm_receipt_access` |
| refresh cookie | HttpOnly `bazm_refresh_token` |

### Public / health

| Method | Path | Auth | Body |
|--------|------|------|------|
| GET | `/api/v1/` | none | — |
| GET | `/api/v1/health` | none | — |
| POST | `/api/v1/auth/login` | none | `{ email, password, deviceName? }` |
| POST | `/api/v1/auth/refresh` | refresh cookie | — |
| POST | `/api/v1/guest/sessions` | none | TAKEAWAY: `{ orderType: "TAKEAWAY" }` · DINE_IN: `{ orderType: "DINE_IN", tableToken }` |
| POST | `/api/v1/guest/tables/resolve` | none | `{ tableToken }` |
| POST | `/api/v1/guest/sessions/recover` | none | `{ recoveryCode }` |

### Auth (logged-in user)

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/auth/me` | Bearer |
| POST | `/api/v1/auth/logout` | Bearer |
| POST | `/api/v1/auth/logout-all` | Bearer |

### Staff — Bearer ADMIN

| Method | Path | Body |
|--------|------|------|
| GET | `/api/v1/staff` | query: `search?`, `isActive?` |
| GET | `/api/v1/staff/:staffId` | — |
| POST | `/api/v1/staff` | `{ name, email, phone?, password, imagePath? }` |
| PATCH | `/api/v1/staff/:staffId` | `{ name?, email?, phone?, imagePath? }` |
| PATCH | `/api/v1/staff/:staffId/password` | `{ password }` (revokes staff sessions) |
| PATCH | `/api/v1/staff/:staffId/status` | `{ isActive }` |

Response includes `imagePath`, `imageUrl`.

### Customers — Bearer ADMIN/STAFF

| Method | Path | Body |
|--------|------|------|
| GET | `/api/v1/customers` | query: `search?`, `phone?` |
| GET | `/api/v1/customers/:customerId` | — |
| POST | `/api/v1/customers` | `{ name, phone?, imagePath? }` |
| PATCH | `/api/v1/customers/:customerId` | `{ name?, phone?, imagePath? }` |

Response includes `imagePath`, `imageUrl`.

### Media — Bearer ADMIN/STAFF

| Method | Path | Body / query |
|--------|------|----------------|
| POST | `/api/v1/media` | query `folder?` (default `general`); multipart **`file`** |
| DELETE | `/api/v1/media` | `{ path }` under `/uploads/media/...` |

Upload returns `data.media`: `{ path, url, folder, mimeType, sizeBytes, originalName }`.

### Tables / QR — Bearer ADMIN

| Method | Path | Body |
|--------|------|------|
| GET | `/api/v1/tables` | — |
| GET | `/api/v1/tables/:tableId` | — |
| POST | `/api/v1/tables` | `{ tableNumber, name?, capacity? }` |
| PATCH | `/api/v1/tables/:tableId` | `{ tableNumber?, name?, capacity? }` |
| PATCH | `/api/v1/tables/:tableId/status` | `{ operationalStatus: "AVAILABLE"\|"OUT_OF_SERVICE", isActive? }` |
| GET | `/api/v1/tables/:tableId/qr-code` | — |
| POST | `/api/v1/tables/:tableId/qr-code/regenerate` | — |
| POST | `/api/v1/tables/:tableId/release` | — |
| POST | `/api/v1/tables/:tableId/force-release` | `{ reason }` |

Response includes `qrImagePath`, `qrImageUrl`, derived `status` (`AVAILABLE` \| `OCCUPIED` \| `OUT_OF_SERVICE`). Raw `tableToken` is never returned.

### Categories — Bearer ADMIN

| Method | Path | Body |
|--------|------|------|
| GET/POST/PATCH/DELETE | `/api/v1/categories`… | create: `{ name, description?, imagePath?, displayOrder?, isVisible? }` |
| PATCH | `/api/v1/categories/:categoryId/status` | `{ isVisible }` |

### Products — Bearer ADMIN

| Method | Path | Body |
|--------|------|------|
| GET/POST/PATCH/DELETE | `/api/v1/products`… | create includes `price`, `preparationMinutes?`, `imagePath?`, stock fields |
| PATCH | `/api/v1/products/:productId/status` | `{ isAvailable }` |
| PATCH | `/api/v1/products/:productId/stock` | `{ quantityDelta, reason }` |

Response includes `preparationMinutes`, `imagePath`, `imageUrl`, stock fields.

### Settings

| Method | Path | Auth | Body |
|--------|------|------|------|
| GET | `/api/v1/settings` | ADMIN/STAFF | — |
| PATCH | `/api/v1/settings` | ADMIN | `{ taxRatePercent?, serviceChargePercent? }` (0–100) |

### Guest (cookie `bazm_guest_session`)

| Method | Path | Body |
|--------|------|------|
| GET | `/api/v1/guest/sessions/current` | — |
| POST | `/api/v1/guest/sessions/close` | — (clears guest cookie; may set receipt cookie) |
| GET | `/api/v1/guest/menu` | — |
| POST | `/api/v1/guest/orders` | `{ items:[{ productId, quantity, notes? }], customerName?, customerPhone?, customerNotes? }` |
| GET | `/api/v1/guest/orders` | — |
| GET | `/api/v1/guest/orders/:orderPublicId` | — |
| GET | `/api/v1/guest/orders/:orderPublicId/receipt` | HTML |
| GET | `/api/v1/guest/orders/:orderPublicId/receipt-image` | — |

Order responses include `estimatedPreparationMinutes`, item `preparationTimeMinutesSnapshot`, tax/service amounts from settings.

### Guest sessions (staff) — Bearer ADMIN/STAFF

| Method | Path | Body |
|--------|------|------|
| POST | `/api/v1/guest-sessions/:sessionId/recovery-codes` | — → `{ recoveryCode, expiresAt }` |

### Receipts after close — cookie `bazm_receipt_access`

| Method | Path |
|--------|------|
| GET | `/api/v1/receipts/orders/:orderPublicId` |
| GET | `/api/v1/receipts/orders/:orderPublicId/image` |
| GET | `/api/v1/receipts/orders/:orderPublicId/summary` |

### Orders — Bearer ADMIN/STAFF (cancel ADMIN only)

| Method | Path | Body |
|--------|------|------|
| GET | `/api/v1/orders` | query: `status?`, `paymentStatus?` |
| GET | `/api/v1/orders/:orderId` | — |
| POST | `/api/v1/orders/:orderId/accept` | — |
| POST | `/api/v1/orders/:orderId/start-preparing` | — |
| POST | `/api/v1/orders/:orderId/mark-ready` | — |
| POST | `/api/v1/orders/:orderId/mark-served` | — |
| POST | `/api/v1/orders/:orderId/reject` | `{ reason }` |
| POST | `/api/v1/orders/:orderId/cancel` | `{ reason }` **ADMIN** |
| POST | `/api/v1/orders/:orderId/customer` | `{ customerId }` or `{ name, phone? }` |
| GET | `/api/v1/orders/:orderId/receipt` | HTML |
| GET | `/api/v1/orders/:orderId/receipt-image` | — |

### Payments — Bearer ADMIN

| Method | Path | Body |
|--------|------|------|
| GET | `/api/v1/payments` | — |
| GET | `/api/v1/payments/:paymentId` | — |
| POST | `/api/v1/payments/:paymentId/reverse` | `{ reason }` |
| GET | `/api/v1/orders/:orderId/payments` | — |
| POST | `/api/v1/orders/:orderId/payments` | `{ amount, method, reference?, notes?, idempotencyKey? }` |

**Payment methods:** `CASH` \| `CARD` \| `EASYPAISA` \| `JAZZCASH` \| `BANK_TRANSFER` \| `OTHER`

### Order status transitions

```text
PENDING → ACCEPTED → PREPARING → READY → SERVED → COMPLETED
                                              ↳ CANCELLED (admin, before COMPLETED)
PENDING → REJECTED (staff/admin)
```

- `COMPLETED` is never set manually — it happens when payments cover the total while the order is `SERVED`.
- Payment status (`UNPAID` → `PARTIALLY_PAID` → `PAID`) is separate from order status.
- Payment recording is allowed only while the order is `SERVED`.

### Static uploads

Served from `public/` at `/uploads/...` (QR, receipts, media). Missing files under `/uploads/*` return a clear `FILE_NOT_FOUND` JSON error (not a generic API 404).
