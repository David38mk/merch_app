# Bug Walk-Through Report — 2026-07-22

Full audit of the seller MVP (storefront builder, publishing, products page, product editor, public store).
Method: 3 parallel code reviewers (storefront UI / products UI / backend) + targeted runtime probes with TestClient.
**RT** = reproduced at runtime, not just read from code.

---

## ✅ FIX STATUS (2026-07-22, same day)

**All findings fixed and verified.** Regression evidence:
- New probe suite `smoke_fixes` **29/29** — covers C1 (live URL survives onboarding rename), C2 (failed publish keeps live images on disk), C3 (listing/editing a product busts the public ETag; weak compare handles lists + stripped `W/`), M2 (re-upload + discard delete draft-only files, published files untouched), M5 (draft logo ticks checklist), M6 (garbage slugs are format errors; publish refuses them), L1 (bad print area 400s; placement change recorded in history), L4 (pure rename never hits the price floor), L6 (bad email 422, blank clears), and the draft-prune behaviour (identical values leave no phantom "unpublished changes").
- All three pre-existing suites still pass: publish **39/39**, products **35/35**, editor **37/37**.
- Frontend `tsc --noEmit` silent, `vite build` exit 0.

**Post-fix, user-reported (missed by the review pass):**
- **U1. Pill theme turned product cards into giant ellipses.** `StorefrontView` applied `--sf-radius` (9999px for `pill`) to card-sized rectangles → stadium-shaped cards clipping the image, name and price. Fixed with a second `--sf-card-radius` variable (pill = 1.25rem on large surfaces); the full-round radius now only applies to small elements (avatar, social chips).
- **U2. Avatar's top half hidden behind the cover.** The cover div is positioned (`relative`), the avatar span was static, so the cover painted over the avatar's overlap. Avatar is now `relative` and paints on top.
- *Not a bug:* the coloured background + big white product text inside the cards is the **seeded placeholder art** (Pillow-generated stand-in product photos, mockup seam #2) — replaced by real mockups when that seam is implemented.

Resolutions that differ slightly from the naive fix:
- **C5/H4-B (phantom draft after publish):** fixed on both sides — the client flushes the debounced autosave before publishing, and the server now **prunes draft keys equal to published values**, so a late-landing autosave can't fabricate "unpublished changes".
- **M1 (mobile preview lies):** `StorefrontView` gained a `mobile` prop that forces the phone layout (`sm:` upgrades suppressed); both previews pass it. Honest preview without an iframe.
- **M7 (invisible PENDING products):** the Collaborations tab now also lists PENDING product rows (fetching `state=PENDING`), which simultaneously fixes L9's wasted fetch on that tab.
- **L5 (can't reset a published custom colour):** resolved via H1's validated ColorField + the Indigo preset, which *is* the default theme — one click restores it exactly.
- **C3 hardening found by its own probe:** the products fingerprint initially used whole-second precision and missed same-second edits; now microseconds.
- **H5:** editor now uses the server's `min_price` for an untouched variant and the real plan rate (`/shop-items/commission`) + kind-aware delta math only when the variant changes.

---

## 🔴 Critical — breaks live stores or loses data

### C1. Onboarding silently kills a live store's URL **(RT)**
`backend/app/api/routers/onboarding.py:34-36` — every `brand_name` autosave regenerates `p.slug` directly.
The website builder's contract is that `slug`/`store_name` are *published-only* truth, changed at Publish.
Reproduced: published store at `/store/probe-xxx` → PATCH onboarding with a new brand name → old URL **404**, slug replaced by `renamed-in-onboarding`, no version bump, shared links dead.
**Fix:** onboarding must stop touching `slug` once `published_at` is set (or stop generating slug at all and leave it to publish).

### C2. Publish deletes old logo/cover from disk BEFORE validation/commit
`backend/app/api/routers/storefront.py` — publish flow: delete old files → *then* slug validation may raise 400 → session rolls back → DB still points at the deleted files → **live store renders broken images**.
**Fix:** collect files-to-delete, delete only after successful `db.commit()`.

### C3. Public-page ETag never changes when products change
`public_store.py` — ETag is built only from `storefront_version`, which bumps only on storefront publish/unpublish. Listing a new product, changing a price, or archiving one does NOT bump it → revalidating browsers get **304 + stale product list indefinitely**.
**Fix:** include a products fingerprint in the ETag (e.g. max `shop_items.updated_at` + count), or bump `storefront_version` on product changes.

### C4. Product editor wipes in-progress edits on window refocus
`frontend/src/pages/dashboard/seller/ProductEdit.tsx:91-101` — hydrate effect re-runs on every refetch (`QueryClient` defaults: `refetchOnWindowFocus: true`). Alt-tab away mid-edit, come back → all fields reset to server values.
**Fix:** hydrate once (a `hydrated` ref, like SellerStorefront's `touched` guard).

### C5. Publish races the 1.5s debounced autosave — silent edit loss
`SellerStorefront.tsx` — Publish doesn't flush the pending autosave timer. Click Publish within 1.5s of typing → server publishes the *old* draft and the last keystrokes vanish; an in-flight autosave can also land *after* publish, recreating a phantom "Unpublished changes" draft.
**Fix:** flush (fire save immediately + await) before publish; ignore autosave responses that resolve after a publish.

---

## 🟠 High — visible UX breaks (likely what you saw)

### H1. Invalid/partial hex colour blanks the storefront profile ← **prime suspect for "profile looks weird"**
`SellerStorefront.tsx` ColorField (free-text hex input, no validation) + `StorefrontView.tsx` CSS vars.
Typing in the hex field updates the preview per keystroke — `"#63"`, `"red"`, `""` make `linear-gradient(var(--sf-primary)…)` invalid → **cover strip goes white, avatar background transparent, white initials invisible**. Meanwhile the autosave of the bad value 422s ("Autosave failed").
**Fix:** only push value into theme when it matches `#hex`; keep raw text local until valid.

### H2. Builder autosave response is thrown away — Publish button & slug check frozen
`SellerStorefront.tsx` save.onSuccess ignores the returned `StorefrontState`; UI reads `blockers` / `slug_check` / `pending_slug` from the stale `["storefront"]` cache. Type a brand name → Publish stays disabled; type a slug → availability ✓/✗/suggestion never updates (the whole slug-availability UI is effectively dead; `checkSlug()` API is never even called).
**Fix:** `qc.setQueryData(["storefront"], s)` in save.onSuccess.

### H3. "Links will stop working" warning shows for every unpublished store **(code-confirmed)**
`SellerStorefront.tsx` `slugMoving` compares against `store_url`, which is `null` unless LIVE → warning always on for UNPUBLISHED stores with an unchanged slug.
**Fix:** only compute when `status === "PUBLISHED"`.

### H4. Material/print-type can never be cleared in the editor
`ProductEdit.tsx` patch uses `...(material ? { material } : {})` — choosing "None" sends nothing, server keeps the old option, UI restores it. Save "succeeds", nothing changed.
**Fix:** send `""` explicitly (server already accepts it).

### H5. Local min-price math drifts from the server's
`ProductEdit.tsx` re-derives the commission rate from quantized `platform_fee/price` (cent drift; rate=0 for tiny prices; 0.15 fallback wrong for CREATOR/PRO). The server already returns authoritative `min_price` — it's never read.
**Fix:** use `item.min_price` for the current variant; only recompute deltas client-side for *changed* variants, matched by kind+name (currently name-only — "Premium" material and "Premium" print type cross-match).

### H6. Publish buttons offered where the server always refuses **(RT)**
- Products card: PENDING (and design-less) drafts get "Publish" → guaranteed **409/400**. Reproduced: `PENDING → LISTED` → 409.
- `ProductEdit` "Save & publish" enabled for PENDING (only ARCHIVED guarded).
**Fix:** gate buttons on state + `design_url`.

### H7. Design-editor colour handoff silently dropped
`DesignEditor` hands back `{…, color}`; `ProductEdit` never applies or sends it. Change the shirt colour inside the design editor → save → colour reverts.
**Fix:** merge handoff `color` into the variant state (and re-validate size).

---

## 🟡 Medium

- **M1. "Mobile" preview lies** — Tailwind `sm:` breakpoints are viewport-based; the 390px-wide preview still renders the desktop layout (tall cover, 3-col grid). Real phones show something else. (Both builder preview + full-page preview.)
- **M2. Draft image files orphaned on disk** — re-upload before publish, `discard`, and `remove_logo` after upload all leak the uploaded file; nothing ever deletes draft-only uploads.
- **M3. Draft JSON read-modify-write race** — simultaneous text autosave + logo upload each rewrite the whole `storefront_draft`; last writer silently drops the other's change.
- **M4. Concurrent publish of the same slug → raw 500** — check-then-set with no IntegrityError handling (unique index saves the data, not the UX). Same in onboarding.
- **M5. Dashboard checklist disagrees with the builder** — "Upload logo" reads `avatar_url` (published-only now); uploading in the builder doesn't tick it until full publish.
- **M6. Garbage slugs silently become `"brand"` (RT)** — `"!!!"`/`"---"`/non-latin normalize to `"brand"` and slug-check says *Available*; publish would hand out a slug the seller never typed. Should be a format error.
- **M7. PENDING products invisible** — no tab shows them (`counts.PENDING` returned but unused); if one ever exists it's unmanageable.
- **M8. Products search: request per keystroke + full-grid spinner flash** — no debounce, no `placeholderData: keepPreviousData`.
- **M9. Products page "view on storefront" uses draft slug** — links 404 when the draft slug differs from the live one; should use `store_url`.
- **M10. SellerStudio shows hardcoded placeholder stats** — revenue €0.00 / orders 0 / credits 10 are literals, and "Your products" always shows the empty state even with dozens of products.
- **M11. Social hover mutates inline styles** — sticks "filled" on touch devices; also `rounded-full` class dead (inline radius overrides).
- **M12. Unpublish failure is silent** — no onError; modal hangs, seller may believe the store is offline.

## 🟢 Low

- L1. `print_area` change: unknown name silently clears it; excluded from revisions + mockup-regeneration trigger.
- L2. If-None-Match compared by exact string equality (multiple ETags / stripped `W/` miss; wasted 200s only).
- L3. `unique_slug` truncation can generate `--` candidates, burning up to 8 wasted DB checks and skipping to `-10`.
- L4. Price floor enforced on every PATCH — after a plan downgrade raises the floor, even renaming a product 400s until the price is raised.
- L5. Custom theme colour can't be reset to default after publish ("" filtered out of draft).
- L6. `contact_email` never validated.
- L7. Public storefront page: fetch race on slug change + network errors shown as "Storefront not found".
- L8. Long unbroken brand name/email hard-clipped (no `break-words`).
- L9. Products page: `busy` disables buttons on *every* card during any mutation; delete-modal errors render *under* the overlay; COLLAB tab still fetches the unused product list; modal offers "Archive" for already-archived items.
- L10. ProductNew price field can't be emptied (suggestion effect refills on 0).
- L11. `isLightColor()` in ProductEdit given a hex (expects a name) → every swatch treated as light; multi-word colours ("Heather Grey") all collapse to the same grey fallback swatch.
- L12. Builder copies/timers: copyUrl has no clipboard guard + stacking timers; dead `{savedAt ? "" : ""}` ternary; "Draft saved" shows even after a failed autosave.

## ✅ Checked, not broken

- Draft isolation itself (edit never touches live until publish) — holds in all probes.
- Empty-string draft values → NULL on publish; `remove_logo` + publish interact correctly.
- PATCH early-raises leave no partial DB writes (session never commits/flushes first).
- Preview product ordering exactly matches the public renderer.
- Tailwind classes used are all valid in v3.4; avatar overlap math correct; initials fallback works.
- Curation referencing deleted product ids is ignored safely; counts/sort injection safe; duplicate copies print area.
- TanStack object query keys are hashed structurally — no refetch loop.
- Second seller publishing a taken slug → clean 400 + suggestion **(RT)**.

---

### Suggested fix order
1. **C1–C5** (live-URL kill, file deletion before validation, stale ETag, edit-loss ×2)
2. **H1–H3** (the visual blanking you likely saw + frozen publish/slug UI + false warning)
3. **H4–H7**, then M-tier in batches (files/consistency: M2–M5; UX: M1, M6–M12)
