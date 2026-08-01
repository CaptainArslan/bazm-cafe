# Admin Panel — Manual Testing Guide

A checklist for clicking through the admin panel yourself. Go top to bottom, module by module — don't jump around or you'll lose track of what you've checked.

## 1. Setup

```bash
# terminal 1 — backend
cd backend
npm run dev          # http://localhost:3000

# terminal 2 — frontend
cd frontend
npm run dev           # http://localhost:5173
```

First time only: `cd backend && npm run db:seed` creates the admin account.

Login at `http://localhost:5173/admin/login`:

- **Email:** `admin@bazm.local`
- **Password:** `password`

## 2. General checks (do these once, keep in mind for every screen after)

- [ ] Resize the browser to phone width (or open DevTools device toolbar). The top bar should show a **Menu** button; clicking it slides in a sidebar with a dark backdrop, and clicking the backdrop (or a nav link) closes it.
- [ ] On desktop width, the sidebar is always visible on the left, no Menu button.
- [ ] Click every link in the sidebar once — Dashboard, Orders, Cancellations, Payments, Categories, Products, Stock, Media, Customers, Staff, Tables & QR, Settings. Confirm the active link is highlighted gold.
- [ ] Click **Sign out**, confirm you land back on `/admin/login`, and that visiting `/admin` directly while logged out redirects to login instead of showing a blank/duplicated page.
- [ ] Throughout every module below: turn off the backend (Ctrl+C in its terminal) briefly to trigger a load error, confirm you see a friendly error message with a **Retry** button, then restart the backend and click Retry.

## 3. Dashboard (`/admin`)

- [ ] Four tiles load: Today's Orders, Needs Attention, Today's Revenue, Low Stock.
- [ ] "Needs Attention" count matches the number of Pending + Accepted orders you can see in the Orders screen.
- [ ] "Low Stock" count matches the number of red rows you see in the Stock screen.

## 4. Orders (`/admin/orders`)

- [ ] Click through each status filter chip (All, Pending, Accepted, Preparing, Ready, Served, Cancelled) — the list updates for each.
- [ ] Click an order row to expand its detail panel; click again to collapse.
- [ ] Empty filter (e.g. a status with no orders) shows the "No orders" empty state, not a blank screen.

## 5. Cancellations (`/admin/cancellations`)

- [ ] Read-only audit list — confirm there are no action buttons, just cancelled orders with reason/date.
- [ ] Cross-check: every order you cancel elsewhere in the app should eventually show up here.

## 6. Payments (`/admin/payments`)

- [ ] **Record a payment:** click **+ Record Payment**. The Order dropdown should only list *served* orders with a remaining balance. Fill amount, method, optional reference, save — new payment appears at the top of the list with status COMPLETED.
- [ ] **Reverse a payment:** click **Reverse** on a COMPLETED payment, type a reason, confirm. Status should update and show "Reversed: <reason>".
- [ ] Confirm **Reverse** is disabled/greyed out for a payment that's already been reversed, or one that isn't COMPLETED.
- [ ] Try saving the Record Payment form with amount `0` or blank — confirm you get a validation/API error, not a crash.

## 7. Categories (`/admin/categories`)

- [ ] **Create:** click **+ New Category**, fill name only (leave description/display order blank), save — appears at top.
- [ ] **Create with display order:** repeat but type a number into "Display order" — this used to crash (`.trim is not a function`) since it's a native number input; confirm it now saves fine.
- [ ] **Edit:** click Edit on an existing category, change the name, save — list updates in place (not duplicated).
- [ ] **Hide/Show:** click the visibility toggle button, confirm the badge flips between Visible/Hidden.
- [ ] **Delete:** click Delete, confirm the confirmation dialog appears with the category name, confirm, category disappears.
- [ ] **Image upload:** open the create/edit dialog, use the image field to upload an image, save, confirm the image shows up later in Media (`categories` folder).

## 8. Products (`/admin/products`)

- [ ] **Create:** + New Product, pick a category, fill name + price, save.
- [ ] **Preparation minutes:** type a number into "Preparation minutes" — same numeric-field regression as Categories; confirm no crash.
- [ ] **Edit / Available toggle / Delete:** same pattern as Categories — verify each works and the confirmation dialog shows the product name before deleting.
- [ ] Image upload works and shows up in Media under `products`.

## 9. Stock (`/admin/stock`)

- [ ] Rows for products with `availableQuantity <= lowStockThreshold` are highlighted red — cross-check against the Dashboard's Low Stock tile.
- [ ] Click **Adjust** on a product, enter a positive delta (e.g. `10`) with a reason, save — Stock/Available quantity increases by 10.
- [ ] Repeat with a **negative** delta (e.g. `-5`) — quantity decreases; confirm you can't push it into a nonsensical negative total (check what the API does).
- [ ] Leaving delta blank or non-numeric should error, not silently save.

## 10. Media (`/admin/media`)

- [ ] Click each folder tab (general, categories, products, staff, customers) — list reloads per folder.
- [ ] Any image you uploaded via Categories/Products/Staff/Customers forms should appear in the matching folder tab.
- [ ] Delete an image, confirm the dialog, confirm it disappears and is no longer referenced (check the entity it was attached to doesn't 404 on its image, or at least doesn't crash).

## 11. Customers (`/admin/customers`)

- [ ] Search box filters by name or phone as you type (debounced — give it a beat after typing).
- [ ] **Create:** + New Customer, enter a name and a phone number already used by another customer — confirm you see the "Possible duplicate of: ..." warning after saving.
- [ ] **Expand:** click Expand on a customer with existing orders — confirm Orders / Unpaid / Partially paid / Outstanding balance figures load and make sense; click Collapse.
- [ ] Edit a customer's name/phone, save, confirm it updates in the list.

## 12. Staff (`/admin/staff`)

- [ ] Search by name or email.
- [ ] **Create:** + New Staff requires name, email, password (password field only shows on create, not edit) — save, new member appears.
- [ ] **Edit:** open an existing member, change name/phone, save — no password field shown.
- [ ] **Activate/Deactivate:** toggle a member's status, confirm badge flips.
- [ ] **Reset Password:** click Reset Password, type a new password, save — confirm the dialog closes with no error (can't verify the login itself here without logging out, but check for a clean success).

## 13. Tables & QR (`/admin/tables`)

- [ ] **Create:** + New Table with a table number and numeric capacity — confirm no crash on the numeric capacity field (regression-tested).
- [ ] **Edit** an existing table's name/capacity.
- [ ] **View QR:** click View QR on a table, confirm an image renders (or "No QR code has been generated yet." if none). Click **Regenerate**, confirm the image updates.
- [ ] **Take Out of Service / Mark Available:** toggle, confirm badge updates.
- [ ] **Release** only appears on OCCUPIED tables. Use it on a table with an active, fully-settled guest session — should succeed with a green notice.
- [ ] Try **Release** on an OCCUPIED table with an *unpaid* order — expect it to fail with a clear error message (not a crash), since the session isn't releasable yet.
- [ ] **Force Release** the same table — provide a reason, confirm — table becomes AVAILABLE despite the unsettled order. This is a destructive override; only test it on data you don't mind clobbering.

## 14. Settings (`/admin`)

- [ ] Change Tax rate and/or Service charge, click Save changes — confirm a green "Saved." message and the values persist after a page refresh.
- [ ] Enter something out of range (e.g. `150` for a percent, or a negative number) — confirm the backend rejects it with a visible error rather than silently accepting it.

## If something breaks

Note down: which module, which button/field, what you typed, and the exact error message (or screenshot). That's enough for a fix — no need to dig into the code yourself.
