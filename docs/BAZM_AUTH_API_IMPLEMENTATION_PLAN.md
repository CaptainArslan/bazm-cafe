# BAZM Café Authentication API — Step-by-Step Implementation Plan

**Status:** Planning only — no implementation authorized by this document  
**Depends on:** `BAZM_BACKEND_ARCHITECTURE_CONTRACT.md`  
**Target:** Complete, secure, tested authentication APIs for admin and staff  

---

## 1. Final outcome

The auth module will provide:

```text
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/logout-all
GET  /api/v1/auth/me
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
POST /api/v1/auth/change-password
```

Authentication uses:

- short-lived JWT access tokens;
- opaque refresh tokens in an HttpOnly cookie;
- hashed refresh tokens in MySQL;
- refresh-token rotation;
- bcrypt passwords;
- Zod request validation;
- current-user checks for inactive and soft-deleted accounts;
- role-based authorization for future protected APIs.

Customers do not authenticate in V1. Authentication is for `ADMIN` and `STAFF`, subject to the actual Prisma enum names.

## 2. Rules for executing this plan

1. Complete phases in order.
2. Do not edit files in a later phase early.
3. At the beginning of every phase, inspect all listed inputs.
4. Before editing, list exact files to be changed.
5. If actual code conflicts with the architecture contract, stop.
6. Never invent missing schema fields or helper interfaces.
7. Run the phase gate after every phase.
8. Do not proceed while a gate fails.
9. Do not install packages unless the dependency audit proves one is missing and approval is given.
10. Do not implement forgot/reset password as “complete” until its delivery mechanism is decided.

## 3. Planned file map

### Auth module

```text
backend/src/modules/auth/
├── auth.constants.ts
├── auth.controller.ts
├── auth.repository.ts
├── auth.routes.ts
├── auth.service.ts
├── auth.types.ts
├── auth.validation.ts
├── token.service.ts
└── index.ts
```

### Shared files

```text
backend/src/middleware/authenticate.middleware.ts
backend/src/middleware/authorize.middleware.ts
backend/src/types/express.d.ts
backend/src/routes/index.ts
```

### Conditionally changed files

Only change these if repository inspection proves it is necessary:

```text
backend/prisma/schema.prisma
backend/src/config/environment.ts
backend/src/middleware/rate-limit.middleware.ts
backend/src/app.ts
backend/package.json
backend/prisma.config.ts
```

## 4. Phase 0 — Repository truth audit

### Goal

Record the exact interfaces already present before designing code.

### Read these files

```text
backend/package.json
backend/tsconfig.json
backend/prisma/schema.prisma
backend/prisma.config.ts
backend/src/config/database.ts
backend/src/config/environment.ts
backend/src/constants/http-status.ts
backend/src/errors/app-error.ts
backend/src/middleware/error-handler.middleware.ts
backend/src/middleware/not-found.middleware.ts
backend/src/middleware/rate-limit.middleware.ts
backend/src/middleware/validate.middleware.ts
backend/src/middleware/authenticate.middleware.ts
backend/src/middleware/authorize.middleware.ts
backend/src/routes/index.ts
backend/src/types/express.d.ts
backend/src/utils/api-response.ts
backend/src/utils/async-handler.ts
backend/src/app.ts
backend/src/server.ts
backend/prisma/seed.ts
```

Also list every file under:

```text
backend/src/modules/auth/
```

### Produce an audit table

Record:

| Area | Exact fact required |
|---|---|
| User model | Model name, ID type, email, password hash, role, active flag, deleted timestamp |
| User roles | Exact enum members and generated import path |
| Refresh token | Every field, index, relation, and uniqueness rule |
| Reset token | Every field, index, relation, and uniqueness rule |
| Environment | Exact exported object shape and all auth keys |
| AppError | Constructor signature and error metadata |
| API response | Exact success methods and response envelope |
| Validation | Middleware signature and expected schema structure |
| Rate limiting | Existing exports and intended endpoint use |
| Routes | Router export/mounting convention |
| Test tools | Framework, scripts, setup, and test directory convention |
| Prisma | Generated client path and transaction style |

### Dependency audit

Confirm, without changing dependencies:

```text
bcrypt
jsonwebtoken
cookie-parser
zod
express-rate-limit
@prisma/client
@prisma/adapter-mariadb
```

Confirm the corresponding TypeScript definitions where required. Do not install `@types/socket.io`.

### Phase 0 gate

Stop and ask for a decision if any of these remain unknown:

- exact user ID type;
- exact role enum members;
- password hash field;
- active/deleted fields;
- refresh/reset token schema;
- error and response utility interfaces.

No files are edited in Phase 0.

## 5. Phase 1 — Resolve auth decisions

### Goal

Turn every unresolved security choice into an explicit contract before coding.

### Decisions to record

#### Access-token claims

Recommended minimal claims:

```text
sub  = user ID serialized as a string
role = exact Prisma UserRole value
```

Do not include email, name, password data, active status, or refresh-session data unless a proven requirement exists.

#### JWT algorithm

Recommended: `HS256`, explicitly selected during signing and restricted during verification.

#### Refresh cookie

Recommended starting contract:

```text
name: bazm_refresh_token
httpOnly: true
secure: NODE_ENV === production
sameSite: lax
path: /api/v1/auth
maxAge: same duration as server-side refresh-token expiration
```

Confirm whether limiting the path to `/api/v1/auth` works with all auth endpoints. Cookie clearing must reuse matching options.

#### Password policy

Recommended V1 minimum:

- 8–72 characters;
- at least one uppercase letter;
- at least one lowercase letter;
- at least one number;
- no automatic trimming or transformation.

The 72-character ceiling avoids bcrypt silently ignoring additional bytes, but byte-length behavior must be handled carefully for Unicode. Record the final accepted policy.

#### Reuse response

Recommended: if a known rotated token is reused, revoke its entire refresh-token family. Do not automatically revoke unrelated devices unless the approved security policy chooses that behavior.

#### Password recovery delivery

Choose one:

1. defer public forgot/reset endpoints until email/SMS delivery exists;
2. implement token creation but connect it to an approved local administrator workflow;
3. allow raw reset token return only in development/test, never production.

Recommended for BAZM V1: administrator-driven staff password reset, with public forgot/reset endpoints deferred unless a delivery provider is added.

### Phase 1 deliverable

Add an approved-decision section to the architecture contract or a decision record. Do not encode decisions only in source code.

### Phase 1 gate

All decisions required by the first implementation batch are written and approved. Deferred password recovery must be clearly marked, not silently omitted.

## 6. Phase 2 — Verify or amend Prisma auth schema

### Goal

Ensure the database can support the approved token lifecycle.

### Inspect

```text
backend/prisma/schema.prisma
backend/prisma/migrations/
```

### Required semantic capabilities

#### User

- unique normalized email;
- bcrypt password hash;
- role;
- active/inactive state;
- soft-delete state if the application contract requires it;
- relations to refresh and reset tokens.

#### Refresh token

- stable primary key;
- owning user;
- unique token hash;
- expiration timestamp;
- revocation timestamp or equivalent;
- rotation/replacement linkage;
- family/session identifier for reuse containment;
- creation timestamp;
- useful indexes for user, token hash, family, and cleanup queries.

#### Password-reset token

- stable primary key;
- owning user;
- unique token hash;
- expiration timestamp;
- use/consumption timestamp;
- creation timestamp;
- useful indexes.

### If schema already supports all requirements

Make no schema change. Document the field mapping that implementation will use.

### If schema does not support requirements

1. Propose the smallest schema diff.
2. Explain each new/changed field.
3. Obtain approval.
4. Edit only `schema.prisma`.
5. Format and validate.
6. Create a named migration with `--create-only`.
7. Inspect the SQL.
8. Apply only after approval.
9. Generate the Prisma client.

### Validation commands

From `backend/`:

```bash
npx prisma format
npx prisma validate
npx prisma migrate dev --name strengthen_auth_sessions --create-only
npx prisma migrate dev
npx prisma generate
npx prisma migrate status
```

Use the migration commands only if a schema change is approved. Never use `migrate reset`.

### Phase 2 gate

- Prisma validates.
- Migration SQL is reviewed if created.
- Database is at the expected migration state.
- Generated client matches schema.
- Seeded admin remains usable in development.

## 7. Phase 3 — Auth constants, types, and validation

### Goal

Define the module's compile-time and input contracts before business logic.

### Files

```text
backend/src/modules/auth/auth.constants.ts
backend/src/modules/auth/auth.types.ts
backend/src/modules/auth/auth.validation.ts
```

### `auth.constants.ts`

Define only approved, non-secret constants:

- refresh cookie name;
- cookie path;
- JWT algorithm;
- token byte length where fixed;
- reusable public auth messages where centralization adds value.

Do not duplicate environment durations or secrets here.

### `auth.types.ts`

Define:

- access-token claims;
- safe authenticated-user projection;
- issued access/refresh token result;
- service result types if not inferred;
- Express user shape if it is owned here and re-used by `express.d.ts`.

Use the Prisma-generated role enum. Do not create a competing role union.

### `auth.validation.ts`

Create schemas for:

- login body;
- reset-password body;
- change-password body;
- any explicit refresh body only if the contract needs one (normally it does not);
- any route params or query strings used by auth.

Validation expectations:

- normalize email consistently;
- do not trim/transform passwords;
- apply approved password policy to new passwords;
- login password validation should avoid rejecting legitimate existing passwords based on the new-password policy;
- reject unknown fields if that matches the existing validation convention.

### Phase 3 gate

Run the repository's format/lint command if present and:

```bash
npm run typecheck --workspace=backend
```

No use of `any`, no duplicated enums, and no import-cycle errors.

## 8. Phase 4 — Token service

### Goal

Implement cryptographic operations without HTTP or database dependencies.

### File

```text
backend/src/modules/auth/token.service.ts
```

### Required functions

Names may follow existing conventions, but behavior must include:

- sign an access token from approved claims;
- verify an access token and return typed claims;
- generate a cryptographically secure opaque refresh token;
- generate a cryptographically secure password-reset token when that flow is approved;
- hash opaque tokens deterministically for database lookup.

### Rules

- Use Node's `crypto.randomBytes` for opaque tokens.
- Use SHA-256 or the explicitly approved deterministic token-hash algorithm.
- Do not use bcrypt for refresh-token lookup hashes; deterministic lookup is required and tokens already have high entropy.
- Restrict JWT verification to the approved algorithm.
- Validate the decoded claim structure; do not trust a successful signature alone.
- Do not import Prisma, Express, cookies, or repositories.
- Do not log raw or hashed tokens.

### Phase 4 gate

- Typecheck passes.
- Token service has focused tests if test tooling exists.
- A valid token verifies.
- Expired, altered, wrong-secret, wrong-algorithm, and malformed tokens fail.
- Generated opaque tokens are non-empty, high-entropy, and hash consistently.

## 9. Phase 5 — Repository layer

### Goal

Create the minimum Prisma operations required by auth services.

### File

```text
backend/src/modules/auth/auth.repository.ts
```

### Expected repository capabilities

Adapt names to the actual schema:

- find user by normalized email for authentication;
- find current safe user by ID;
- find user password data by ID when changing password;
- create refresh-token record;
- find refresh token by hash with required user/session data;
- rotate token in a transaction;
- revoke one refresh token;
- revoke all refresh tokens for a user;
- revoke a token family;
- update password and revoke sessions atomically;
- invalidate existing reset tokens for a user;
- create reset-token record;
- find valid reset token by hash;
- consume reset token, change password, and revoke sessions atomically.

### Rules

- Select only fields needed by the service.
- Do not return password hashes from safe-user methods.
- Do not accept or return Express objects.
- Do not generate tokens or compare passwords.
- Do not throw HTTP-specific errors.
- Use the shared Prisma instance only.
- Security-sensitive multi-write operations use `$transaction`.

### Phase 5 gate

- Typecheck passes.
- Every repository method maps to real schema fields.
- Queries have appropriate indexes in the schema.
- Transactional operations cannot leave partially rotated sessions.

## 10. Phase 6 — Login API

### Goal

Complete and manually verify the first working auth endpoint.

### Files

```text
backend/src/modules/auth/auth.service.ts
backend/src/modules/auth/auth.controller.ts
backend/src/modules/auth/auth.routes.ts
backend/src/modules/auth/index.ts
backend/src/routes/index.ts
```

Change `rate-limit.middleware.ts` only if an appropriate existing limiter cannot be reused.

### Service workflow

1. Receive validated email and password.
2. Find user by normalized email.
3. Compare bcrypt password.
4. Return the same public invalid-credentials error for missing user or incorrect password.
5. Reject inactive or soft-deleted accounts according to the approved public error policy.
6. Create minimal access-token claims.
7. Generate opaque refresh token.
8. Hash refresh token.
9. Persist session with family/session metadata and expiry.
10. Return raw refresh token only to the controller, plus access token and safe user.

### Controller workflow

1. Read validated input through the established middleware contract.
2. Call auth service.
3. Set refresh cookie using one shared cookie-options builder/constant contract.
4. Return safe user and access token through the existing response utility.

### Route middleware order

```text
login rate limiter
-> request validation
-> async controller
```

### Manual checks

```text
Valid admin credentials        -> success, access token, refresh cookie
Wrong password                 -> generic 401
Unknown email                  -> same generic 401 shape/message
Missing email/password         -> validation failure
Malformed email                -> validation failure
Inactive user                  -> rejected
Soft-deleted user              -> rejected
Password hash in response      -> must never occur
Refresh token in JSON          -> must never occur
```

### Phase 6 gate

- Login endpoint works through an HTTP client.
- Cookie attributes are inspected.
- Database contains only a token hash.
- Typecheck and relevant tests pass.
- No other auth route is presented as complete yet.

## 11. Phase 7 — Authentication middleware and `GET /me`

### Goal

Establish protected-route identity.

### Files

```text
backend/src/middleware/authenticate.middleware.ts
backend/src/types/express.d.ts
backend/src/modules/auth/auth.service.ts
backend/src/modules/auth/auth.controller.ts
backend/src/modules/auth/auth.routes.ts
```

### `express.d.ts`

Augment Express `Request` with the approved safe authenticated-user type. Ensure the declaration file is included by `tsconfig.json`.

### Authentication flow

1. Read `Authorization` header.
2. Require exactly the Bearer scheme and a token.
3. Verify JWT signature, algorithm, expiration, and claims.
4. Load current user by subject ID.
5. Reject missing, inactive, or soft-deleted user.
6. Attach safe current user to `req.user`.
7. Continue.

### `/me` flow

- Apply authentication middleware.
- Return the safe current-user projection.
- Do not return the JWT claims as if they were current database state.

### Manual checks

```text
Valid token                    -> current user
No Authorization header        -> 401
Wrong scheme                   -> 401
Malformed token                -> 401
Expired token                  -> 401
Valid token, user deactivated  -> 401
Valid token, user deleted      -> 401
```

### Phase 7 gate

The login access token can call `/me`, and every failure case uses central error handling.

## 12. Phase 8 — Refresh rotation

### Goal

Issue replacement access and refresh tokens safely.

### Files

```text
backend/src/modules/auth/auth.repository.ts
backend/src/modules/auth/auth.service.ts
backend/src/modules/auth/auth.controller.ts
backend/src/modules/auth/auth.routes.ts
```

### Flow

1. Controller reads refresh cookie.
2. Service hashes the raw token.
3. Repository finds stored token and owning user/session data.
4. Service rejects unknown, expired, or revoked token.
5. Service rejects inactive or soft-deleted owner.
6. If a known rotated token is reused, apply approved family-revocation policy.
7. Generate replacement refresh token and hash.
8. Rotate old/new records atomically.
9. Issue new access token.
10. Controller replaces cookie.
11. Return new access token and approved safe data.

### Concurrency requirement

Two simultaneous requests using the same refresh token must not both succeed. The plan must use a transactional conditional update, unique rotation state, or another database-enforced approach proven correct for MySQL/Prisma.

### Manual checks

```text
Valid refresh cookie            -> new access token and new cookie
Original token reused           -> rejected and family response applied
No cookie                       -> 401
Unknown token                   -> 401
Expired token                   -> 401
Revoked token                   -> 401
Inactive/deleted owner          -> 401
Two concurrent refreshes        -> at most one succeeds
```

### Phase 8 gate

Rotation is transactional, old tokens cannot create another session, cookie replacement works, and concurrency behavior is tested.

## 13. Phase 9 — Logout and logout-all

### Goal

Support current-session and all-session termination.

### Files

```text
backend/src/modules/auth/auth.repository.ts
backend/src/modules/auth/auth.service.ts
backend/src/modules/auth/auth.controller.ts
backend/src/modules/auth/auth.routes.ts
```

### Logout

- Read refresh cookie if present.
- Hash and revoke the corresponding active session when found.
- Always clear the cookie.
- Remain idempotent from the caller's perspective.
- Do not revoke other sessions.

### Logout all

- Require access authentication.
- Revoke every active refresh token for `req.user.id`.
- Clear the current refresh cookie.
- Existing access tokens remain valid until their short expiry unless access-token revocation infrastructure is separately approved.

### Important client contract

After logout/logout-all, the frontend must discard its in-memory/local access token. The backend cannot erase an already issued stateless JWT from the browser.

### Phase 9 gate

- Current refresh session fails after logout.
- Other device session remains active after ordinary logout.
- Every refresh session fails after logout-all.
- Repeating logout succeeds safely.

## 14. Phase 10 — Change password

### Goal

Allow an authenticated admin/staff user to change their password securely.

### Files

```text
backend/src/modules/auth/auth.validation.ts
backend/src/modules/auth/auth.repository.ts
backend/src/modules/auth/auth.service.ts
backend/src/modules/auth/auth.controller.ts
backend/src/modules/auth/auth.routes.ts
```

### Input

```text
currentPassword
newPassword
newPasswordConfirmation (optional; decide whether frontend-only or API-enforced)
```

### Flow

1. Authenticate access token.
2. Validate input and new-password policy.
3. Load current password hash.
4. Compare current password.
5. Reject incorrect current password generically.
6. Optionally reject reuse of the current password if approved.
7. Hash new password using configured rounds.
8. Update password and revoke all refresh sessions atomically.
9. Clear refresh cookie.
10. Instruct client to remove access token and sign in again.

### Phase 10 gate

- Old password no longer logs in.
- New password logs in.
- All prior refresh sessions fail.
- Incorrect current password changes nothing.

## 15. Phase 11 — Forgot/reset password (conditional)

### Entry condition

Do not begin until reset-token delivery/retrieval is explicitly approved.

### Files

```text
backend/src/modules/auth/auth.validation.ts
backend/src/modules/auth/auth.repository.ts
backend/src/modules/auth/auth.service.ts
backend/src/modules/auth/auth.controller.ts
backend/src/modules/auth/auth.routes.ts
```

### Forgot-password flow

1. Apply strict rate limiting.
2. Validate and normalize email.
3. Always return the same public response.
4. If an eligible user exists, invalidate/supersede active reset tokens.
5. Generate raw reset token and store only its hash with expiry.
6. Deliver the raw token only through the approved mechanism.
7. Never log or return it in production.

### Reset-password flow

1. Apply strict rate limiting.
2. Validate raw token and new password.
3. Hash token for lookup.
4. Reject unknown, expired, or consumed token.
5. Hash new password.
6. Update password, consume token, and revoke all sessions atomically.
7. Clear refresh cookie.
8. Require a fresh login.

### Phase 11 gate

- Forgot response cannot enumerate accounts.
- Raw token is absent from logs/database/production response.
- Token is single-use and expires.
- Reset revokes all sessions.
- Failure leaves password and token state safe.

## 16. Phase 12 — Authorization middleware

### Goal

Create reusable role enforcement for later modules.

### File

```text
backend/src/middleware/authorize.middleware.ts
```

### Contract

The middleware factory receives allowed values from the Prisma-generated `UserRole` enum.

Behavior:

- no `req.user` -> unauthorized;
- authenticated but disallowed role -> forbidden;
- allowed role -> continue.

Do not hardcode `ADMIN`/`STAFF` strings independently of Prisma.

### Proof routes

Do not add permanent fake/demo routes. Verify through automated middleware tests or the first real protected staff/admin endpoint.

### Phase 12 gate

Allowed, forbidden, and unauthenticated paths are tested.

## 17. Phase 13 — Security and integration review

### Review files

```text
backend/src/app.ts
backend/src/server.ts
backend/src/config/environment.ts
backend/src/middleware/rate-limit.middleware.ts
backend/src/modules/auth/*
```

### Checklist

- `cookie-parser` registered before auth routes;
- CORS uses exact configured frontend origin;
- CORS credentials enabled;
- no wildcard origin with credentials;
- Helmet registered;
- JSON body limit exists;
- rate limiters mounted on sensitive endpoints;
- production cookie is secure;
- cookie clearing attributes match cookie setting attributes;
- JWT secret validation enforces adequate length;
- bcrypt rounds are bounded to prevent unsafe/abusive configuration;
- no secrets or token values logged;
- error handler hides production stack traces;
- generated Prisma objects are projected before response;
- no second Prisma client exists;
- no `app.listen()` after Socket.IO integration.

### Phase 13 gate

Security review produces no unresolved high-risk finding.

## 18. Phase 14 — Automated tests

### Goal

Prove behavior, not merely compile code.

### Rule

Use existing test tooling. If none exists, propose a test stack separately and obtain approval before installing packages.

### Minimum test groups

#### Validation

- login input;
- new-password policy;
- reset and change inputs;
- unknown fields according to project convention.

#### Token service

- sign/verify;
- expiry;
- tampering;
- incorrect secret/algorithm;
- malformed claims;
- opaque-token generation and hashing.

#### Login

- success;
- unknown email/wrong password equivalence;
- inactive/deleted account;
- safe response projection;
- stored hash rather than raw refresh token.

#### Authentication

- valid/missing/malformed/expired token;
- current user inactive/deleted after issuance.

#### Refresh

- rotation success;
- old-token reuse;
- expiration/revocation;
- inactive owner;
- concurrency.

#### Logout

- current session;
- idempotency;
- logout-all across several sessions.

#### Passwords

- change success/failure;
- reset unknown/expired/used/success;
- session revocation after password mutation.

#### Authorization

- allowed role;
- forbidden role;
- missing authentication.

### Phase 14 gate

- All tests pass consistently.
- Tests do not depend on execution order.
- Test database data is isolated and cleaned safely.
- No production or development database is reset by tests.

## 19. Phase 15 — Manual API verification

### Goal

Verify the full browser/API-client session lifecycle.

### Ordered scenario

1. Start backend and confirm health endpoint if one exists.
2. Login as seeded admin.
3. Inspect safe JSON response.
4. Inspect refresh cookie flags.
5. Call `/me` with access token.
6. Refresh and store new access token/cookie.
7. Verify previous refresh token fails.
8. Login again to create a second device/session.
9. Logout the first session.
10. Verify the second session still refreshes.
11. Call logout-all from an authenticated session.
12. Verify every refresh session fails.
13. Log in again and change password.
14. Verify old password and old sessions fail.
15. Verify new password succeeds.
16. Execute approved reset flow if Phase 11 was enabled.

### Browser/frontend requirement

Frontend calls using the refresh cookie must use credentials, for example the approved fetch/Axios equivalent of:

```text
credentials: "include"
```

### Phase 15 gate

The complete lifecycle behaves identically to documented contracts.

## 20. Phase 16 — Final documentation and handoff

### Update

- API endpoint documentation;
- request/response examples using the real envelope;
- cookie behavior;
- environment keys;
- migration notes;
- test commands;
- known deferred behavior, especially password-reset delivery.

### Final validation commands

Use actual repository scripts discovered in Phase 0. Expected minimum:

```bash
npm run typecheck --workspace=backend
npm run build --workspace=backend
npm test --workspace=backend
npm run db:migrate --workspace=backend
```

Do not run nonexistent scripts. `db:migrate` should be used only when there is an unapplied approved migration and never casually against production.

### Final definition of done

- All approved auth endpoints work.
- Deferred endpoints are clearly marked and not falsely reported complete.
- Typecheck and build pass.
- Tests pass.
- Migration status is clean.
- No secrets are exposed.
- No unrelated files changed.
- Architecture contract and actual implementation agree.

## 21. Cursor prompt for each phase

Use this template one phase at a time:

```text
Read BAZM_BACKEND_ARCHITECTURE_CONTRACT.md and
BAZM_AUTH_API_IMPLEMENTATION_PLAN.md.

Execute Phase [NUMBER] only. Do not begin any later phase.

Before editing:
1. inspect every input file listed for this phase;
2. report repository facts discovered;
3. list the exact files you intend to change;
4. identify conflicts or unresolved blockers;
5. if any blocker exists, stop without editing.

During implementation:
- follow existing project utilities and naming;
- do not invent schema fields, helpers, dependencies, or response shapes;
- do not modify unrelated files;
- do not weaken TypeScript or security checks.

After implementation:
1. run this phase's validation gate;
2. show exact command results;
3. summarize changed files and behavior;
4. list any remaining risk;
5. stop and wait for approval before the next phase.
```

## 22. Recommended execution checkpoints

For practical development, approve work at these checkpoints:

| Checkpoint | Included phases | Working result |
|---|---|---|
| A | 0–2 | Repository and schema verified |
| B | 3–4 | Types, validation, and token primitives ready |
| C | 5–6 | Login API working |
| D | 7 | Protected `/me` working |
| E | 8 | Secure refresh rotation working |
| F | 9–10 | Logout and password change working |
| G | 11 | Password recovery, only if delivery approved |
| H | 12–16 | Authorization, tests, security review, documentation |

The first action is Phase 0. Do not start by generating auth files.
