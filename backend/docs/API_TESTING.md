# BAZM Cafe Backend — Postman & API testing

## Import into Postman

1. Open Postman → **Import**
2. Import both files:
   - `docs/postman/BAZM_Cafe_Backend.postman_collection.json`
   - `docs/postman/BAZM_Cafe_Backend.local.postman_environment.json`
3. Select environment **BAZM Cafe Backend** (top-right)
4. Start API: `npm run dev`
5. Ensure admin exists: `npm run db:seed`

## Environment variables

| Variable | Purpose |
|----------|---------|
| `baseUrl` | `http://localhost:3000` |
| `adminEmail` / `adminPassword` | Seeded admin (`admin@bazm.local` / `password`) |
| `staffEmail` / `staffPassword` | Created by “Create staff” request |
| `accessToken` | Filled by “Login admin” test script |
| `staffAccessToken` | Filled by “Login staff” |
| `staffId`, `customerId`, `tableId`, `categoryId`, `productId`, `orderId`, `paymentId`, `guestOrderId` | Auto-saved from create responses |
| `tableToken` | Opaque QR token for dine-in (see below) |

Guest session cookie `bazm_guest_session` is HttpOnly. Postman stores it automatically when you call **Create takeaway/dine-in session** in the same collection runner/cookie jar.

## Dine-in table token

Create table from API does **not** return the raw QR token (only hash + image). For Postman dine-in tests:

```bash
npm run postman:table
```

Copy printed `tableId` / `tableToken` into the Postman environment.

## Recommended manual flow

1. **01 Auth → Login admin**
2. **01b Settings → Get / update rates** (defaults are `0`; optional)
3. **02 Staff → Create staff** (then optionally Login staff)
4. **03 Customers → Create customer**
5. **04 Tables → Create table** (+ `npm run postman:table` if testing dine-in)
6. **05 Categories → Create category**
7. **06 Products → Create product**
8. **07 Guest TAKEAWAY** → session → menu → create order
9. **09 Orders** → Accept → Preparing → Ready → Attach customer → Served  
   (Skip Reject/Cancel unless you intentionally want those paths on a fresh PENDING order)
10. **10 Payments** → partial then remaining (completes order)

## Automated tests

```bash
npm test
```

Uses Node's built-in test runner via `tsx`:

- `tests/unit/utils.node.test.ts` — money/slug/token helpers
- `tests/smoke/api.smoke.node.test.ts` — health, admin login, unauthorized staff (needs DB + seed)

```bash
npm run test:unit
npm run test:smoke
```

## Endpoint cheat sheet

### Public
| Method | Path | Body |
|--------|------|------|
| GET | `/api/v1/` | — |
| GET | `/api/v1/health` | — |
| POST | `/api/v1/auth/login` | `{ "email", "password", "deviceName?" }` |
| POST | `/api/v1/auth/refresh` | cookie `bazm_refresh_token` |
| POST | `/api/v1/guest/sessions` | `{ "orderType": "TAKEAWAY" }` or `{ "orderType": "DINE_IN", "tableToken" }` |
| POST | `/api/v1/guest/tables/resolve` | `{ "tableToken" }` |

### Guest (cookie `bazm_guest_session`)
| Method | Path | Body |
|--------|------|------|
| GET | `/api/v1/guest/sessions/current` | — |
| POST | `/api/v1/guest/sessions/close` | — |
| GET | `/api/v1/guest/menu` | — |
| POST | `/api/v1/guest/orders` | `{ "items":[{ "productId","quantity","notes?" }], "customerName?","customerPhone?","customerNotes?" }` |
| GET | `/api/v1/guest/orders` | — |
| GET | `/api/v1/guest/orders/:orderPublicId` | — |
| GET | `/api/v1/guest/orders/:orderPublicId/receipt` | HTML |
| GET | `/api/v1/guest/orders/:orderPublicId/receipt-image` | — |

### Auth bearer ADMIN
| Method | Path | Notes |
|--------|------|------|
| GET/POST/PATCH | `/api/v1/staff`… | Staff CRUD |
| GET/PATCH | `/api/v1/settings` | Cafe tax & service charge % (PATCH admin only) |
| GET/POST/PATCH | `/api/v1/tables`… | Tables + QR |
| GET/POST/PATCH/DELETE | `/api/v1/categories`… | Categories |
| GET/POST/PATCH/DELETE | `/api/v1/products`… | Products + stock |
| POST | `/api/v1/orders/:orderId/cancel` | Admin only |
| GET/POST | `/api/v1/payments`, `/api/v1/orders/:orderId/payments` | Payments |

### Auth bearer ADMIN or STAFF
| Method | Path | Notes |
|--------|------|------|
| GET/POST/PATCH | `/api/v1/customers`… | Customers |
| GET | `/api/v1/settings` | View tax & service charge rates |
| GET/PATCH/POST | `/api/v1/orders`… | List/status/reject/attach/receipts |
| GET | `/api/v1/auth/me` | Current user |
| POST | `/api/v1/auth/logout`, `/logout-all` | |

### Payment methods
`CASH` | `CARD` | `EASYPAISA` | `JAZZCASH` | `BANK_TRANSFER` | `OTHER`

### Order status transitions
`PENDING` → `ACCEPTED` → `PREPARING` → `READY` → `SERVED` → (`COMPLETED` only via full payment)
