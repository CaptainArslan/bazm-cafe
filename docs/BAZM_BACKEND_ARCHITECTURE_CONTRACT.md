# BAZM Café Backend Architecture Contract

**Document status:** Architecture contract — implementation must conform  
**Project phase:** V1 backend APIs  
**Current implementation target:** Domain modules after auth (Batch 1 schema approved)  
**Primary audience:** Developers and Cursor AI  

---

## 1. Purpose

This document is the architectural source of truth for the BAZM Café backend. It defines what may be built, where code belongs, how layers communicate, and what an implementation agent must do when information is missing.

This is not an implementation plan and does not authorize bulk code generation. Implementation must be performed later through an approved, ordered plan with validation gates.

## 2. Mandatory AI operating contract

Any AI agent working on this repository must follow these rules:

1. Inspect the repository before proposing or editing code.
2. Treat existing schema, configuration, shared utilities, and approved architecture documents as sources of truth.
3. Never invent a database field, enum value, route, dependency, environment variable, shared helper, or business rule.
4. When required information is absent or contradictory, stop and report:
   - what is missing;
   - files inspected;
   - why implementation cannot safely continue;
   - the smallest decision needed from the developer.
5. Do not silently rename existing files, fields, exports, endpoints, or response keys.
6. Do not modify unrelated modules while implementing one module.
7. Do not install or upgrade a package without explicit approval.
8. Do not create a second implementation of an existing shared concern.
9. Do not weaken TypeScript, Zod, Prisma, authentication, or error handling to make compilation pass.
10. Do not use `any`, `@ts-ignore`, or unsafe type assertions unless a documented external-library boundary makes it unavoidable and approval is given.
11. Never expose password hashes, refresh tokens, reset tokens, internal token hashes, stack traces, or secrets in API responses or logs.
12. Before each implementation batch, list the exact files that will be created or changed.
13. After each batch, run the approved validation commands and report exact results.

### Required pre-change response

Before editing, Cursor must respond with:

```text
Repository facts discovered:
- ...

Files to change:
- ...

Contracts being implemented:
- ...

Unresolved blockers:
- None | ...
```

If blockers are not `None`, Cursor must not edit code.

## 3. Product boundary

BAZM Café is a mobile-first restaurant ordering platform designed to operate on a restaurant's local Wi-Fi without requiring internet access.

### Actors

- **Customer:** uses a secure guest ordering session (dine-in via table QR, or takeaway without a table). Customers do not create user accounts in V1.
- **Staff:** authenticates as `STAFF`, reviews orders, accepts or rejects pending orders, advances preparation statuses through `SERVED`, searches/creates customers, and attaches customers to orders. Staff do not record payments or manage catalog/tables.
- **Administrator:** authenticates as `ADMIN`, manages staff, customers, tables, QR codes, categories, products, stock, cafe settings (tax / service charge), orders, cancellations, and manual payment recording.

### V1 modules

- auth
- staff
- customers
- tables
- categories
- products
- settings (cafe tax rate / service charge)
- guest-sessions
- orders
- payments

There is **no kitchen module** in V1. Kitchen/operational staff work through the orders APIs. An empty `src/modules/kitchen/` placeholder may remain unused until explicitly removed.

### Explicitly excluded from V1

- recipes
- ingredients
- suppliers
- multi-branch support
- advanced reporting
- dependency on Firebase Cloud Messaging
- online payment processing
- kitchen CRUD / multi-kitchen routing
- refunds / payment voiding (enum values may exist; APIs are not authorized)
- reservations

No excluded feature may be introduced indirectly through schema fields, routes, abstractions, or dependencies.

### Approved image packages (installed)

- `qrcode` — printable table QR PNG generation
- `sharp` — receipt-image composition

Upload directories:
- `public/uploads/qr`
- `public/uploads/receipts`

Kitchen placeholder remains unused.

## 4. Technology contract

### Backend

- Node.js
- Express
- TypeScript in strict mode
- ES modules
- MySQL
- Prisma ORM 7
- `@prisma/adapter-mariadb`
- Zod
- JWT access tokens
- bcrypt password hashing
- opaque refresh tokens
- Socket.IO

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- TanStack Query
- React Hook Form
- Zod
- PWA support

The backend must not depend on frontend implementation details beyond documented HTTP, cookie, CORS, and Socket.IO contracts.

## 5. Repository contract

```text
bazm-cafe/
├── backend/
│   ├── prisma/
│   ├── public/
│   ├── src/
│   ├── .env
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── .gitignore
├── package-lock.json
├── package.json
└── README.md
```

The repository uses npm workspaces for `backend` and `frontend`.

### Runtime origins

- Development frontend: `http://localhost:5173`
- Development backend: `http://localhost:3000`
- API prefix: `/api/v1`
- Socket.IO server: backend HTTP server on port `3000`
- Production: the Node application serves the built frontend and API from one origin.

## 6. TypeScript and module rules

- Backend `package.json` must use `"type": "module"`.
- TypeScript uses `module: "NodeNext"` and `moduleResolution: "NodeNext"`.
- Local relative imports include `.js` in TypeScript source.
- Source belongs in `backend/src` and compiled output in `backend/dist`.
- Generated Prisma client code belongs in `backend/src/generated/prisma` and must not be manually edited.
- Strict compiler rules must remain enabled.
- Each temporary empty TypeScript module must contain `export {};`.
- Import paths must match filename casing exactly.

## 7. Backend directory ownership

```text
backend/src/
├── config/       # Environment and infrastructure clients
├── constants/    # Cross-module immutable constants
├── errors/       # Application error types
├── middleware/   # Cross-cutting HTTP middleware
├── modules/      # Business modules
├── realtime/     # Socket.IO infrastructure and event contracts
├── routes/       # Top-level route composition
├── types/        # Shared/global TypeScript declarations
├── utils/        # Stateless reusable helpers
├── app.ts        # Express construction and middleware registration
└── server.ts     # HTTP server, Socket.IO initialization, and listening
```

### File ownership constraints

- `app.ts` configures Express; it does not start the server.
- `server.ts` creates the Node HTTP server, attaches Socket.IO, and calls `listen`.
- Only `src/config/database.ts` creates and exports the Prisma client.
- Modules must import the shared Prisma client and must not instantiate `PrismaClient`.
- Top-level `src/routes/index.ts` mounts module routers.
- Business rules never belong in route files or middleware.

## 8. Standard module contract

Module directories use plural names. Standard business filenames use singular names.

```text
src/modules/categories/
├── category.controller.ts
├── category.repository.ts
├── category.routes.ts
├── category.service.ts
├── category.types.ts
├── category.validation.ts
└── index.ts
```

### Layer responsibilities

#### Routes

- Declare HTTP method and path.
- Attach rate limiting, authentication, authorization, and validation middleware.
- Delegate to exactly one controller handler.
- Contain no Prisma calls and no business rules.

#### Validation

- Define Zod schemas for params, query strings, and bodies.
- Normalize only safe syntactic details such as trimming or lowercasing email addresses.
- Do not query the database.
- Export inferred input types when useful.

#### Controller

- Extract validated HTTP input.
- Call a service method.
- Set or clear cookies when required.
- Return responses through the existing shared response utility.
- Contain no Prisma queries, password comparison, token generation, or domain decisions.

#### Service

- Own use-case orchestration and business rules.
- Call repositories and focused infrastructure services.
- Throw the existing application error type.
- Never receive an Express `Request` or `Response` object.
- Never build HTTP response envelopes.

#### Repository

- Own Prisma queries for its module.
- Return database/domain data to services.
- Contain no HTTP concepts, JWT logic, cookie behavior, or response messages.
- Select the minimum required fields and never return secrets unnecessarily.

#### Types

- Define module-specific TypeScript contracts not already derived from Zod or Prisma.
- Must not duplicate Prisma-generated enums with independently maintained string unions.

#### Index

- Export the module's public router or approved public surface.
- Do not use broad exports that expose internal repository functions unintentionally.

### Allowed dependency direction

```text
routes -> controller -> service -> repository -> shared Prisma client
                         |
                         -> focused infrastructure service
```

Reverse dependencies are forbidden. Modules may not reach into another module's repository. Cross-module workflows must use an explicitly approved public service contract.

## 9. Database contract

The definitive schema is `backend/prisma/schema.prisma`.

Known application tables:

- `users`
- `refresh_tokens`
- `auth_sessions`
- `password_reset_tokens`
- `customers`
- `guest_sessions`
- `restaurant_tables`
- `categories`
- `products`
- `cafe_settings`
- `orders`
- `order_items`
- `payments`
- `order_status_histories`
- `stock_movements`

Known enums:

- `UserRole` — `ADMIN`, `STAFF`
- `CustomerType` — `DINE_IN`, `TAKEAWAY` (API and DB use `TAKEAWAY`; product language “parcel” maps to `TAKEAWAY`)
- `OrderStatus` — `PENDING`, `ACCEPTED`, `PREPARING`, `READY`, `SERVED`, `COMPLETED`, `REJECTED`, `CANCELLED`
- `OrderPaymentStatus` — `UNPAID`, `PARTIALLY_PAID`, `PAID`, `REFUNDED`
- `PaymentMethod` — `CASH`, `CARD`, `EASYPAISA`, `JAZZCASH`, `BANK_TRANSFER`, `OTHER`
- `PaymentStatus` — `PENDING`, `COMPLETED`, `FAILED`, `REFUNDED`
- `StockMovementType` — `STOCK_ADDED`, `STOCK_REMOVED`, `RESERVED`, `RESERVATION_RELEASED`, `CONSUMED`, `MANUAL_ADJUSTMENT`
- `TableOperationalStatus` — `AVAILABLE`, `OUT_OF_SERVICE` (`OCCUPIED` is derived in API responses, never stored)

An AI agent must inspect the actual schema for exact model names, fields, relation names, nullability, mappings, indexes, defaults, and enum members. This document does not authorize guessing them.

### Guest sessions

- Opaque raw token in HttpOnly cookie `bazm_guest_session` (path `/api/v1`); only SHA-256 hash stored.
- Public `uuid` for Socket.IO rooms and safe API identity.
- Lifetime from `GUEST_SESSION_EXPIRES_HOURS` (approved default: **1** hour).
- Dine-in sessions require an active table QR; takeaway sessions have no table.
- Closing rules: explicit close endpoint; automatic close when order becomes `COMPLETED` after full payment; rejection does not close the session.
- Table `OCCUPIED` is derived while an active (non-closed, non-expired) guest session is bound to that table. After payment completes and the session closes, the table is no longer occupied.

### Order money fields

`tax_amount`, `service_charge_amount`, and `discount_amount` remain on `orders`. Tax and service charge are computed at order create from the singleton `cafe_settings` rates (`tax_rate_percent`, `service_charge_percent`, both default `0`). Discount stays `0` in V1. Totals are computed only on the backend.

### Migration rules

- Format and validate the schema before migration creation.
- Create migrations with descriptive names.
- Inspect generated SQL before application.
- Never edit `_prisma_migrations` manually.
- Never use `prisma migrate reset` against production or valuable data.
- Use `prisma migrate deploy` in production.
- Schema changes require explicit inclusion in the approved implementation batch.

## 10. Shared HTTP contract

Existing shared utilities and middleware must be inspected before implementation:

- `src/constants/http-status.ts`
- `src/errors/app-error.ts`
- `src/middleware/error-handler.middleware.ts`
- `src/middleware/not-found.middleware.ts`
- `src/middleware/rate-limit.middleware.ts`
- `src/middleware/validate.middleware.ts`
- `src/utils/api-response.ts`
- `src/utils/async-handler.ts`

No parallel response utility, error class, async wrapper, or validation middleware may be created if the existing implementation supports the requirement.

### Response envelope

The exact envelope is owned by `src/utils/api-response.ts`. Cursor must inspect it and use it. Until inspected, response examples are illustrative and not authority to create new keys.

Required semantic behavior:

- Success responses have a stable success indicator, message, and optional data.
- Failure responses are produced centrally by the error handler.
- Validation failures use the established validation-error shape.
- Production responses never expose stack traces, SQL, internal token state, or secrets.
- Authentication failures must not reveal whether an email exists unless the endpoint contract explicitly permits it.

## 11. Authentication architecture

### Scope

Authentication applies to administrator and staff accounts. Customers do not create accounts in V1.

### Files

```text
src/modules/auth/
├── auth.constants.ts
├── auth.controller.ts
├── auth.repository.ts
├── auth.routes.ts
├── auth.service.ts
├── auth.types.ts
├── auth.validation.ts
├── token.service.ts
└── index.ts

src/middleware/authenticate.middleware.ts
src/middleware/authorize.middleware.ts
src/types/express.d.ts
```

### Auth file responsibilities

- `auth.constants.ts`: auth-specific immutable configuration names and cookie constants; no secrets hardcoded.
- `auth.validation.ts`: Zod input schemas.
- `auth.types.ts`: access-token claims, safe authenticated-user shape, token results, and service inputs where not inferred.
- `token.service.ts`: sign and verify access JWTs; generate cryptographically secure opaque tokens; hash opaque tokens. No Prisma or Express.
- `auth.repository.ts`: user/session/reset-token queries through Prisma.
- `auth.service.ts`: login, refresh, logout, logout-all, current-user, password-change, forgot-password, and reset-password rules.
- `auth.controller.ts`: HTTP translation and refresh-cookie lifecycle.
- `auth.routes.ts`: endpoints and middleware ordering.
- `authenticate.middleware.ts`: bearer-token verification plus current user-state enforcement.
- `authorize.middleware.ts`: role allow-list enforcement after authentication.
- `express.d.ts`: type-safe `Request.user` declaration.

## 12. Token and session contract

### Access token

- JWT signed with `JWT_ACCESS_SECRET`.
- Short lifetime from `JWT_ACCESS_EXPIRES_IN`; intended default is 15 minutes.
- Sent to the client in the successful login/refresh response.
- Client sends it as `Authorization: Bearer <access-token>`.
- Must contain only the minimum approved claims.
- Must not contain password data, refresh token data, or unnecessary personal information.
- Verification must restrict the expected signing algorithm rather than accepting arbitrary algorithms.

The exact claim names must be documented during the implementation plan after inspecting current user identifiers and role enum members. They must not be guessed.

### Refresh token

- Cryptographically random opaque value, not a JWT.
- Returned only through an `HttpOnly` cookie.
- Only a deterministic cryptographic hash is stored in MySQL.
- Raw refresh tokens must never be stored or logged.
- Lifetime comes from `JWT_REFRESH_EXPIRES_DAYS`; intended default is 30 days.
- Rotated on every successful refresh.
- Old token is marked revoked/replaced before or atomically with creation of the replacement.
- Refresh rotation must use a database transaction where partial state could create a security defect.
- Expired, revoked, missing, or unknown tokens are rejected.
- Logout revokes the presented session and clears the cookie.
- Logout-all revokes all active refresh sessions for the authenticated user.

### Reuse detection

Refresh-token reuse detection requires a schema capable of identifying a rotated token and its session/token family. This capability is **not considered confirmed** merely because a `refresh_tokens` table exists.

Before implementation, inspect whether the schema includes equivalent support for:

- token hash;
- user ownership;
- expiration;
- revocation;
- replacement/rotation linkage;
- session or family identifier.

If it does not, stop and propose the smallest schema amendment. Do not silently add fields.

### Refresh cookie

The exact cookie name must be defined once in auth constants. Required behavior:

- `httpOnly: true`
- `secure: true` in production and appropriate local-development behavior
- an explicitly selected `sameSite` policy compatible with deployment topology
- `path` limited as narrowly as the approved refresh/logout routes allow
- `maxAge` aligned with the server-side refresh-token lifetime
- clearing uses matching cookie attributes

Frontend requests that rely on the cookie must use credentials, and backend CORS must explicitly allow the configured frontend origin and credentials. Wildcard CORS with credentials is forbidden.

## 13. Password contract

- Password hashes use bcrypt.
- Work factor comes from validated `BCRYPT_ROUNDS`; intended default is 12.
- Plaintext passwords never enter logs or persistence.
- Login returns one generic invalid-credentials response for unknown email and incorrect password.
- Inactive or soft-deleted users cannot log in or continue authenticated use.
- Password-change requires the current password and a valid access token.
- Successful password-change revokes all refresh sessions.
- Password-reset tokens are opaque random values; only their hash is stored.
- Reset tokens are single-use and expire according to `PASSWORD_RESET_EXPIRES_MINUTES`.
- Successful password reset marks the reset token used and revokes all refresh sessions in one transaction where supported.
- Forgot-password always returns a generic response regardless of account existence.

### Offline-first reset constraint

No email/SMS delivery provider is currently part of the confirmed V1 architecture. Therefore:

- Do not pretend a reset notification was delivered.
- Do not expose a raw reset token in a production API response.
- A local administrator-driven staff password reset may be designed in the staff module.
- Public forgot/reset endpoints remain conditional until a secure delivery mechanism or an explicitly development-only retrieval mechanism is approved.

## 14. Authentication endpoint contracts

Base path: `/api/v1/auth`

| Method | Path | Access | Rate limit | Purpose |
|---|---|---|---|---|
| POST | `/login` | Public | Strict | Authenticate admin/staff and create session |
| POST | `/refresh` | Refresh cookie | Strict | Rotate refresh token and issue access token |
| POST | `/logout` | Refresh cookie | Normal | Revoke current session and clear cookie |
| POST | `/logout-all` | Access token | Normal | Revoke all sessions for current user |
| GET | `/me` | Access token | Normal | Return current safe user profile |
| POST | `/forgot-password` | Public | Strict | Start approved reset process without enumeration |
| POST | `/reset-password` | Reset token | Strict | Consume token and set new password |
| POST | `/change-password` | Access token | Strict | Verify current password and set new password |

### Login

Input semantics:

- email: required, valid, trimmed, normalized consistently
- password: required string; validation must not transform it

Flow:

1. Validate input.
2. Find user by normalized email.
3. Produce generic invalid-credentials failure if user is absent or password is wrong.
4. Reject inactive or soft-deleted user without exposing sensitive account state.
5. Verify bcrypt hash.
6. Create access token.
7. Create refresh session and store only its hash.
8. Set refresh cookie.
9. Return access token and safe user projection.

### Refresh

1. Read refresh cookie.
2. Hash raw token and locate stored record.
3. Reject invalid, expired, or revoked token.
4. Confirm owning user is still active and not soft-deleted.
5. Detect reuse when supported by the approved schema.
6. Revoke/replace old token and create new token atomically.
7. Set replacement cookie.
8. Return new access token and any approved session data.

### Logout

- Must be idempotent from the client's perspective.
- Revoke the current stored refresh session when identifiable.
- Clear the refresh cookie even when the token is already invalid or absent.
- Must not accidentally revoke other sessions.

### Logout all

- Requires valid access authentication.
- Revokes every active refresh token belonging to the current user.
- Clears the current refresh cookie.

### Me

- Requires valid access authentication.
- Reads current data, not a full user object embedded in the JWT.
- Returns a safe projection only.
- Rejects users who became inactive or soft-deleted after token issuance.

### Forgot password

- Always returns the same public response.
- Invalidates or supersedes previously active reset tokens according to the approved implementation plan.
- Stores only the token hash.
- Does not reveal token or account existence in production.
- Must not be marked complete until delivery behavior is approved.

### Reset password

- Accepts raw reset token and new password.
- Uses the token hash for lookup.
- Rejects missing, unknown, expired, or used token.
- Updates password, consumes token, and revokes sessions safely.
- Never logs the submitted token or password.

### Change password

- Requires access authentication.
- Requires current password and new password.
- Verifies current password before mutation.
- Prevents unsafe new passwords according to the approved Zod policy.
- Revokes all refresh sessions after success.

## 15. Authentication and authorization middleware

### Authentication middleware

- Parse only the Bearer authorization scheme.
- Reject missing or malformed credentials consistently.
- Verify signature, lifetime, algorithm, and required claims.
- Load the current user or minimum authorization state from the database.
- Reject inactive or soft-deleted users.
- Attach only the approved safe authenticated-user shape to `req.user`.
- Delegate failures to the central error handler.

### Authorization middleware

- Runs after authentication.
- Accepts an explicit allow-list of Prisma-generated `UserRole` values.
- Returns unauthorized when no authenticated user exists.
- Returns forbidden when authentication exists but role is not allowed.
- Does not query the database if authentication middleware already attached sufficient current role data.

Authentication answers **who the caller is**. Authorization answers **whether that caller may perform this action**. These concerns must remain separate.

## 16. Transaction and concurrency rules

Database transactions are required for workflows where partial success would corrupt security, money, inventory, or order state.

Authentication examples:

- refresh-token rotation;
- password reset plus reset-token consumption plus session revocation;
- any session-family revocation caused by reuse detection.

Future order/inventory examples:

- order creation plus stock reservation plus stock movement;
- rejection/cancellation plus reservation release;
- completion plus reservation conversion to consumption;
- payment update plus related order payment-state recalculation.

Do not hold a database transaction open during slow external network operations.

## 17. Order and inventory invariants

There is one `orders` table. Staff advance the same order; there is no separate kitchen-order record or kitchen module.

Order statuses are fixed for V1:

- `PENDING`
- `ACCEPTED`
- `PREPARING`
- `READY`
- `SERVED`
- `COMPLETED`
- `REJECTED`
- `CANCELLED`

Normal transition:

`PENDING` → `ACCEPTED` → `PREPARING` → `READY` → `SERVED` → `COMPLETED`

Rules:

- `COMPLETED` is never set manually by admin/staff. It is set only when successful payments cover the order total while the order is `SERVED`.
- `SERVED` requires a customer attached for dine-in (name required; phone optional). Takeaway already requires name and phone at order creation.
- Payment may be recorded only while the order is `SERVED`.

Payment status is separate from order status:

- `UNPAID`
- `PARTIALLY_PAID`
- `PAID`
- `REFUNDED` (preserved; no refund APIs in V1)

Inventory behavior:

- Submission reserves inventory (`RESERVED`).
- Acceptance converts reservation into consumption (`CONSUMED`): stock and reserved both decrease.
- Rejection of `PENDING` releases reservation (`RESERVATION_RELEASED`); stock unchanged.
- Admin cancellation of `ACCEPTED` / `PREPARING` / `READY` does **not** automatically restore consumed stock.
- Available quantity is `stock_quantity - reserved_quantity` (never stored as an editable field).
- `stock_movements` is the audit trail.
- Order items preserve product-name and price snapshots so historical receipts do not change when products change.

## 18. Socket.IO contract

- Socket.IO attaches to a Node HTTP server created with `createServer(app)`.
- After integration, the application must not use `app.listen()`.
- Socket infrastructure belongs in `src/realtime`.
- Event names are centralized in `socket.events.ts`.
- Event payload types belong in `socket.types.ts`.
- Domain events such as `order:created` may not be added before the owning domain workflow exists.
- Connecting requires a Socket.IO client; opening `/socket.io` in a browser is not a valid connection test.
- The polling handshake test is `/socket.io/?EIO=4&transport=polling`.

### Socket authentication and rooms (approved)

- ADMIN/STAFF sockets: access JWT via Socket.IO auth handshake → join `operations` only.
- Guest sockets: validate guest-session token (hash) → join only `guest-session:{uuid}` assigned by the server.
- Domain events (emit only after DB commit): `order:created`, `order:accepted`, `order:rejected`, `order:status-updated`, `order:cancelled`, `order:payment-updated`, `order:completed`.

## 19. Environment contract

Confirmed environment names:

```text
NODE_ENV
APP_NAME
APP_URL
HOST
PORT
FRONTEND_URL
DB_CONNECTION
DB_HOST
DB_PORT
DB_DATABASE
DB_USERNAME
DB_PASSWORD
JWT_ACCESS_SECRET
JWT_ACCESS_EXPIRES_IN
JWT_REFRESH_EXPIRES_DAYS
PASSWORD_RESET_EXPIRES_MINUTES
BCRYPT_ROUNDS
GUEST_SESSION_EXPIRES_HOURS
```

- `GUEST_SESSION_EXPIRES_HOURS` approved default: `1` (maximum intended café session length for V1).
- Environment values must be parsed and validated in `src/config/environment.ts`.
- Feature code imports validated environment configuration, not `process.env` directly.
- Secrets are never hardcoded, committed, logged, or returned.
- New environment keys require explicit architecture approval and documentation.

## 20. Security baseline

- Helmet is applied globally.
- CORS uses explicit trusted origin configuration and credential support where needed.
- JSON body size is bounded.
- Login, refresh, forgot-password, reset-password, and change-password have appropriate rate limits.
- Inputs are validated before controllers execute.
- Prisma parameterization is used; raw SQL requires explicit justification.
- Authentication endpoints must use generic errors where enumeration is possible.
- Sensitive values are excluded from logs.
- Production cookies use secure settings.
- Default development credentials must not survive into production.
- API responses never include Prisma records without deliberate safe projection.

## 21. Testing contract

The final implementation plan must include tests. At minimum, auth tests must cover:

- successful login;
- incorrect password and unknown email producing equivalent public behavior;
- inactive and soft-deleted account rejection;
- access to `/me` with valid, missing, malformed, expired, and invalid JWTs;
- successful refresh rotation;
- old refresh token rejection after rotation;
- refresh rejection after expiration or revocation;
- logout idempotency;
- logout-all invalidating every session;
- successful and failed current-password verification;
- reset-token unknown, expired, used, and successful cases;
- session revocation after password change/reset;
- role authorization allowed and forbidden cases;
- validation failures;
- refresh-cookie attributes in development and production configurations.

Test tooling is not confirmed in this architecture. Cursor must inspect `backend/package.json` and must not install a test framework without approval.

## 22. Definition of done for an API batch

An API batch is complete only when:

1. Exact contracts are approved.
2. Required schema support exists and migrations are reviewed where applicable.
3. Implementation respects layer boundaries.
4. Zod validation covers params, query, and body as applicable.
5. Authorization is explicit.
6. Success and error behavior use shared utilities.
7. No secret or unsafe database object is returned.
8. Type checking passes without suppression.
9. Relevant tests pass.
10. Manual request examples are documented and verified.
11. No unrelated files changed.
12. Documentation reflects final behavior.

Compilation alone does not mean an API is complete.

## 23. Known facts and unresolved decisions ledger

### Confirmed (Batch 1 decisions)

- Technology and repository structure described above.
- V1 modules: auth, staff, customers, tables, categories, products, settings, guest-sessions, orders, payments (no kitchen module).
- Order type enum remains `TAKEAWAY` (not renamed to `PARCEL`).
- `OrderStatus` includes `SERVED`; orders include `served_at`.
- `PaymentMethod` includes `EASYPAISA` and `JAZZCASH`.
- `GUEST_SESSION_EXPIRES_HOURS` default `1`.
- Receipt/QR image stack: `qrcode` + `sharp` (install in later batches).
- Kitchen placeholder folder left empty for now.
- Cafe settings singleton stores tax and service charge percentages (default `0`); applied when creating orders. Discount remains `0` in V1.
- Table `OCCUPIED` is derived from an active guest session; session closes when the order is fully paid and becomes `COMPLETED`.
- Admin and staff authenticate; customers use guest sessions only.
- JWT access tokens and opaque refresh tokens.
- Socket.IO attached to the Node HTTP server; auth/rooms/events specified above.
- Shared backend foundation files already exist.

### Requires explicit decision (deferred)

- Password-reset delivery mechanism for the offline-first V1 environment.
- Exact local upload directory layout for QR and receipt images (before tables/receipts batches).
- Audit logging requirements beyond stock movements and order status history.

Cursor must not resolve deferred decisions by assumption.

## 24. Architecture governance

If code and this document conflict:

1. Stop implementation.
2. Identify the exact conflict with file references.
3. Determine whether code is stale or this contract needs amendment.
4. Obtain approval.
5. Update the architecture contract first when the approved architecture changes.
6. Then update implementation.

Architecture changes must be intentional. Convenient code generation is not a reason to weaken a contract.

## 25. Next controlled phase

After approval of this architecture, create a separate implementation plan. That plan must:

- begin with repository inspection;
- resolve or explicitly defer every auth decision in the ledger;
- divide auth into small testable batches;
- list exact files per batch;
- state database changes before code changes;
- define validation commands and expected outcomes;
- prohibit moving to the next batch until the current gate passes.

No authentication implementation is authorized by this document alone.
