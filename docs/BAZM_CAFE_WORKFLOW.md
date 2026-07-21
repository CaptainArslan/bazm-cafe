# BAZM Café — Complete Full-Stack Workflow Specification

> **Audience:** Claude, Cursor, backend engineers, Vue.js frontend engineers, product designers and QA engineers.
>
> **Authority:** This file is the shared source of truth for frontend and backend behavior. If code, UI, generated suggestions or older documentation conflict with this file, stop and report the conflict before changing the business rule.

## How AI coding assistants must use this file

1. Read this entire file before implementing or modifying a BAZM workflow.
2. Inspect the existing repository, schema, routes, services, stores and components before proposing changes.
3. Preserve working architecture and naming conventions unless a requirement here cannot be implemented safely.
4. Implement backend authorization and state validation even when the Vue UI hides an action.
5. Never merge `orderStatus` and `paymentStatus`.
6. Never treat successful compilation as complete verification. Run role, HTTP, database, concurrency and Socket.IO workflows.
7. Do not introduce excluded V1 modules.
8. When a route or filename below differs from the existing repository convention, preserve the convention while maintaining the behavior.

## Technology baseline

### Backend

- Node.js
- Express
- TypeScript in strict mode
- Prisma ORM 7
- MySQL/MariaDB adapter
- Zod request validation
- JWT access tokens
- Opaque refresh tokens in HttpOnly cookies
- bcrypt
- Socket.IO

### Frontend

- Vue.js 3
- TypeScript
- Composition API with `<script setup lang="ts">`
- Vue Router
- Pinia for shared application state
- Socket.IO client
- Responsive PWA-style application UI
- Native phone camera for table QR scanning in V1

### Full-stack boundary

- HTTP APIs are authoritative.
- Socket.IO events are invalidation/notification signals, not the permanent state store.
- The backend owns permissions, monetary calculations, state transitions, table safety, token validation and receipt authorization.
- The frontend owns presentation, interaction state, accessible feedback and refetching authoritative data.
- The frontend must never calculate or submit authoritative prices, balances, payment statuses, table states or permitted next transitions.

---

**BAZM CAFÉ**

**Complete Application Workflow**

**Customer • Staff • Admin**

V1 operational specification for local café ordering, table sessions, order fulfillment, payments, receipts and recovery

| **Document** | **Value**                                                       |
|--------------|-----------------------------------------------------------------|
| Purpose      | Single source of truth for product, UI/UX, API and QA workflows |
| Version      | V1.1                                                            |
| Prepared     | 19 July 2026                                                    |
| Status       | Aligned with implemented `/api/v1` routes (see API_TESTING.md)  |
| Core rule    | Many orders per session; separate order and payment statuses    |

| **Non-negotiable:** Order status describes operational fulfillment. Payment status describes financial settlement. They are stored, displayed and transitioned separately. |
|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 1. Document purpose and scope

This document defines the complete end-to-end behavior of the BAZM Café V1 applications for customers, operational staff and administrators. It is intended to guide backend implementation, interface design, authorization, test planning and café operations.

## 1.1 V1 scope

- Local café Wi-Fi and captive-portal entry

- Dine-in table QR sessions and parcel sessions

- Guest ordering without customer accounts

- Multiple separate orders under one guest session

- Staff order fulfillment

- Admin-only payment recording and reversal

- HTML and downloadable image receipts

- Table/session recovery, expiry, release and force release

- Real-time Socket.IO notifications with HTTP as the authoritative source

## 1.2 Explicit exclusions

- Inventory, stock, ingredients, recipes and measurement units

- Suppliers and purchase orders

- Physical kitchen or branch management

- Online payment gateway integration

- Customer login/accounts

- Reports and advanced analytics

- Taxes, discounts, tips, service charges and delivery fees unless separately approved

> **Implemented note (V1):** Cafe-wide `taxRatePercent` and `serviceChargePercent` via `/api/v1/settings` are applied on guest order create. Per-line discounts, tips, and delivery fees remain out of scope.
# 2. Actors and authority

| **Capability**              | **Customer** | **Staff**         | **Admin**     |
|-----------------------------|--------------|-------------------|---------------|
| Start guest session         | Yes          | Assist only       | Assist/manage |
| Browse menu / place order   | Own session  | No                | No            |
| Track orders                | Own session  | Operational queue | All orders    |
| Accept/reject pending order | No           | Yes               | Yes           |
| Advance fulfillment         | No           | Yes               | Yes           |
| Attach/create customer      | No           | Yes               | Yes           |
| Cancel accepted order       | No           | No                | Yes           |
| Record/reverse payment      | No           | No                | Yes           |
| Normal table release        | No           | Safe sessions     | Safe sessions |
| Force table release         | No           | No                | Yes           |
| Manage CRUD modules         | No           | No                | Yes           |
| Generate recovery code      | Redeem only  | Yes               | Yes           |

| **Least privilege:** The interface must hide unavailable actions, but the backend must independently enforce every permission. Hidden buttons are not security. |
|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 3. Canonical domain model

The workflow depends on clear ownership. A guest session represents one dining or parcel visit. It can own many orders. Each order owns immutable item snapshots and many payments.

| **Entity**    | **Relationship and responsibility**                                                                   |
|---------------|-------------------------------------------------------------------------------------------------------|
| Table         | Has at most one active dine-in guest session.                                                         |
| Guest Session | Belongs to zero or one table; has many orders; may reference one customer.                            |
| Order         | Belongs to one guest session; has separate orderStatus and paymentStatus.                             |
| Order Item    | Belongs to one order and preserves product name, price and preparation snapshots.                     |
| Payment       | Belongs to one order; immutable financial record; may be reversed with audit history.                 |
| Receipt       | Represents an order/payment state and remains securely accessible for 24 hours after session closure. |
| Recovery Code | Short-lived, single-use authorization to recover an existing session on another device.               |
| Audit Event   | Append-only record of sensitive operational and financial actions.                                    |

# 4. Two independent status systems

## 4.1 Order status

| **Status** | **Meaning**                                                  | **Next allowed outcome**                                 |
|------------|--------------------------------------------------------------|----------------------------------------------------------|
| PENDING    | Submitted; awaiting operational decision.                    | ACCEPTED or REJECTED                                     |
| ACCEPTED   | Accepted for fulfillment.                                    | PREPARING or CANCELLED                                   |
| PREPARING  | Actively being prepared.                                     | READY or CANCELLED                                       |
| READY      | Ready for handoff/service.                                   | SERVED or CANCELLED                                      |
| SERVED     | Delivered to customer; may still owe money.                  | COMPLETED by system after full payment                   |
| COMPLETED  | Served and fully settled.                                    | May return to SERVED only after audited payment reversal |
| REJECTED   | Rejected before acceptance; reason required.                 | Terminal                                                 |
| CANCELLED  | Admin cancelled accepted/in-progress order; reason required. | Terminal                                                 |

## 4.2 Payment status

| **Status**     | **Calculation**              | **Meaning**                         |
|----------------|------------------------------|-------------------------------------|
| UNPAID         | totalPaid = 0                | No valid payment recorded.          |
| PARTIALLY_PAID | 0 \< totalPaid \< orderTotal | Outstanding balance remains.        |
| PAID           | totalPaid = orderTotal       | Financial obligation fully settled. |

| **Separation rule:** Payment status is derived from valid, non-reversed payment records. Clients never directly edit it. A SERVED order can be UNPAID or PARTIALLY_PAID; a COMPLETED order must be PAID. |
|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 5. Shared cross-role lifecycle

| **Business event**         | **Customer experience**                           | **Staff experience**                                     | **Admin experience**                  |
|----------------------------|---------------------------------------------------|----------------------------------------------------------|---------------------------------------|
| Session starts             | Menu opens under table/parcel session.            | Table appears occupied or parcel session appears active. | Can inspect session and audit trail.  |
| Order submitted            | Order receipt and Pending tracking.               | New order enters queue.                                  | Same operational visibility.          |
| Order accepted             | Timeline moves to Accepted.                       | Accept action recorded.                                  | May supervise.                        |
| Preparation                | Live Preparing/Ready updates.                     | Advances explicit actions.                               | May perform same actions.             |
| Service                    | Order shows Served and payment status separately. | May need to attach customer first.                       | Can record payment.                   |
| Partial payment            | Receipt shows remaining balance.                  | Sees status only.                                        | Records immutable payment.            |
| Full payment               | Order becomes Completed.                          | Sees completion.                                         | System completes after final payment. |
| All session orders settled | Session closes; receipts remain available.        | Table becomes available.                                 | Can verify settlement/release.        |

# 6. Customer application workflow

## 6.1 Entering through café Wi-Fi

1.  Customer connects to the café Wi-Fi.

2.  Captive portal opens BAZM or the customer navigates to the local BAZM address.

3.  Customer selects Dine In or Parcel.

4.  The application checks network/server availability and displays a recoverable error if the local service cannot be reached.

## 6.2 Dine-in session start

1.  Customer selects Dine In.

2.  Application instructs the customer to scan the printed table QR using the phone’s native camera.

3.  QR opens the secure local table URL containing an opaque `tableToken` (not the table UUID). Manual entry of that same long token is a camera fallback until a short table code exists. Resolve via `POST /api/v1/guest/tables/resolve`; start session via `POST /api/v1/guest/sessions` with `orderType: "DINE_IN"` and `tableToken`.

4.  Backend hashes and validates the token, verifies that the table is active and checks for an existing session.

5.  If available, the backend transactionally creates one active guest session, authorizes the browser with a secure credential, marks the table occupied and opens the menu.

6.  The customer sees the table number, session state and an empty order list.

## 6.3 Occupied table outcomes

| **Condition**                 | **System behavior**                       | **Customer result**                                              |
|-------------------------------|-------------------------------------------|------------------------------------------------------------------|
| Same authorized browser       | Restore existing session; create nothing. | Menu and existing orders reopen.                                 |
| Different unauthorized device | Return conflict without private data.     | Message advises original device or staff recovery.               |
| Expired/closed session        | Do not restore ordering authority.        | Show closed/expired state and valid receipt access if available. |
| Out-of-service table          | Reject session creation.                  | Show table unavailable and ask customer to contact staff.        |

## 6.4 Parcel session start

1.  Customer selects Parcel.

2.  Customer enters name and phone; both are required.

3.  Backend validates input, creates or associates the lightweight customer record according to matching policy, then creates the parcel guest session.

4.  Menu opens. No physical table is occupied.

## 6.5 Menu and cart

- Show only active and available products from active categories.

- Product card shows name, description, current selling price, optional image and preparation time (`preparationMinutes`).
- Images are optional: admin/staff upload via `/api/v1/media`, then set `imagePath` on the entity.

- Customer may add quantities, remove items and add an order note before submission.

- Client-provided prices and totals are never authoritative; backend recalculates from current product records.

- Unavailable/deactivated products are rejected during final submission even if they remained in an old cart.

## 6.6 Submit order

1.  Customer reviews items and submits.

2.  Backend verifies session authority and active state.

3.  Backend validates every product, snapshots product name, unit price and preparation time, calculates line totals and total, and calculates the estimate as the maximum preparation time among items.

4.  Order is created with orderStatus PENDING and paymentStatus UNPAID.

5.  After commit, order:created is emitted to the authorized session room and operations room.

6.  Customer receives an Order Placed receipt and returns to the active session screen.

## 6.7 Place multiple orders

The guest session remains the visit container. Each new submission creates a separate order; it never appends items to an already submitted order.

1.  Customer returns to the menu using Place Another Order.

2.  Customer creates a new cart while existing orders continue their own timelines.

3.  New submission creates a new order number under the same session.

4.  Session overview lists every order independently and shows the combined outstanding balance.

5.  Customer may repeat this process while the session remains active.

## 6.8 Customer tracking and receipts

- Each order card shows order number, order status, payment status, total, paid and remaining.

- The canonical order timeline never includes Unpaid, Partially Paid or Paid.

- Socket events prompt a fresh HTTP fetch; cached events do not become the source of truth.

- Order Placed, Partially Paid and Fully Paid receipts are distinct states.

- After closure, secure receipt links remain available for 24 hours on the local network.

# 7. Staff application workflow

## 7.1 Staff sign-in and operations queue

1.  Staff signs in through the authenticated application.

2.  Backend verifies active user, role and session.

3.  Staff joins the server-authorized operations room.

4.  Queue is fetched through HTTP and grouped/filterable by Pending, Accepted, Preparing, Ready and Served.

5.  New socket notifications trigger queue refresh without trusting event payload as final state.

## 7.2 Accept or reject pending order

1.  Staff opens a PENDING order and reviews items, notes, order type and estimate.

2.  Accept invokes an explicit action; backend atomically verifies the order is still PENDING and changes it to ACCEPTED.

3.  Reject requires a reason; backend changes PENDING to REJECTED.

4.  If another operator acted first, show the latest state instead of overwriting it.

5.  Emit the appropriate event only after commit.

## 7.3 Fulfillment progression

1.  From ACCEPTED, staff selects Start Preparing.

2.  From PREPARING, staff selects Mark Ready. The estimate reaching zero never performs this action automatically.

3.  From READY, staff selects Mark Served.

4.  The backend forbids skipped transitions and arbitrary status selection.

## 7.4 Customer required before service

1.  When a dine-in order is READY and will remain financially outstanding, staff selects Mark Served.

2.  If no customer is attached to the session, the system blocks the transition with Customer Required.

3.  Staff searches and selects an existing customer, or creates one with required name and optional phone.

4.  Customer is attached to the session and inherited by its orders.

5.  Staff retries/continues Mark Served; backend changes orderStatus to SERVED while paymentStatus remains UNPAID or PARTIALLY_PAID.

## 7.5 Session recovery assistance

1.  Staff verifies the customer is physically associated with the table/session.

2.  Staff opens the active session and requests Generate Recovery Code.

3.  System creates a cryptographically secure, single-use code valid for five minutes and revokes older unused codes.

4.  Staff gives the code to the customer.

5.  Customer enters it on the second device; successful redemption authorizes that device for the existing session and immediately consumes the code.

6.  No duplicate session, order or table claim is created.

## 7.6 Normal table release

Staff may release only a safely releasable session. The backend—not the UI—makes the final decision.

- Every order must be COMPLETED, REJECTED or CANCELLED.

- No PENDING, ACCEPTED, PREPARING, READY or SERVED order may remain.

- No UNPAID or PARTIALLY_PAID balance may remain.

- Combined session outstanding balance must equal zero.

- If blocked, the interface identifies the blocking orders.

| **Staff boundary:** Staff cannot record or reverse payments, cancel accepted orders, force-release an unsafe table, manage core CRUD data or manually complete an order. |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 8. Admin application workflow

## 8.1 Administrative overview

Admin sees the operational picture plus financial and configuration controls. Dashboard cards include Pending, Preparing, Ready, Served and Unpaid, Partially Paid, Completed Today, Available Tables and Occupied Tables.

## 8.2 Order operations

- Admin can perform the same explicit fulfillment actions as staff.

- Admin alone may cancel ACCEPTED, PREPARING or READY orders; reason is mandatory.

- Admin cannot cancel SERVED, COMPLETED, REJECTED or already CANCELLED orders through the normal V1 workflow.

- Admin cannot manually set COMPLETED; full payment after service triggers it.

- Submitted order items are not editable. A correction uses cancellation and replacement.

## 8.3 Record payment

1.  Admin opens a SERVED order.

2.  Screen separately shows orderStatus, paymentStatus, total, total paid, remaining balance and payment history.

3.  Admin selects method: Cash, Card, Easypaisa, JazzCash, Bank Transfer or Other.

4.  Admin enters an amount no greater than the remaining balance and an optional reference.

5.  Request includes an idempotency key.

6.  Backend transaction locks/rechecks the aggregate, rejects invalid or duplicate payment, creates the immutable payment and recalculates financial fields.

7.  Partial settlement sets paymentStatus PARTIALLY_PAID and leaves orderStatus SERVED.

8.  Final settlement sets paymentStatus PAID and system-transitions SERVED to COMPLETED.

9.  Events are emitted after commit and the final receipt becomes available.

## 8.4 Reverse an incorrect payment

1.  Admin opens the original payment and selects Reverse/Void.

2.  A reason is required; the original record is never deleted or rewritten.

3.  Backend creates append-only reversal evidence or equivalent immutable reversal metadata.

4.  Totals and paymentStatus are recalculated.

5.  If a COMPLETED order is no longer fully paid, orderStatus returns to SERVED and paymentStatus becomes UNPAID or PARTIALLY_PAID.

6.  Session/table safety is recalculated; history remains visible.

## 8.5 Force-release unsafe table

1.  Admin opens an occupied session that cannot be normally released.

2.  System lists every blocking order and the combined outstanding balance.

3.  Admin selects Force Release, reviews the consequences and provides a mandatory reason.

4.  Backend transaction closes the guest session and makes the table available.

5.  Orders, customers, payments, receipts and outstanding balances are preserved.

6.  No order is silently marked Paid, Completed or Cancelled.

7.  Audit event and guest-session:force-closed/table:released notifications are issued after commit.

# 9. Admin CRUD workflows

| **Module**  | **Create / update rules**                                                                          | **Deletion and history rules**                                               |
|-------------|----------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------|
| Staff       | Create profile/login, optional image, activate/deactivate, admin password reset.                   | Deactivate staff with history; do not remove audit identity.                 |
| Customers   | Name required; phone optional; optional image; search before duplicate creation.                   | Do not hard-delete customers with orders/payments.                           |
| Categories  | Create, view, edit, order, optional image, activate/deactivate.                                    | Block unsafe deletion when referenced; historical data remains intact.       |
| Products    | Name, category, description, price, `preparationMinutes`, optional image, stock, available, order. | Historical order snapshots remain unchanged; deactivate referenced products. |
| Media       | Upload JPEG/PNG/WebP/GIF to `/uploads/media/{folder}`; attach returned `path` as `imagePath`.      | Delete only under `/uploads/media/`; entity may keep a stale path if deleted.|
| Tables / QR | Create/edit table, set available/out of service, regenerate QR. Raw `tableToken` never returned by table APIs. | Editing does not change QR; regenerate issues a new token; history prevents hard deletion. |
| Settings    | Admin sets tax % and service charge % (defaults 0).                                                | Singleton row; no delete.                                                    |
| Orders      | Action workflow only.                                                                              | No unrestricted CRUD or item editing.                                        |
| Payments    | Create and reverse immutable records (admin).                                                      | Never directly edit or hard-delete.                                          |

## 9.1 Standard CRUD state coverage

- List, pagination, search and filters

- View detail

- Create form, validation, submission loading and success

- Edit form, update validation and success

- Activate/deactivate confirmation

- Safe delete or deletion-blocked explanation

- Empty, loading, network error and permission-denied states

- Mobile, tablet and desktop layouts

- Audit attribution for sensitive actions

# 10. Table and guest-session state rules

| **Table state** | **Definition**                              | **Allowed entry/exit**                                                     |
|-----------------|---------------------------------------------|----------------------------------------------------------------------------|
| AVAILABLE       | No active dine-in session and not disabled. | May start a new session.                                                   |
| OCCUPIED        | Exactly one active dine-in session exists.  | Restore authorized device, recover, normal release or admin force release. |
| OUT_OF_SERVICE  | Explicitly disabled by admin.               | Cannot start a guest session until re-enabled.                             |

## 10.1 Empty-session expiry

1.  A server-side cleanup process selects active sessions with at least 30 minutes of inactivity.

2.  It confirms the session contains no orders and no outstanding balance.

3.  It atomically expires the session and releases the table.

4.  It emits guest-session:expired and table:released after commit.

5.  Socket disconnection alone never closes or expires a session.

## 10.2 Session closure after settlement

Completing or fully paying one order never closes a multi-order session. Even when every current order is settled, the visit stays active so the customer may place another order. The session closes only when the customer selects End Session, staff/admin performs a safe release, or a server-side inactivity rule expires a fully settled session. Every normal closure path first confirms that all orders are terminal and the combined outstanding balance is zero.

| **Finalized multi-order rule:** Final payment completes the individual SERVED order but does not automatically close the guest session or release the table. |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 11. Financial calculations and safeguards

| **Rule**             | **Required behavior**                                               |
|----------------------|---------------------------------------------------------------------|
| Order total          | Sum immutable line totals; V1 total equals subtotal.                |
| Money representation | Use Decimal or integer minor units; never binary floating point.    |
| Total paid           | Sum valid, non-reversed payments.                                   |
| Remaining            | orderTotal minus totalPaid.                                         |
| Overpayment          | Reject amount greater than remaining.                               |
| Invalid amount       | Reject zero and negative values.                                    |
| Concurrency          | Lock/recheck in transaction; two final payments cannot overpay.     |
| Idempotency          | Repeated request with the same key must not create another payment. |
| Authorization        | Only Admin records or reverses payment.                             |
| Customer balance     | Calculated from orders/payments; never manually editable.           |

# 12. Receipts and post-session access

- Order Placed receipt: order details, orderStatus PENDING, paymentStatus UNPAID.

- Partially Paid receipt: payment history, amount paid now, total paid and remaining.

- Fully Paid/Completed receipt: payment success, remaining zero, payment method/reference, PAID and COMPLETED shown separately.

- Customer can view HTML and download a receipt image.

- A separate opaque/signed receipt credential provides access for 24 hours after session closure.

- Receipt credential is not the guest-session credential and reveals no internal IDs or token hashes.

- Expired access shows a safe expired state without receipt data.

# 13. Real-time event workflow

| **Event group** | **Events**                                                                               | **Consumers**                                            |
|-----------------|------------------------------------------------------------------------------------------|----------------------------------------------------------|
| Order           | order:created, accepted, rejected, status-updated, cancelled, payment-updated, completed | Authorized guest session; operations room as appropriate |
| Table/session   | table:occupied, table:released, guest-session:expired, closed, force-closed              | Operations room and affected guest room                  |
| Recovery        | No raw code through Socket.IO                                                            | HTTP response only to authorized generator/redeemer      |

- Join rooms only after server-side authentication/authorization.

- Never trust a client-selected room name or session ID.

- Emit after database commit only.

- Use stable public identifiers and event timestamps, without secrets.

- On reconnect, refetch authoritative HTTP state.

- Prevent duplicate emission during retries/idempotent operations.

# 14. Errors, conflicts and recovery behavior

| **Scenario**                     | **Expected response / UX**                                      |
|----------------------------------|-----------------------------------------------------------------|
| Occupied table from other device | 409 TABLE_SESSION_ALREADY_ACTIVE; no private data.              |
| Stale order action               | Conflict; refresh and show current status.                      |
| Customer required                | Business-rule error with attach/create customer flow.           |
| Unsafe normal release            | Blocked with specific orders/balances.                          |
| Expired recovery code            | Reject; allow staff to generate a new code.                     |
| Duplicate payment                | Idempotent original result or conflict; never duplicate record. |
| Overpayment                      | Validation failure showing maximum remaining amount.            |
| Socket disconnected              | Show reconnecting; continue authoritative HTTP behavior.        |
| Product unavailable at submit    | Reject affected item and return customer to cart.               |
| Receipt expired                  | Secure expired state without data leakage.                      |

# 15. Security and privacy controls

- Store only hashes of table QR, guest authorization and recovery tokens where persistent comparison is required.

- Use cryptographically secure random tokens, explicit expiration and revocation.

- Use HttpOnly, Secure where supported, and appropriate SameSite cookie settings.

- Rate-limit login, QR validation, recovery generation/redemption, guest ordering and receipt access.

- Validate all request bodies with Zod and reject unknown/unsafe data according to project conventions.

- Never expose raw tokens/hashes, password data, refresh tokens or unnecessary customer details in API or events.

- Apply object-level authorization: a guest can access only its own session/orders/receipts.

- Record actor, action, entity, timestamp and reason in append-only audit events without secrets.

- Use transactions for table claims, order transitions, payments, reversals, QR regeneration and releases.

# 16. Audit requirements

| **Action**                             | **Actor**          | **Mandatory evidence**                               |
|----------------------------------------|--------------------|------------------------------------------------------|
| Accept/reject/cancel/status transition | Staff/Admin/System | Before/after status; reason for reject/cancel        |
| Customer attach                        | Staff/Admin        | Session/order reference and customer reference       |
| Payment create/reverse                 | Admin              | Amount, method, original/reversal reference, reason  |
| QR regenerate                          | Admin              | Table and timestamp; never token/hash                |
| Recovery generate/redeem               | Staff/Admin/Guest  | Session reference, expiry/use result; never raw code |
| Normal/force release                   | Staff/Admin        | Safety result; reason for force release              |
| Staff activation                       | Admin              | Target staff and before/after state                  |

# 17. End-to-end acceptance scenarios

### A. Multiple dine-in orders

Create one table session; submit two orders; confirm separate order numbers, independent statuses and occupied table.

### B. Partial payment

Advance one order to SERVED; record partial payment; confirm orderStatus SERVED and paymentStatus PARTIALLY_PAID.

### C. One paid, one outstanding

Fully pay first order; confirm COMPLETED/PAID while session and table remain active because the second order is outstanding.

### D. Full settlement

Settle every served order; confirm orders complete while the session remains active until End Session, safe release or settled-session inactivity expiry.

### E. Same-device restore

Rescan QR in authorized browser; restore session without duplication.

### F. Other-device protection

Scan occupied table from unauthorized device; receive safe 409 response.

### G. Recovery code

Generate, redeem once, reject reuse and expiry; restore the same session.

### H. Payment concurrency

Submit simultaneous final payments; prevent overpayment and duplicate completion/events.

### I. Payment reversal

Reverse part of a fully paid order; preserve history; return order to SERVED and appropriate payment status.

### J. Force release

Leave one order outstanding; block staff release; allow audited admin force release without changing order/payment facts.

### K. Empty expiry

Create no-order session; wait eligibility period; server expires and releases it.

### L. Authorization

Prove customer/staff cannot call admin payment, cancellation or force-release operations.

# 18. Cross-team implementation checklist

## 18.1 Backend

- Separate enums/fields and response schemas for orderStatus and paymentStatus

- GuestSession has-many Orders and safe aggregate calculations

- Explicit order action endpoints; no generic status mutation

- Transactional table claim, payments, reversals and releases

- Secure same-device credential and recovery-code lifecycle

- 24-hour receipt-access credential

- Post-commit Socket.IO events

- Audit log and authorization coverage

- Concurrency, idempotency and end-to-end tests

## 18.2 Product design

- Customer/Staff/Admin lanes aligned by business event

- Both statuses visible and never merged

- Multiple-order session overview and combined outstanding amount

- Recovery, blocked release, force release and reversal screens

- Complete loading, empty, offline, conflict and permission states

- Consistent icons, timeline, payment indicators and responsive filters

- Premium full-page receipt states

## 18.3 QA

- HTTP and database assertions—not compile-only verification

- Role-by-role positive and negative authorization tests

- Multiple-order, payment, reversal and release workflows

- Same-device/different-device/recovery tests

- Concurrency and idempotency tests

- Socket authorization, reconnect and no-duplicate-event tests

- Real iPhone/Android captive-portal and local-DNS proof of concept

# 19. Final decisions register

| **Decision**           | **Final V1 position**                                                                                               |
|------------------------|---------------------------------------------------------------------------------------------------------------------|
| Session order capacity | One guest session supports unlimited separate orders while active.                                                  |
| Status model           | orderStatus and paymentStatus are always separate.                                                                  |
| Completion             | System completes a SERVED order only after full payment.                                                            |
| Payment ownership      | Only Admin records or reverses payments.                                                                            |
| Recovery               | Same device restores; another device requires single-use five-minute recovery code.                                 |
| Receipt retention      | Secure access for 24 hours after session closure.                                                                   |
| Table safety           | All orders and balances evaluated; one completed order never releases the table.                                    |
| Session closure        | Final payment completes an order, not the visit; End Session, safe release or settled-session inactivity closes it. |
| Force release          | Admin-only; preserves orders, payments, customer and debt.                                                          |
| Historical integrity   | Submitted items and payments are immutable; corrections use cancellation/reversal.                                  |
| Networking             | Native camera QR is preferred; real-device captive-portal testing is mandatory.                                     |

# 20. Final closure workflow

1.  Customer selects End Session, staff/admin selects normal Release, or the settled-session inactivity rule becomes eligible.

2.  Backend verifies that every order is COMPLETED, REJECTED or CANCELLED and combined outstanding balance is zero.

3.  If an order or balance blocks closure, the request is rejected and the blocking records are returned safely.

4.  If safe, backend closes the guest session and releases the dine-in table in one transaction.

5.  After commit, affected clients receive guest-session:closed and table:released notifications.

6.  Ordering authority ends, while secure receipts remain accessible for 24 hours.

| **Result:** The customer can place unlimited orders during one visit, and the table is never released merely because one individual order was paid. |
|-----------------------------------------------------------------------------------------------------------------------------------------------------|

---

# 21. Backend implementation contract — Node.js, Express and TypeScript

## 21.1 Module boundaries

The V1 backend contains these modules:

```text
auth
staff
customers
tables
categories
products
guest-sessions
orders
payments
receipts
socket
audit
```

Each module should follow the existing repository convention. A typical separation is:

```text
module.routes.ts       Express route registration
module.validation.ts   Zod request and parameter schemas
module.controller.ts   HTTP adaptation only
module.service.ts      Transactions and business rules
module.repository.ts   Prisma persistence queries
module.types.ts        Domain and transport types
module.constants.ts    Stable messages, events and constants
index.ts               Public module exports
```

Controllers must not contain transaction orchestration or duplicate business rules. Repositories must not decide actor permissions or state transitions. Services own workflows and use repositories within explicit Prisma transactions.

## 21.2 Canonical TypeScript enums

Use Prisma-generated enums when available. Do not create competing strings with different spelling.

```ts
export enum OrderStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  PREPARING = "PREPARING",
  READY = "READY",
  SERVED = "SERVED",
  COMPLETED = "COMPLETED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}

export enum PaymentStatus {
  UNPAID = "UNPAID",
  PARTIALLY_PAID = "PARTIALLY_PAID",
  PAID = "PAID",
}

export enum PaymentMethod {
  CASH = "CASH",
  CARD = "CARD",
  EASYPAISA = "EASYPAISA",
  JAZZCASH = "JAZZCASH",
  BANK_TRANSFER = "BANK_TRANSFER",
  OTHER = "OTHER",
}
```

Every relevant order response exposes both status fields:

```ts
interface OrderSummaryResponse {
  id: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  total: string;
  totalPaid: string;
  remainingBalance: string;
  allowedActions: string[];
}
```

Return money as normalized decimal strings or the project's documented minor-unit representation. Do not encourage JavaScript floating-point calculations.

## 21.3 Persistence invariants

- A table has no more than one active dine-in guest session.
- A guest session has many independent orders.
- An order belongs to exactly one guest session and stores both statuses.
- An order item preserves product name, unit price and preparation-time snapshots.
- A payment belongs to one order and cannot be edited or hard-deleted.
- A reversal preserves the original payment, actor, reason and timestamp.
- Persisted QR, guest, recovery and receipt credentials are stored as secure hashes.
- A recovery code is session-scoped, single-use and short-lived.
- Audit events are append-only.
- Referenced records are deactivated or soft-deleted instead of destroyed.

Use database constraints and indexes in addition to service checks wherever possible. Table claims, transitions, payments, reversals, QR regeneration and releases require transactions.

## 21.4 API response contract

Follow the existing response helper. Responses must be predictable and machine-readable.

```json
{
  "success": true,
  "message": "Order accepted successfully.",
  "data": {
    "id": "public-order-id",
    "orderNumber": "BAZM-1024",
    "orderStatus": "ACCEPTED",
    "paymentStatus": "UNPAID"
  }
}
```

```json
{
  "success": false,
  "code": "INVALID_ORDER_TRANSITION",
  "message": "Only a pending order can be accepted.",
  "details": { "currentOrderStatus": "PREPARING" }
}
```

Validation errors map field paths to stable messages. Never leak stack traces, Prisma errors, token hashes or internal sequential IDs.

## 21.5 Implemented API route map

Authoritative testing reference: [`backend/docs/API_TESTING.md`](../backend/docs/API_TESTING.md). Summary:

### Guest routes

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/v1/guest/sessions` | Create takeaway or dine-in session (`tableToken` required for dine-in). |
| `POST` | `/api/v1/guest/tables/resolve` | Validate QR/`tableToken` and return table preview (no session). |
| `POST` | `/api/v1/guest/sessions/recover` | Redeem a single-use recovery code. |
| `GET` | `/api/v1/guest/sessions/current` | Current authorized session. |
| `POST` | `/api/v1/guest/sessions/close` | End settled session; may issue receipt-access cookie. |
| `GET` | `/api/v1/guest/menu` | Visible categories / available products. |
| `POST` | `/api/v1/guest/orders` | Create order under the current session. |
| `GET` | `/api/v1/guest/orders` | List current session orders. |
| `GET` | `/api/v1/guest/orders/:orderPublicId` | View an order owned by the current session. |
| `GET` | `/api/v1/guest/orders/:orderPublicId/receipt` | Session HTML receipt. |
| `GET` | `/api/v1/guest/orders/:orderPublicId/receipt-image` | Session receipt image. |
| `GET` | `/api/v1/receipts/orders/:orderPublicId`… | Post-close receipt access via `bazm_receipt_access` cookie. |

### Staff/Admin operational routes

| Method | Route | Authorization | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/orders` | Staff/Admin | Filtered operational queue. |
| `POST` | `/api/v1/orders/:id/accept` | Staff/Admin | `PENDING → ACCEPTED`. |
| `POST` | `/api/v1/orders/:id/reject` | Staff/Admin | `PENDING → REJECTED`; reason required. |
| `POST` | `/api/v1/orders/:id/start-preparing` | Staff/Admin | `ACCEPTED → PREPARING`. |
| `POST` | `/api/v1/orders/:id/mark-ready` | Staff/Admin | `PREPARING → READY`. |
| `POST` | `/api/v1/orders/:id/mark-served` | Staff/Admin | `READY → SERVED`; customer rule enforced. |
| `POST` | `/api/v1/orders/:id/cancel` | Admin | Cancel Accepted, Preparing or Ready; reason required. |
| `POST` | `/api/v1/orders/:id/payments` | Admin | Record immutable payment with idempotency. |
| `POST` | `/api/v1/payments/:id/reverse` | Admin | Audited reversal; reason required. |
| `POST` | `/api/v1/guest-sessions/:id/recovery-codes` | Staff/Admin | Generate recovery code. |
| `POST` | `/api/v1/tables/:id/release` | Staff/Admin | Safe table/session release. |
| `POST` | `/api/v1/tables/:id/force-release` | Admin | Force release; preserve records and debt. |
| `POST`/`DELETE` | `/api/v1/media` | Staff/Admin | Optional image upload / delete. |
| `GET`/`PATCH` | `/api/v1/settings` | Staff get / Admin patch | Tax and service charge %. |

Admin resource routes provide list/search/view/create/update/status for staff, customers, categories, products and tables/QR. Optional `imagePath` on staff, customers, categories, products. Products include `preparationMinutes`. Orders remain action workflows; payments remain immutable records (with admin reverse).

## 21.6 Explicit transition service

Never accept a generic `{ "orderStatus": "COMPLETED" }` update.

```ts
const allowedOrderTransitions: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING: [OrderStatus.ACCEPTED, OrderStatus.REJECTED],
  ACCEPTED: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  PREPARING: [OrderStatus.READY, OrderStatus.CANCELLED],
  READY: [OrderStatus.SERVED, OrderStatus.CANCELLED],
  SERVED: [OrderStatus.COMPLETED],
  COMPLETED: [OrderStatus.SERVED], // system-only after payment reversal
  REJECTED: [],
  CANCELLED: [],
};
```

This map does not grant permission. Every command verifies actor role, current database state, required reason/customer, financial preconditions and concurrency protection.

## 21.7 Payment transaction algorithm

1. Serialize access to the order/payment aggregate inside a transaction.
2. Verify the actor is Admin and the order is `SERVED`.
3. Recalculate `totalPaid` from valid, non-reversed payments.
4. Calculate remaining balance with Decimal/minor units.
5. Reject zero, negative, over-remaining or duplicate payment requests.
6. Enforce the idempotency key.
7. Create the immutable payment.
8. Recalculate and persist `paymentStatus`.
9. If fully paid, system-transition `orderStatus` to `COMPLETED`.
10. Commit, then emit payment/completion events.

Final payment completes one order. It does not close the visit or release the table.

## 21.8 Session closure algorithm

Normal closure requires:

```text
every orderStatus ∈ {COMPLETED, REJECTED, CANCELLED}
AND combinedOutstandingBalance = 0
```

Closure begins only through Customer End Session, Staff/Admin safe release, or server expiry of a fully settled inactive session. Admin force release bypasses safety but preserves all orders, customers, payments, receipts and balances without manufacturing status changes.

## 21.9 Socket.IO contract

```ts
type OrderEventName =
  | "order:created" | "order:accepted" | "order:rejected"
  | "order:status-updated" | "order:cancelled"
  | "order:payment-updated" | "order:completed";

type SessionEventName =
  | "table:occupied" | "table:released"
  | "guest-session:expired" | "guest-session:closed"
  | "guest-session:force-closed";
```

Payloads contain stable public IDs and a server timestamp, never secret tokens or hashes. Server middleware assigns rooms after authorization. Emit only after commit. Vue handlers use events to trigger targeted HTTP refetches.

## 21.10 Backend verification gate

- Typecheck, build and configured linting
- Unit tests for calculations and transition guards
- Database integration and complete HTTP workflow tests
- Object-level authorization tests
- Simultaneous table-claim tests
- Simultaneous payment and idempotency tests
- Payment reversal and multi-order closure tests
- Socket.IO authentication, event and reconnect tests
- Receipt authorization and expiry tests

## 21.11 Authentication contract

Existing authenticated Staff/Admin endpoints:

```text
POST /api/v1/auth/login
GET  /api/v1/auth/me
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/logout-all
```

Pending V1 endpoints:

```text
POST /api/v1/auth/change-password
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
```

Access JWT claims contain `sub`, `sid` and `role`. Every protected HTTP request and Socket.IO connection verifies the user, active auth session and role. Logout revokes the current session immediately; logout-all revokes all sessions for the user. Customer guest authorization is a separate opaque mechanism and must never be treated as Staff/Admin JWT authentication.

# 22. Frontend implementation contract — Vue.js 3 and TypeScript

## 22.1 Application separation

The interface has Customer, Staff and Admin application areas with obvious routes/layouts. Shared components may be reused, but permission controls remain isolated.

```text
src/
  api/
  router/
  stores/
  composables/
  socket/
  types/
  constants/
  components/{domain,feedback,forms}/
  layouts/{CustomerLayout,StaffLayout,AdminLayout}.vue
  views/{customer,staff,admin}/
```

Use Vue 3, TypeScript, Composition API, `<script setup lang="ts">`, Vue Router, Pinia and Socket.IO client. Centralize status labels, colors and icons.

## 22.2 Shared frontend type

Prefer generated API types. Otherwise maintain one canonical module matching backend serialization.

```ts
export interface OrderViewModel {
  id: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  total: string;
  totalPaid: string;
  remainingBalance: string;
  estimatedPreparationMinutes: number;
  allowedActions: OrderAction[];
}
```

Display both statuses separately. “Served and Unpaid” may be a dashboard filter, never a stored canonical status.

## 22.3 Pinia store ownership

| Store | Responsibility |
|---|---|
| `useAuthStore` | Staff/Admin identity and access lifecycle. |
| `useGuestSessionStore` | Guest session, table/parcel context, customer and aggregate balance. |
| `useMenuStore` | Categories, products and availability. |
| `useCartStore` | Current unsent cart only. |
| `useOrdersStore` | Customer session orders or operational order queue. |
| `usePaymentsStore` | Admin payment submission and history. |
| `useTablesStore` | Tables, QR and session details. |
| `useSocketStore` | Connection lifecycle and refetch dispatch only. |

Do not use Socket.IO or Pinia as an alternate database. Do not derive authoritative balances or payment status locally.

## 22.4 Customer screens

- Welcome/captive portal and Dine In/Parcel selection
- Table QR validation, creation, same-device restoration and occupied/out-of-service states
- Parcel name/phone form
- Recovery-code entry with expired, used and rate-limited states
- Menu, product detail, cart and review
- Order Placed receipt
- Active session listing unlimited separate orders and combined outstanding amount
- Place Another Order
- Individual order tracking with separate status sections
- End Session confirmation and blocked closure
- Partial/final receipts, image download and closed-session 24-hour access
- Loading, empty, offline, reconnecting and secure error states

## 22.5 Staff screens

- Authenticated operations dashboard and order queue
- Order detail with explicit allowed actions
- Reject reason dialog
- Customer Required search/select/create/attach flow
- Active session detail
- Recovery-code generation/revocation
- Safe release and blocked-release explanation

Never render Staff controls for payment, reversal, admin cancellation, force release or Admin CRUD.

## 22.6 Admin screens

- Admin dashboard and full operational visibility
- Admin cancellation with required reason
- Unpaid, Partially Paid, Paid and All Payments lists
- Record-payment form with duplicate-submit protection
- Immutable payment history and reversal workflow
- Table sessions and force-release confirmation
- Complete CRUD for Staff, Customers, Categories, Products and Tables/QR
- Audit context for sensitive actions

## 22.7 Shared Vue components

```text
OrderStatusTimeline.vue
OrderStatusBadge.vue
PaymentStatusBadge.vue
OrderCard.vue
SessionOrderList.vue
SessionSummary.vue
PaymentHistory.vue
PaymentForm.vue
ReceiptView.vue
RecoveryCodePanel.vue
TableStateIcon.vue
ActionConfirmationDialog.vue
BusinessRuleError.vue
LoadingState.vue
EmptyState.vue
ErrorState.vue
```

`OrderStatusTimeline.vue` contains only Pending → Accepted → Preparing → Ready → Served → Completed, with Rejected/Cancelled branches. `PaymentStatusBadge.vue` contains only Unpaid, Partially Paid and Paid.

## 22.8 API interaction rules

- Keep HTTP calls in a typed API layer, not throughout components.
- Use route guards for UX and backend authorization for security.
- Disable buttons during submission and support idempotent retries.
- On stale `409`, refetch and explain that another operator acted first.
- `TABLE_SESSION_ALREADY_ACTIVE` must reveal no private data.
- After socket reconnect, refetch relevant authoritative state.
- Never optimistically mark an order Paid or Completed.
- Never send authoritative prices, totals, balances, statuses or allowed transitions.

## 22.9 Responsive design contract

- Poppins; premium gold/cream palette; deep ink neutrals
- Thin borders, minimal shadows and one icon family
- Rectangular icon filters at least 40–44px high; no tiny scrolling pills
- Outlined Available, filled Occupied and slashed Out-of-Service table icons
- Same status label/icon/color/order across every application
- Desktop, tablet and mobile coverage
- Accessible focus, keyboard, contrast, loading and error behavior

# 23. Shared full-stack sequences

## 23.1 Place another order

```text
Vue confirms active guest session
→ POST /orders with item IDs, quantities and note
→ Express validates Zod payload and guest authority
→ Service reloads products and creates snapshots
→ Prisma transaction creates a new PENDING/UNPAID order
→ Commit and emit order:created
→ Vue clears only the submitted cart and refetches session orders
→ Existing orders remain unchanged
```

## 23.2 Partial then final payment

```text
Admin Vue submits payment with idempotency key
→ Backend transaction recalculates balance
→ Partial: paymentStatus PARTIALLY_PAID; orderStatus SERVED
→ Final: paymentStatus PAID; orderStatus COMPLETED
→ Commit and emit events
→ Vue refetches order, payments and session summary
→ Guest session stays active for another order
```

## 23.3 Safe session ending

```text
Customer End Session or Staff/Admin Release
→ Backend checks every order and aggregate balance
→ Unsafe: reject with blocking orders; Vue explains the blocker
→ Safe: close session and release table transactionally
→ Emit closed/released events
→ Disable ordering and retain 24-hour receipt access
```

## 23.4 Another-device recovery

```text
Unauthorized device scans occupied table
→ Safe 409 without private data
→ Staff verifies customer and generates five-minute code
→ Customer redeems code
→ Backend validates hash, scope, expiry, revocation and one-time use
→ Existing session is authorized; no duplicate session/order
→ Vue fetches authoritative session and orders
```

# 24. Definition of done for Claude and Cursor

- Behavior matches this file and existing architecture.
- `orderStatus` and `paymentStatus` remain separate end-to-end.
- Backend authorization matches Vue action visibility.
- Multi-order behavior works under one session.
- Final payment completes one order without closing the visit.
- Safe closure evaluates every order and aggregate balance.
- Monetary calculations use Decimal/minor units.
- Sensitive tokens and hashes are never exposed.
- Typecheck, build, lint and relevant tests pass.
- HTTP, database, authorization and concurrency workflows pass.
- Socket.IO emits after commit and Vue refetches HTTP state.
- Vue covers loading, empty, error, stale, offline and permission states.
- Desktop, tablet and mobile workflows are verified.
- Changed routes, schema, migrations, components, stores and tests are reported.

If any item cannot be implemented or verified, report it explicitly. Never declare readiness from compilation or a happy-path UI demo alone.
