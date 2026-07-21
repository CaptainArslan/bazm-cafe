# BAZM Café

BAZM Café is a mobile-first restaurant ordering and back-office platform designed to run entirely on a restaurant's local Wi-Fi network — no internet dependency for core service. Customers order from their own phone via a table QR code (dine-in) or a walk-in flow (takeaway); staff manage the order queue; admins run the back office.

## Actors (V1)

| Actor | Access | Can do |
|---|---|---|
| **Customer** | No account — guest session via `bazm_guest_session` cookie | Browse menu, place orders against a guest session (dine-in or takeaway), track order/receipt |
| **Staff** | `STAFF` login | Review pending orders, accept/reject, advance status through `SERVED`, search/create customers, attach a customer to an order |
| **Admin** | `ADMIN` login | Everything Staff can, plus: staff/customers/tables/QR/categories/products/stock, cafe settings (tax %, service charge %), order cancellation, manual payment recording |

### Explicitly out of scope for V1

Recipes, ingredient-level inventory, suppliers, multi-branch support, a separate kitchen module (staff work the order queue directly — there's no dedicated kitchen role or record), online payment processing, refund APIs (the enum value is reserved, no endpoint exists), reservations, and Firebase/push notifications. Don't build against any of these without an explicit decision — see `docs/BAZM_BACKEND_ARCHITECTURE_CONTRACT.md`.

## Repository structure

```text
bazm-cafe/
├── backend/    # Node.js + Express + TypeScript + Prisma/MySQL API, Socket.IO
├── frontend/   # Vue 3 + TypeScript + Vite + Tailwind + shadcn-vue
└── docs/       # Architecture contract + auth implementation plan
```

`backend/` and `frontend/` are independent npm projects — no root workspaces. Install and run each from its own directory. In production, the Node app serves the built frontend and the API from one origin.

## Tech stack

| | Backend | Frontend |
|---|---|---|
| Language | TypeScript (strict, ES modules) | TypeScript |
| Framework | Express | Vue 3 (Composition API) + Vite |
| Data | MySQL via Prisma ORM 7 (`@prisma/adapter-mariadb`) | TanStack Query |
| Validation | Zod | VeeValidate + `@vee-validate/zod` |
| Styling | — | Tailwind CSS v4 + shadcn-vue (`reka-ui`) |
| Auth | JWT access tokens + opaque refresh tokens (bcrypt) | — (cookie/bearer consumed from the API) |
| Realtime | Socket.IO | `socket.io-client` (not yet wired) |
| Testing | Node's built-in test runner via `tsx` | Vitest + Vue Test Utils |

## Getting started

### Backend

```bash
cd backend
npm install
npx prisma generate
cp .env.example .env   # fill in DB credentials and JWT secrets
npx prisma migrate deploy
npm run db:seed        # creates the seeded admin (admin@bazm.local / password)
npm run dev             # http://localhost:3000
```

#### Refresh the database (local / test only)

Wipes all data, re-applies every migration, then seeds only the admin (+ cafe settings defaults):

```bash
cd backend
npx prisma migrate reset --force
npm run db:seed
```

If reset already ran the seed (check console output), you can skip `npm run db:seed`.

| Command | What it does |
|---|---|
| `npx prisma generate` | Generate Prisma Client from `schema.prisma` |
| `npx prisma migrate deploy` | Apply pending migrations (keeps existing data) |
| `npx prisma migrate status` | Show which migrations are applied |
| `npx prisma migrate reset --force` | **Drop DB**, recreate, apply all migrations (destructive) |
| `npm run db:seed` | Seed admin only: `admin@bazm.local` / `password` |
| `npx prisma db seed` | Same as `npm run db:seed` |
| `npx prisma studio` | Browse tables in the browser |

**Never** run `migrate reset` against production.

### Frontend

```bash
cd frontend
npm install
npm run dev             # http://localhost:5173, proxies /api to the backend on :3000
```

Other frontend scripts: `npm run build`, `npm run typecheck`, `npm run test`, `npm run lint`.

## API

- Base URL (dev): `http://localhost:3000`, all routes under `/api/v1`
- Admin/Staff authenticate via `POST /api/v1/auth/login`, then send `Authorization: Bearer <accessToken>`; a refresh token lives in the `bazm_refresh_token` HttpOnly cookie
- Customers never log in — `POST /api/v1/guest/sessions` starts a dine-in (`tableToken` from the table QR) or takeaway session, identified by the `bazm_guest_session` HttpOnly cookie

| Group | Access | Routes |
|---|---|---|
| Public | none | `GET /health`, `POST /auth/login`, `POST /auth/refresh`, `POST /guest/sessions`, `POST /guest/tables/resolve` |
| Guest session | `bazm_guest_session` cookie | `GET /guest/sessions/current`, `POST /guest/sessions/close`, `GET /guest/menu`, `POST/GET /guest/orders`, `GET /guest/orders/:id`, `GET /guest/orders/:id/receipt(-image)` |
| Admin or Staff | Bearer token | `GET/POST/PATCH /customers`, `GET /settings`, `GET/PATCH/POST /orders` (status/reject/attach/receipts), `GET /auth/me`, `POST /auth/logout(-all)` |
| Admin only | Bearer token, `ADMIN` | `/staff`, `PATCH /settings`, `/tables` (+ QR), `/categories`, `/products` (+ stock), `POST /orders/:id/cancel`, `/payments` |

Full endpoint reference, sample bodies, and a ready-to-import Postman collection: [`backend/docs/API_TESTING.md`](backend/docs/API_TESTING.md).

### Order lifecycle

```text
PENDING → ACCEPTED → PREPARING → READY → SERVED → COMPLETED
                                              ↳ CANCELLED (admin, pre-COMPLETED)
PENDING → REJECTED (staff/admin)
```

- `COMPLETED` is never set manually — it's derived once payments cover the order total while `SERVED`.
- Payment can only be recorded while an order is `SERVED`. Payment status (`UNPAID → PARTIALLY_PAID → PAID`) is tracked separately from order status.
- Payment methods: `CASH`, `CARD`, `EASYPAISA`, `JAZZCASH`, `BANK_TRANSFER`, `OTHER`.
- A table is `OCCUPIED` for as long as an active guest session is bound to it; it's derived, never stored, and clears when that session closes (on full payment, or explicit close).

## Realtime (Socket.IO)

- Admin/Staff sockets authenticate with the access JWT and join the `operations` room.
- Guest sockets authenticate with the guest-session token and join `guest-session:{uuid}` only.
- Domain events (emitted only after the triggering DB write commits): `order:created`, `order:accepted`, `order:rejected`, `order:status-updated`, `order:cancelled`, `order:payment-updated`, `order:completed`.

## Testing

```bash
# backend
cd backend && npm test          # unit + smoke tests (smoke needs a running DB + seed)

# frontend
cd frontend && npm run test
```

## Documentation

- [`docs/README.md`](docs/README.md) — index of all project docs
- [`docs/BAZM_CAFE_WORKFLOW.md`](docs/BAZM_CAFE_WORKFLOW.md) — end-to-end customer / staff / admin workflow
- [`docs/BAZM_BACKEND_ARCHITECTURE_CONTRACT.md`](docs/BAZM_BACKEND_ARCHITECTURE_CONTRACT.md) — backend architecture contract for implementers and AI agents
- [`docs/BAZM_AUTH_API_IMPLEMENTATION_PLAN.md`](docs/BAZM_AUTH_API_IMPLEMENTATION_PLAN.md) — historical auth module plan (core auth delivered)
- [`backend/docs/API_TESTING.md`](backend/docs/API_TESTING.md) — Postman setup, DB refresh/seed, full endpoint cheat sheet
- [`backend/README.md`](backend/README.md) — Prisma migrate / seed / reset commands