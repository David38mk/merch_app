# Manual E2E Test Plan — MyHappinessClub

Full walkthrough of every feature built so far, executable by hand through the UI.
Work through the suites **in order** — later suites reuse data created by earlier ones
(products, orders, jobs). Check off cases as you go.

---

## 0. Environment setup

Do this once before testing.

```powershell
# 1. Database
docker compose up -d

# 2. Backend (from /backend, venv active)
alembic upgrade head            # must end at head c3f8b0e51d94 (payouts)
python -m app.seed_catalog      # 2 print partners + ~26 blanks
python -m app.seed_designers    # 3 demo designers
uvicorn app.main:app --reload --port 8001

# 3. Frontend (from /frontend)
npm run dev                     # http://localhost:5173
```

**Test accounts** (all seeded with password `Password123`):

| Role | Email |
|---|---|
| Print shop 1 | `acme@partners.local` |
| Print shop 2 | `pixelpress@partners.local` |
| Designer | `maya@designers.local` |
| Designer | `leo@designers.local` |
| Designer | `ines@designers.local` |

You will create your own **seller** account in suite 1.

**Email stub:** nothing actually sends. Every "email" (verification links, reset links,
notification mirrors) appears in the **backend console** as a `🔌` log line — keep that
terminal visible.

**Two-browser trick:** several tests (sessions, cache, visitors) need a second identity.
Use a normal window + an incognito/private window, or two different browsers.

---

## 1. Auth

### 1.1 Signup — happy path
1. Go to `http://localhost:5173` → **Sign up**.
2. Register with first/last name, a real-format email (e.g. `you@example.com`), strong password.
- ✅ Redirected into the app (onboarding or dashboard). Profile menu (top-right avatar) shows your name + email.
- ✅ Backend console logs a `🔌` verification email with a link.

### 1.2 Signup — weak password
1. Try signing up with password `abc`.
- ✅ Rejected with a strength message; no account created.

### 1.3 Signup — duplicate email
1. Try signing up again with the same email.
- ✅ Error that the email is taken.

### 1.4 Email verification
1. Copy the verify link from the backend `🔌` log, open it in the browser.
- ✅ "Email verified" screen. Later, Settings → Personal shows a **Verified** badge.

### 1.5 Login — wrong password
1. Log out (profile menu → Log out). Try logging in with a wrong password.
- ✅ Error message, stays on login.

### 1.6 Login — happy path
1. Log in with correct credentials.
- ✅ Lands on `/dashboard`.

### 1.7 Guest-only guard
1. While logged in, manually visit `/login`, `/signup`, `/forgot-password`.
- ✅ Each redirects to `/dashboard`.

### 1.8 Auth guard
1. Log out, then manually visit `/dashboard`, `/seller/products`, `/settings`.
- ✅ Each redirects to `/login`.

### 1.9 Forgot / reset password
1. Log out → **Forgot password** → enter your email.
2. Copy the reset link from the backend `🔌` log, open it, set a new password.
3. Log in with the new password.
- ✅ Old password no longer works; new one does.

---

## 2. Seller onboarding

### 2.1 Wizard
1. With a fresh account, go through onboarding (`/onboarding`): pick a plan, set brand name, store URL.
- ✅ Wizard completes → dashboard. Free plan recorded (no billing).

### 2.2 Onboarding checklist
1. On `/dashboard`, look at the checklist.
- ✅ Steps reflect real state (e.g. "publish your first product" not checked yet). Completing a step later ticks it off after a refresh.

---

## 3. Catalog & product configurator

### 3.1 Browse + filters
1. Sidebar → **Catalog** (`/seller/catalog`).
- ✅ ~26 blanks from 2 providers, with images, colors, provider names.
2. Use search box; then filter by category, color, price; change sort.
- ✅ Grid narrows accordingly; clearing filters restores everything.

### 3.2 Favorites + recently viewed
1. Click the heart on 2 blanks; open one blank's detail page; go back.
- ✅ Favorites toggle persists after refresh; recently-viewed row shows the opened blank.

### 3.3 Configurator
1. Open a blank detail (`/seller/catalog/:id`). Change color, size, material, print type, position.
- ✅ **Per-unit price updates live** with each change; unavailable combos are disabled/marked.
- ✅ Production time + shipping note shown.

### 3.4 CTA handoff
1. Pick a specific color/size, click **Design yourself**.
- ✅ Design editor opens with the *same* blank and your chosen color visible.

---

## 4. Design editor

### 4.1 Upload artwork
1. In the editor (`/seller/design/:baseItemId`), upload a PNG.
- ✅ Art appears on the blank inside the print-area frame. Drag to move, resize, rotate, center — all work.

### 4.2 Warnings
1. Upload a tiny image (e.g. 100×100) and scale it big; drag it partly outside the print area; upload a JPG (no transparency).
- ✅ Low-res / exceeds-print-area / missing-transparency warnings appear (as applicable), but do not block you.

### 4.3 AI generation + credits
1. Click **Generate with AI**, enter a prompt.
- ✅ 4 stub candidates appear; credit balance drops by 1 (starts at 10).
2. (Optional, tedious) Burn all 10 credits.
- ✅ 11th generation is refused with an out-of-credits message.

### 4.4 Undo / redo / autosave
1. Move the art a few times → undo twice → redo once.
- ✅ Placement steps back/forward correctly.
2. Refresh the page mid-edit (creation flow only).
- ✅ Work restored from autosave.

### 4.5 Continue
1. Click **Continue**.
- ✅ Product info page opens with design + placement + your variant carried over.

---

## 5. Product creation & publish

### 5.1 Profit calculator + price floor
1. On `/seller/products/new`, fill name/description/category/tags.
2. Set price **below** the shown minimum (base cost + fee).
- ✅ Save/publish refused with the break-even minimum shown.
3. Set a healthy price.
- ✅ Calculator shows base cost, commission (Free plan = 15%), your earnings, live.

### 5.2 AI copy
1. Click the AI title/description suggestion button.
- ✅ Templated copy fills in (stub — free).

### 5.3 Save draft vs publish
1. Create one product as **Save Draft**, and a second product (repeat suites 3–5) as **Publish**.
- ✅ Draft lands in My Products → Drafts; published one in Published.
- ✅ Backend console logs stub mockup-gen + search-indexing lines on publish.

---

## 6. My Products

### 6.1 Tabs + counts
1. Go to **Products** (`/seller/products`).
- ✅ Four tabs: **Drafts / Published / Collaborations / Archived**, each with a count badge matching reality.

### 6.2 Cards
- ✅ Each card shows mockup, name, price, **profit**, state, **last updated** time, sales count.

### 6.3 Search + filters (server-side)
1. Search a product by name; filter by category; set a created-date range; change sort.
- ✅ Grid follows; **tab count badges stay whole-catalog honest** (they don't shrink when a filter narrows the grid).

### 6.4 Duplicate
1. On the published product → **Duplicate**.
- ✅ A fresh **draft** copy appears (same design, placement, price, name marked as copy).

### 6.5 Archive + restore
1. Archive the duplicate.
- ✅ It moves to Archived; it does NOT appear on the public storefront.
2. Restore it.
- ✅ It lands back in **Drafts** (never straight to Published).

### 6.6 Delete rules
1. Try deleting the **published** product.
- ✅ Refused (409-style message: unpublish or archive first).
2. Delete a draft.
- ✅ Confirmed and gone.

---

## 7. Product editor

### 7.1 Edit info
1. Open published product → **Edit** (`/seller/products/:id/edit`). Change name, description, tags; save.
- ✅ Saved; category is **read-only** (comes from the blank).

### 7.2 Variant change + server price floor
1. Change color/size/material/print type to a pricier combo, keep price barely above the old minimum; save.
- ✅ If new production cost outgrows the price: save **refused with the new minimum** shown. Raise price → saves.

### 7.3 Design edit (reuses creation editor)
1. Click edit design.
- ✅ The same design editor opens with the current art + placement loaded.
2. Move the art, continue back.
- ✅ Edit page shows the new placement **unsaved**; saving persists it. Backend logs mockup-regen stub.
3. Refresh the edit page *without* saving after returning.
- ✅ Unsaved design change is discarded (no autosave-clobber of the product).

### 7.4 Change history
1. After the edits above, check the **Change history** panel.
- ✅ Human-readable revision lines, e.g. "Price €29.00 → €34.00", "Design replaced", newest first.

### 7.5 Visibility from editor
1. Unpublish → republish from the edit page.
- ✅ State flips; storefront reflects it (check after suite 8 publishes the store).

---

## 8. Website builder & publishing

### 8.1 Draft layer — the core contract
1. Go to **Storefront** (`/seller/storefront`). Change the description text.
2. In another tab open your public store (once published — for the first run just note the status card says **Draft**).
- ✅ Edits show "unsaved/draft" state in the builder; the public page (when live) does NOT change until Publish.

### 8.2 Branding
1. Upload a logo and a cover image; edit brand name + description.
- ✅ Previews update; recommended dimensions shown; autosave indicator fires after a pause.

### 8.3 Theme
1. Pick a preset; then set custom primary/accent hex; switch button style (incl. pill).
- ✅ Preview recolors live. Enter an invalid hex like `zzz`.
- ✅ Rejected/ignored — theme never blanks out.

### 8.4 Store info + socials
1. Set contact email, location, and several social links (incl. X). Enter one URL without `https://` (e.g. `instagram.com/me`).
- ✅ All saved; schemeless URL still opens correctly on the public page later (not treated as a relative link).

### 8.5 Homepage curation
1. Reorder products, **feature** one, **hide** one.
- ✅ Order persists; featured first; hidden one flagged.

### 8.6 Preview (desktop/mobile)
1. Click **Preview** → full-page preview opens.
- ✅ Shows the DRAFT (your unsaved-to-public edits), toggles Desktop/Mobile layouts.

### 8.7 Discard changes
1. Make an edit, then **Discard changes**.
- ✅ Draft reverts to last-published values (or empty on first run).

### 8.8 Store URL rules
1. In the URL field try: `ab` (too short), `Admin` / `store` (reserved), `--weird--!!` (bad chars), and the slug of an existing store.
- ✅ Each rejected with a clear reason; taken slug offers a free suggestion.
2. Set a valid unique slug.
- ✅ Availability check passes.

### 8.9 Publish
1. If the status card lists blockers (no products, no name…), verify the Publish button is gated; resolve blockers.
2. Click **Publish**.
- ✅ Status flips to **Published** with live URL + "last published" time. Copy-URL button copies; Visit opens the public page.

### 8.10 Edit-after-publish
1. Change the description again; do NOT publish. Hard-refresh the public page.
- ✅ Public page still shows the OLD description. Publish → public page shows the new one.

### 8.11 Slug move warning
1. With the store Published, change the slug.
- ✅ Warning that moving a live store breaks old links. After publish, the old `/store/old-slug` 404s; new one works.

### 8.12 Unpublish / republish
1. **Unpublish**.
- ✅ Status = **Unpublished** (not Draft); public URL now shows store-not-found; all builder content intact.
2. **Publish** again.
- ✅ Back live with the same content, one click.

---

## 9. Public storefront & buy flow

Open your store URL in an **incognito window** (counts as a visitor, suite 12 depends on it).

### 9.1 Rendering
- ✅ Cover, avatar (fully visible, not clipped by the cover), brand name, bio, social icons (hover recolors), theme colors + button style applied.
- ✅ Product cards: rounded rectangles (NOT ellipses even with pill button style), image, name, price readable.
- ✅ Curation respected: featured first, hidden product absent, archived product absent.

### 9.2 Mobile
1. Narrow the browser window to phone width.
- ✅ Layout stacks cleanly, nothing overflows.

### 9.3 Buy now — validation
1. Click a product → **Buy now** modal. Try submitting empty.
- ✅ Required fields (variant, name, email, address) enforced.

### 9.4 Buy now — happy path
1. Pick a variant + quantity 2, fill shipping details with a NEW email (this becomes a buyer account), submit.
- ✅ Success screen with a short order number. (Payment is stubbed — no card asked.)
2. Place 1–2 more orders (different products/variants) — later suites need several orders.

---

## 10. Orders (seller)

### 10.1 Notification of sale
1. Back in the seller window: bell icon.
- ✅ "New sale" notification with the amount, linking to the order.

### 10.2 Orders list
1. **Orders** (`/seller/orders`).
- ✅ Each card: short order #, customer name, product summary, date, total, **your earnings**.
- ✅ Status tabs with counts; new orders show **Paid**.

### 10.3 Search / sort / filter
1. Search by customer name, then by order #, then by product name.
- ✅ All three find the order. Tab counts stay whole-set. Sort by date/revenue works. Date filter narrows.

### 10.4 Order detail
1. Open an order.
- ✅ **7-step stepper**: Order received ✓, Payment confirmed ✓, Sent to print provider ✓ (named after the shop), rest upcoming.
- ✅ Customer + shipping address; per line: mockup **as bought** (variant snapshot), unit price, production cost, line totals.
- ✅ Money breakdown: Subtotal − Production − Platform fee = **Your profit**.

### 10.5 Snapshot immutability
1. Edit that product's name + price in the product editor; save. Reopen the order.
- ✅ Order still shows the OLD name and price (snapshot-at-purchase).

### 10.6 Cancel — allowed window
1. On an order still in **Paid**, click **Cancel** → confirm in modal.
- ✅ Order becomes Cancelled; timeline logs it; stepper replaced by the factual log.

### 10.7 Refund
1. On another **Paid** order, click **Refund** → confirm.
- ✅ Status Refunded; a **Payment** notification "Refund issued · €X" appears in the bell.

---

## 11. Production queue (print shop drives fulfillment)

Log in as the provider of your blank (check the product's provider — `acme@partners.local` or `pixelpress@partners.local`, password `Password123`). Use a second browser to keep the seller logged in.

### 11.1 Queue
1. **Production queue** (`/printshop`).
- ✅ Your remaining paid order's line(s) listed with product, variant, quantity.

### 11.2 Advance the chain
Advance one line step by step. After EACH step, check the seller's order detail (15s auto-poll — or refresh):

| Step | Seller sees |
|---|---|
| → **In production** | Status In production; stepper "Production started" ✓; notification fires |
| → **Quality check** | Status still shows In production (QC is internal); timeline logs QC |
| → **Shipped** | **Tracking number required** — try without one first (refused). With it: status Shipped, tracking visible on order detail, notification |
| → **Delivered** | Status Delivered, stepper fully complete ✓✓✓✓✓✓✓ |

### 11.3 Cancel window closed
1. As seller, open an order that's In production or later.
- ✅ Cancel button gone/disabled (only pre-production orders can cancel).

### 11.4 Print shop catalog
1. `/printshop/catalog` — edit a blank's price or stock.
- ✅ Saves; seller catalog reflects it.

---

## 12. Analytics

### 12.1 Overview cards
1. As seller: **Analytics** (`/seller/analytics`).
- ✅ Revenue (PAID orders only — cancelled/refunded excluded), Orders, **Visitors** (your incognito visits from suite 9), **Conversion** (orders ÷ visitors), AOV. Sanity-check the math against your test orders.

### 12.2 Visitor counting
1. Open the public store again in the SAME incognito window (same day).
- ✅ Visitor count does NOT increase (one per visitor per day).
2. Open it from a different browser/device.
- ✅ Count +1 after refresh.

### 12.3 Charts
- ✅ Revenue area chart, Orders + Visitors as separate small charts (no dual-axis), horizontal bars: sales by country, top products, best categories. Days with no sales show zero, not gaps.

### 12.4 Product performance table
- ✅ Per product: revenue, units, conversion; rating column shows **—** (no reviews yet).

### 12.5 Date filters + auto-refresh
1. Switch Today / 7 / 30 / 90 / custom range.
- ✅ Everything recomputes. Custom range with from > to handled gracefully.
2. Leave the page open, place a new order from incognito.
- ✅ Numbers update within ~60s without a manual refresh.

---

## 13. Notifications center

### 13.1 Page + grouping
1. Bell → **View all** (`/notifications`).
- ✅ All notifications grouped by date (Today / Yesterday / This week / This month / Earlier).

### 13.2 Category filters
1. Click through category chips (Sales, Orders, Payments, Applications, Collaborations, Announcements, System).
- ✅ List filters; your sale under Sales, order-progress under Orders, refund under Payments, welcome under Announcements.

### 13.3 Actions
1. Hover a notification: **mark read** — unread dot clears, bell badge decrements.
2. **Delete** one — it disappears, stays gone after refresh.
3. **Mark all as read** — badge goes to 0.
4. Click a sale notification body.
- ✅ Navigates to the related order.

### 13.4 Email mirror
1. Check the backend console around the time a sale/refund notification fired.
- ✅ Matching `🔌` email-stub log line (welcome-type ones deliberately have none).

---

## 14. Settings

Profile menu → **Settings** (`/settings`).

### 14.1 Personal
1. Change first/last name → save.
- ✅ Display name follows; top-right menu shows the new name.
2. Upload a profile photo; then remove it.
- ✅ Both round-trip; initials fallback returns after removal.

### 14.2 Business
- ✅ **Brand name is read-only** with a link that lands in the website builder.
1. Set VAT/tax ID, country, currency `usd` → save.
- ✅ Saved; currency displayed uppercase (`USD`).

### 14.3 Store
- ✅ URL + Published status shown read-only, builder link works.

### 14.4 Preferences
1. Change language + timezone; flip the two email toggles individually.
- ✅ Each saves immediately (no Save button needed); toggles are independent; state survives refresh.

### 14.5 Change password
1. Security → Change password. Try with a WRONG current password.
- ✅ Refused.
2. Try a weak new password.
- ✅ Refused with strength message.
3. **Session-kill test:** first log in on a second browser with the same account. Then change the password correctly in browser 1.
- ✅ Browser 1 stays logged in (works after refresh). Browser 2 is kicked to login on its next action.
- ✅ Login works only with the NEW password.

### 14.6 Change email
1. Security → Change email. Requires your password; try wrong password.
- ✅ Refused.
2. Try an email already used by another account (e.g. `maya@designers.local`).
- ✅ Refused — address taken.
3. Change to a fresh email.
- ✅ Personal section shows the new address as **Unverified**; backend `🔌` log has a new verify link; opening it re-verifies. Login now uses the new email.

### 14.7 Log out of all other devices
1. Log in on the second browser again. In browser 1: **Log out of all other devices**.
- ✅ Browser 1 keeps working; browser 2 kicked to login.

### 14.8 Connected accounts
- ✅ Google shows as connected only if you signed up via Google; Google-managed accounts get "set a password" instead of "change", and email change is blocked for them.

---

## 15. Hire a designer → collaboration

### 15.1 Create a job
1. **Job offers** (`/seller/hiring`) → New. Fill brief, pick base product, style, compensation.
2. Compensation checks: pick **Revenue share** with 60%.
- ✅ Capped/refused (max 50%). Pick **Both** — both fixed amount and % become required.
3. Set a **past** deadline.
- ✅ Refused. Fix it; attach a reference image; **Save draft**.
- ✅ Job appears as Draft in the list.

### 15.2 Publish + marketplace
1. **Publish** the job. Log in as `maya@designers.local` (second browser).
2. Designer sidebar → **Job calls**.
- ✅ Only OPEN jobs visible (your draft-stage jobs never were). Open the job — full brief, compensation, deadline, attachments.

### 15.3 Apply / bid
1. As Maya: apply with a price + message.
- ✅ Seller gets an **Application** notification; job status becomes "In review"; application count = 1.
2. Apply from `leo@designers.local` too.

### 15.4 Applicant review
1. As seller, open the job's applicants.
- ✅ Cards show rating + review count, portfolio preview, completed jobs, response time. Designer name links to the public profile `/designers/maya-ortiz` (bio, reviews, portfolio grid — verify it loads).
2. **Reject** Leo.
- ✅ Leo notified; job stays open/in-review.
3. **Accept** Maya.
- ✅ Job → "Designer selected"; Maya notified; a **Collaboration** opens.

### 15.5 Collaboration workspace
1. Both sides open `/collaborations/:id`.
- ✅ Overview: product, brief, deadline, agreed terms. Timeline shows "started".
2. Chat: send messages from both sides.
- ✅ Other side sees them within the poll interval (~few seconds), notification fires.
3. As Maya: **submit a draft** design upload.
- ✅ Seller sees the submission; timeline logs it.
4. As seller: **Request revision** with feedback text.
- ✅ Maya sees the feedback preserved on the submission.
5. Maya submits again → seller **Approves**.
- ✅ Timeline → approved. If the deal has a fixed fee: a (stubbed) payment step appears; percent-only deals skip it.

### 15.6 Auto-created product
1. As seller: **Products → Drafts**.
- ✅ A new UNLISTED draft exists from the collab, price pre-filled to break-even, linked to the collaboration. The **Collaborations tab** shows the collab with stage/designer/deadline and links to the workspace.
2. Price it properly and publish.
- ✅ It appears on your public storefront.

### 15.7 Job list hygiene
- ✅ Job now shows Completed/Closed appropriately; **Duplicate** creates a fresh draft copy; delete works only on drafts.

---

## 16. Buyer view

1. The buy-flow emails from suite 9 created passwordless buyer accounts — order history is verified from the seller/printshop side in this MVP. If you checked out with an email belonging to an existing logged-in account, visit **My orders** (`/orders`).
- ✅ Your purchases listed with status.

---

## 17. Cross-cutting sanity

### 17.1 Multi-role account
1. Profile menu → **Become a designer** on your seller account.
- ✅ Designer nav group appears immediately; both role sections usable.

### 17.2 404s
1. Visit a nonsense URL (`/store/does-not-exist`, `/xyz`).
- ✅ Friendly not-found pages, no blank screens.

### 17.3 Console hygiene
1. Keep browser devtools open through a few suites.
- ✅ No red errors during normal flows (React warnings in dev are acceptable).

---

# ═══════════════════════════════════════════════════════════════════
# BUYER COMMERCE (suites 18–24)
# ═══════════════════════════════════════════════════════════════════

> **Buyer setup for this block.** Log out of the seller account. Sign up a
> **buyer** account (`/signup`), or reuse an existing one, and **stay logged in
> while shopping** so orders/wishlist/reviews attach to it. You need at least one
> **published** product on a storefront (from suites 5/8). Keep the seller and
> print-shop browsers available for the fulfilment steps.

## 18. Order confirmation

### 18.1 Checkout with card display
1. Open a product `/p/:id`, choose a variant, **Add to cart**; add a second product from the same brand. **Cart → Checkout**.
2. Fill contact + shipping, pick a shipping method (Standard/Express), enter a card number (e.g. `4242 4242 4242 4242`) + brand.
- ✅ Order places; you land on **Order confirmed** `/order/confirmed/:token`.

### 18.2 Confirmation content
- ✅ Unique order number, order date, purchased items with the design mockup, money breakdown (subtotal − discount + shipping + tax = total).
- ✅ **Payment method** shows brand + last-4 only (e.g. "Visa •• 4242") — never the full number.
- ✅ **What happens next** tracker: "Order received" ticked, later steps pending.
- ✅ **Estimated delivery** window shown (Standard 5–7 / Express 2–3 business days).
- ✅ Actions **Track order / Continue shopping / Visit brand store** all work.
- ✅ Backend `🔌` log shows the order-confirmation email.

### 18.3 Snapshot stability
1. Refresh the confirmation page.
- ✅ Same order number, dates, payment label and delivery window (snapshotted, not recomputed).

---

## 19. Order tracking

### 19.1 Timeline
1. From the confirmation or **My orders** → open `/orders/:id`.
- ✅ Status timeline (Order Placed → Payment Confirmed → Sent to Production → In Production → Quality Check → Shipped → Delivered) with the current state highlighted; shows number, current status, estimated delivery, delivery address.

### 19.2 Updates from the print shop (real fulfilment)
1. In the print-shop browser (`acme@partners.local`), advance this order's item through production and **mark shipped** with a **carrier + tracking number**.
2. Back on the buyer's order page.
- ✅ Status advances; **carrier + tracking number** appear with a **"Track with carrier"** deep link.
3. Advance to **Delivered**.
- ✅ Buyer sees Delivered + delivered date; a "Your order was delivered ✅" and a "How was your order? ⭐" review-request notification fire.

---

## 20. Order history + reorder

### 20.1 List, search, filters
1. **My orders** `/orders` — all your orders with number, date, products, total, status.
2. Search by product / brand / order number; filter by status + date range.
- ✅ Server-side filtering narrows the list correctly.

### 20.2 Reorder
1. On a past order → **Reorder**.
- ✅ Still-buyable lines are added to the cart at the **current** price; unavailable ones are reported; lands on the cart with a summary banner.

### 20.3 History survives unpublish
1. As the seller, archive/unpublish a product you sold. As the buyer, revisit history.
- ✅ The past order still shows the product (name/price snapshot preserved).

---

## 21. Wishlist

### 21.1 Guest → merge on login
1. Logged **out**, click the **heart** on a product. ✅ Heart fills; header wishlist badge increments (local).
2. Log in as your buyer account. ✅ The guest item **merges** into your server wishlist (persists across refresh).

### 21.2 Wishlist page
1. `/wishlist` — each item shows image, name, brand, price, **availability** badge.
2. **Move to cart**: a single-variant product goes straight to cart; a multi-size/colour product opens the PDP to pick options.
3. Unpublish a saved product (as seller) → revisit. ✅ It's **kept but marked unavailable** (unlike the cart, which drops it).
4. Remove via the heart. ✅ Gone after refresh; follows you across devices (log in on a second browser).

---

## 22. Reviews & ratings

> Prereq: an order **delivered** to your buyer account (suite 19).

### 22.1 Verified-purchase gate
1. On a product you did **not** purchase — no review form. ✅ Only verified purchasers can review.
2. On a **delivered** product's page → **Write a review**.

### 22.2 Submit + one-per-product
1. 1–5 stars, title, written review (min length enforced), optional photos. ✅ Too-short text refused; on success the review shows as verified.
2. Try reviewing the same product again. ✅ Refused / becomes an edit — one review per purchased product.

### 22.3 Display + reporting
- ✅ Product page shows average rating, review count, star breakdown, customer photos; the marketplace/store card reflects the rating.
1. From another account, **report** a review past the threshold. ✅ It auto-hides; the aggregate recomputes over published reviews only.

---

## 23. Buyer notifications

### 23.1 Lifecycle notifications
- ✅ "Order confirmed 🎉" on checkout; "Your order shipped 📦" and "delivered ✅" as the print shop advances; a review request on delivery.

### 23.2 Center + email mirror
1. `/notifications` — mark read, mark all read, delete; category filters include Orders, Shipping, Reviews, Wishlist, Promotions, Announcements.
- ✅ Work as in suite 13; buyer categories populated; each has a matching `🔌` email line (except silenced ones).

---

## 24. Account settings — privacy & delete account

### 24.1 Privacy section
1. Settings → **Privacy**. ✅ Download-data (future) shown; **Delete account** present.

### 24.2 Delete account
1. **Delete account** → wrong password. ✅ Refused. (Google-only accounts must type "DELETE".)
2. Confirm with the correct password. ✅ Logged out immediately; reviews you left now show "Deleted user"; orders stay intact for sellers.
3. Try logging in with the deleted account. ✅ Blocked — "This account has been closed." (403).

---

# ═══════════════════════════════════════════════════════════════════
# DESIGNER PLATFORM (suites 25–31)
# ═══════════════════════════════════════════════════════════════════

> This block builds its own designer account and a job to collaborate on. You'll
> also reuse a **seller** account (yours from suite 1) to post a job and, later,
> to accept an application and complete a collaboration so earnings exist.

## 25. Designer signup & onboarding

### 25.1 Join as designer
1. Log out. Go to `/join-as-designer` (or the "Become a designer" CTA on the landing page). Sign up.
- ✅ **Two** required checkboxes — Terms **and** the **Designer Agreement**; missing the agreement is refused.
- ✅ On success you get BUYER+DESIGNER roles and land on the onboarding wizard.

### 25.2 Onboarding wizard (resumable)
1. Walk Welcome → Profile → Skills → Portfolio → Finish.
- ✅ **Profile**: cover + avatar upload, display name, bio, country, four contact fields (Website/Behance/Dribbble/Instagram).
- ✅ **Skills**: multi-select from the fixed set + an experience level.
- ✅ **Portfolio**: image upload + external links, with a real **Skip for now**.
- ✅ Each step saves as you go — leave mid-way and return, progress is kept. Finish routes to `/designer`.

---

## 26. Designer public profile

### 26.1 Public & shareable
1. Copy your profile URL `/designers/:slug`; open it **logged out** (incognito).
- ✅ Loads for anyone (no login): cover, avatar, experience badge, bio, ratings, completed jobs, country, member-since, skills, contact links, portfolio.

### 26.2 Owner edit vs visitor
1. Logged in as the owner, open your own profile. ✅ An **Edit profile** button (opens the onboarding wizard as editor).
2. As another user (or logged out). ✅ No edit button; a disabled "Start chat — soon" instead.

---

## 27. Designer portfolio (projects)

### 27.1 Create + images
1. Designer nav → **Portfolio** `/designer/portfolio` → **Add project**: title, description, categories → **Create**. ✅ Saved as a **Draft**.
2. Drag-and-drop (or click) several images. ✅ First image is the **cover**; "Make cover" reorders; delete removes; max 12.

### 27.2 Publish rules
1. Try **Publish** with no images. ✅ Refused. Add an image → Publish.
2. Remove the last image of a published project. ✅ It **auto-unpublishes**.
3. Toggle **Feature**; edit title/categories.

### 27.3 On the public profile
- ✅ **Published** projects show (featured first), drafts hidden; each shows cover, title, month, categories.

---

## 28. Designer job browsing

> Prereq: at least one **published** job (suite 15.2), ideally a few with different categories/payment types.

### 28.1 Browse + real-time
1. As a designer, **Browse jobs** `/designer`. ✅ Cards show category, title, brand, product, compensation, deadline, posted date.
2. In a seller browser, publish a new job / close an existing one. ✅ Within ~20s the designer list updates (published appears, closed drops) with no manual refresh.

### 28.2 Search, filters, sort
1. Search by title / brand / product. ✅ Narrows instantly.
2. Filter by Category, Payment type, minimum Revenue share (≥5/10/20%); toggle Sort **Newest** ⟷ **Deadline**. ✅ Combinations narrow/reorder correctly; **Clear** resets.

---

## 29. Job details & application

### 29.1 Detail page
1. Open a job. ✅ Product preview, brief, inspiration, deadline, **payment model**, category, **reference images**, and a **brand block** with a **View store** link.

### 29.2 Apply
1. **Apply**: short **introduction**, **cover message**, **compensation** (only the fields the job's payment model allows), and **attach portfolio** (only your **published** projects, up to 6).
- ✅ Submits; the seller gets an application notification.
2. On the seller side, open the applicant. ✅ Seller sees your intro headline + the projects you attached.

### 29.3 One application per job
1. As the designer, apply again with a different intro / fewer projects. ✅ It **updates** the same application (no duplicate); the form was prefilled with your previous values.

---

## 30. Collaboration workspace — status & real-time

> Augments suite 15.5. Get to a collaboration by accepting an application (suite 15.4).

### 30.1 Status stepper
1. Open `/collaborations/:id`. ✅ A horizontal **7-stage stepper** (Accepted → Working → Draft submitted → Revision → Updated draft → Final approval → Completed) sits above the activity log; the current step is highlighted; if no revision occurred those two steps show **Skipped**.

### 30.2 Real-time reflection
1. Keep the designer's workspace open; in the seller browser approve / request revision / pay. ✅ Within ~15s the designer's stepper + activity log update **without** a manual refresh (and vice-versa).

### 30.3 Success → product
1. Complete the flow (final approved; fixed fee paid if any). ✅ Stepper reaches **Completed**; the auto-created draft product appears in the seller's catalog (suite 15.6).

---

## 31. Designer payouts / earnings

> Prereq: at least one **completed** collaboration. For revenue share, the collab's
> product must be **published and sold** (mark that order **delivered** to see the
> share become Available).

### 31.1 Overview
1. Designer nav → **Earnings** `/designer/earnings`.
- ✅ Four cards: **Total earnings**, **Available balance**, **Pending balance**, **Lifetime revenue**. Fixed fees count once the collab payment completed; revenue share accrues from paid sales.

### 31.2 Availability holds
- ✅ A sale's revenue share is **Pending** until that order is **delivered**, then **Available**. A fixed fee is Pending until the seller completes the collab payment.

### 31.3 Project earnings
- ✅ Table lists each completed project: seller, product, payment type, amount earned (+ pending shown), status.

### 31.4 Request withdrawal
1. Try to withdraw below **€50**. ✅ Refused. Try above your available balance. ✅ Refused.
2. Withdraw a valid amount. ✅ **Available balance drops**; a **Payout** row appears in history (date, amount, **Processing**, method "Bank transfer"); Total earnings unchanged.
3. Withdraw the rest (leave the amount blank = full available). ✅ Available goes to €0.00.

---

## Result log

| Suite | Pass | Fail | Notes |
|---|---|---|---|
| 1 Auth | | | |
| 2 Onboarding | | | |
| 3 Catalog | | | |
| 4 Design editor | | | |
| 5 Product create | | | |
| 6 My Products | | | |
| 7 Product editor | | | |
| 8 Builder + publish | | | |
| 9 Public store + buy | | | |
| 10 Orders | | | |
| 11 Production queue | | | |
| 12 Analytics | | | |
| 13 Notifications | | | |
| 14 Settings | | | |
| 15 Hiring + collab | | | |
| 16 Buyer | | | |
| 17 Cross-cutting | | | |
| 18 Order confirmation | | | |
| 19 Order tracking | | | |
| 20 Order history + reorder | | | |
| 21 Wishlist | | | |
| 22 Reviews & ratings | | | |
| 23 Buyer notifications | | | |
| 24 Privacy + delete account | | | |
| 25 Designer signup + onboarding | | | |
| 26 Designer public profile | | | |
| 27 Designer portfolio | | | |
| 28 Job browsing | | | |
| 29 Job details + application | | | |
| 30 Collab workspace status/real-time | | | |
| 31 Designer payouts | | | |
