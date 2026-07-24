# MyHappinessClub — Full Repo Map

> **Purpose:** a complete, file-by-file map of both the **backend** and **frontend** repos, plus every root-level doc and config. Use it to find where something lives, how a request flows, and what each file is responsible for — without having to ask or re-read the whole tree.
>
> **Generated:** 2026-07-24. If files are added/renamed, update the matching section.

---

## 0. Quick "where do I find X?" index

| I want to… | Go to |
|---|---|
| See every HTTP endpoint | [Backend → routers](#appapi--routing-layer) |
| Understand the DB tables/columns | [Backend → models](#appmodels--sqlalchemy-orm-models-tables-basemetadata-drives-alembic) · source of truth: [DATA-MODEL.md](../DATA-MODEL.md) |
| Change a stubbed integration (payments, AI, email, storage) | [Backend → seams](#appseams--stubbed-integration-points-mvp-free-build-swapped-for-paid-services-later) |
| Add/adjust auth or JWT logic | `backend/app/core/security.py` + `backend/app/api/deps.py` |
| See the route → page map | [Frontend → App.tsx / pages](#srcpages--public--auth) |
| Call a backend endpoint from React | [Frontend → api/](#srcapi--typed-backend-clients-all-use-the-shared-api-instance) |
| Reuse a UI primitive (button, card, badge) | [Frontend → components/ui](#srccomponentsui--reusable-primitives) |
| Understand a domain term | [CONTEXT.md](../CONTEXT.md) glossary |
| Know what's built vs stubbed vs deferred | [MVP-SCOPE.md](../MVP-SCOPE.md) |
| Understand a big architectural choice | [docs/adr/](../docs/adr/) |

---

## 1. Project overview

**MyHappinessClub** is a creator **print-on-demand marketplace**. Four roles on one multi-role account:

- **Buyer** — browses storefronts, buys products (default role for everyone).
- **Seller** — creator/influencer/business: designs merch, runs a public storefront, hires designers, sees analytics.
- **Designer** — creates artwork for hire: portfolio, bids on jobs, collaborates, chats.
- **PrintShop** — fulfillment partner *inside the system*: owns the blank catalog, drives the production queue.

This repo is the **walking-skeleton rebuild**: every role has real, working views over a real data model, built with **only free tooling**. Anything that costs money or needs a third-party account is left as a clearly-marked **seam** (a stub behind an interface) so it can be swapped in later without reshaping the app.

**Core commerce flow:** Seller picks a **BaseItem** (blank) from a PrintShop's catalog → applies a **Design** → sets a price → publishes a **ShopItem** → Buyer buys it → an **Order** flows to the PrintShop's production queue → PrintShop makes it and hands it to shipment.

### Stack

| Tier | Tech |
|---|---|
| **backend/** | FastAPI + SQLAlchemy 2 + Alembic + Pydantic, JWT auth, Postgres. Auto docs at `/docs`. Runs on `:8001`. |
| **frontend/** | Vite + React 18 + TypeScript SPA. React Router v6, TanStack Query, Axios. Runs on `:5173`, proxies `/api` + `/uploads` → `:8001`. |
| **db** | PostgreSQL 16 via Docker Compose (`:5432`). |
| **legacy/** | The old Next.js 15 + Prisma + NextAuth + Supabase MVP — reference only, not live. |

### Two design conventions used everywhere

1. **Derive, don't store.** Anything computable from base facts (order display status, collab stage, publish status, job status) is *computed*, never given its own column — so two fields can never disagree. Backed by append-only event/revision logs (`OrderEvent`, `CollabEvent`, `ShopItemRevision`).
2. **Seams.** External services sit behind plain functions (`app/seams/`), stubbed now (log instead of send / return placeholder), swapped for the real service later without touching callers.

---

## 2. Root level (repo top)

| Path | What it is |
|---|---|
| `README.md` | Run instructions (3 terminals: db / backend / frontend), auth notes, day-to-day commands. |
| `CONTEXT.md` | **Domain glossary** (ubiquitous language). When a term conflicts with meeting-speak, this file wins. |
| `DATA-MODEL.md` | **ER diagram + table specs — source of truth for the schema.** SQLAlchemy models mirror it. |
| `MVP-SCOPE.md` | What's IN / stubbed (seam) / deferred, plus the running build log of every completed feature slice. |
| `docker-compose.yml` | One service: `postgres:16` (`mhc_postgres`), db `myhappinessclub`, user `mhc`, healthcheck, named volume `mhc_pgdata`. |
| `docs/adr/0001-*` | ADR: why FastAPI + React + Postgres split monorepo (rejected Django/Flask/keep-Next). |
| `docs/adr/0002-*` | ADR: auth = JWT in web storage, Google via ID token, email as a seam. |
| `directions/` | Original business material (PDFs, RTFs, drawio) describing each role — the source briefs. |
| `legacy/` | Archived Next.js MVP (Prisma schema, Stripe, NextAuth). Reference only. |
| `reports/` | Generated docs. `build-report.md` + `workflow.md` describe the **old** legacy stack; **this file** maps the current stack. |

> ⚠️ Note: `reports/build-report.md` and `reports/workflow.md` describe the **legacy** Supabase/Prisma/Next.js build and are out of date for the current FastAPI/React app. This `repo-map.md` is the current-stack reference.

<!-- BACKEND-SECTION -->
## Backend

FastAPI + SQLAlchemy 2.0 + Alembic + PostgreSQL backend for **MyHappinessClub** — a print-on-demand merch platform serving four roles (Buyer, Seller, Designer, PrintShop). Root at `backend/`.

### Architecture overview

**Request flow:** `app/main.py` builds the `FastAPI` app → mounts `api_router` (prefix `/api`) assembled in `app/api/routers/__init__.py` → each router endpoint declares FastAPI dependencies from `app/api/deps.py` (auth) and `app/core/database.py` (DB session) → handlers read/write SQLAlchemy ORM models (`app/models/`), validate I/O with Pydantic schemas (`app/schemas/` or router-local classes), and call **seams** (`app/seams/`) for anything external (storage, payments, email, AI, mockups, search).

**Auth:** OAuth2 password-bearer JWT. `POST /api/auth/login` issues an HS256 access token (`app/core/security.py`); every token carries `sub` (user id), `iat`, `exp`, and a `type` claim. `deps.get_current_user` decodes it, loads the `User`, and enforces "log out of all devices" by rejecting tokens issued before `user.sessions_revoked_at`. `require_role(Role.X)` is a dependency factory gating endpoints by role (and email verification when enabled); `get_optional_user` allows public-but-personalized reads.

**DB session:** `get_db()` yields a request-scoped `Session` from `SessionLocal` (autoflush off, `expire_on_commit=False`), closed in a `finally`. Handlers own their transactions (`db.commit()`).

**Design conventions seen throughout:** derived status (never store what can be computed from facts), append-only event/revision logs, snapshot-at-purchase fields, and 🔌 "seam" markers for stubbed integrations swapped for real services later.

### `app/` (root package)

- **`main.py`** — App entrypoint. Creates `FastAPI(title="MyHappinessClub API")`, adds CORS (single allowed origin from `settings.FRONTEND_ORIGIN`, credentials on), includes `api_router`, and mounts local upload storage as static files at `settings.UPLOAD_URL_PREFIX` (the storage seam's dev serving). Defines `GET /health` and `GET /` meta endpoints.
- **`seed.py`** — Seeds the three subscription `Plan` rows (FREE 15%/€0, CREATOR 10%/€19, PRO 5%/€49 with AI quotas). Idempotent (`db.get(Plan, code)` guard). Run via `python -m app.seed`.
- **`seed_catalog.py`** — Seeds a demo print-partner catalog: two `PrintShopProfile` providers (Acme Prints, PixelPress) with ~13 `BaseItem` blanks across 8 categories, each with generated placeholder images (via storage seam), variants, print options (material/print-type with surcharges), and print areas. Idempotent, and backfills `production_time` + option price-deltas on re-run. Stands in for the "products synced from providers" seam.
- **`seed_designers.py`** — Seeds 3 demo `DesignerProfile` accounts (password `Password123`) with portfolio `Design` artwork (via AI seam) and seeded `DesignerReview` rows, so applicant cards have real rating/portfolio signal. Idempotent.
- **`requirements.txt`** — Pins: fastapi 0.115.5, uvicorn, sqlalchemy 2.0.36, alembic 1.14, psycopg2-binary, pydantic 2.10 + pydantic-settings, python-jose (JWT), passlib+bcrypt (hashing), python-multipart (uploads), Pillow (image optimize), email-validator, google-auth + requests (Google Sign-In).

### `app/core/` — cross-cutting utilities and infrastructure

- **`config.py`** — `Settings(BaseSettings)` loaded from `.env`. Key settings: `DATABASE_URL`, `SECRET_KEY`, `ALGORITHM` (HS256), `FRONTEND_ORIGIN`, `DEBUG` (returns dev reset/verify links), token lifetimes (access 1d / remember 30d / reset 30m / verify 1d), `PUBLIC_STORE_BASE_URL` + `STOREFRONT_CACHE_SECONDS` (public store caching), `GOOGLE_CLIENT_ID`, `EMAIL_VERIFICATION_ENABLED`, and storage/upload settings (`UPLOAD_DIR`, `UPLOAD_URL_PREFIX`, `MAX_UPLOAD_MB`, image max-px caps). Singleton `settings` imported everywhere.
- **`database.py`** — Creates the SQLAlchemy `engine` (with `pool_pre_ping`) and `SessionLocal` factory; exposes the `get_db()` FastAPI dependency yielding a request-scoped session.
- **`security.py`** — Password hashing (bcrypt via passlib), `validate_password_strength` (≥8 chars, letter+digit), and JWT helpers. `_create_token` embeds `sub/exp/iat/type`; `create_access_token` (with `remember` flag), `create_reset_token`, `create_verify_token`; `decode_token(expected_type)`, `decode_access_token`, `decode_access_payload` (full payload for session-revocation checks).
- **`slug.py`** — Store-URL slug logic. `slugify`/`normalize_slug`, `slug_error` (length/format/`RESERVED_SLUGS` validation), `slug_taken` (DB uniqueness on `SellerProfile.slug`), `unique_slug` (auto-generates a valid unique slug), and `store_url` (absolute URL if `PUBLIC_STORE_BASE_URL` set, else `/store/{slug}`).
- **`pricing.py`** — Plan commission rates (`COMMISSION_RATES`: FREE .15 / CREATOR .10 / PRO .05) and `min_price(cost, rate)` = break-even retail floor `ceil(cost / (1 − rate))`. Shared by product creation and the collaboration workspace so the pricing rule lives once.
- **`google.py`** — Google Sign-In. `google_enabled()` (gated on `GOOGLE_CLIENT_ID`) and `verify_google_credential(credential)` which lazily imports google-auth and verifies the ID token, returning claims (email, given/family name, picture). Raises `ValueError` on invalid/unconfigured.
- **`notify.py`** — In-app notification helpers. `push(...)` writes a `Notification` row (caller commits) and mirrors it to email via the delivery seam (`email=False` for chatty updates). `seed_welcome` adds two starter notifications on registration. Kept separate from the router so any flow can notify.
- **`designer_stats.py`** — Batch-computed aggregate signals for designer cards/profiles: `rating_stats` (avg+count), `completed_counts` (completed collabs), `response_hours` (median hours from job publish → application, derived not fabricated), `portfolio_previews` (a few artwork URLs). All take a list of designer ids to keep listings one query each.
- **`storefront_render.py`** — `curated_products(db, profile, curation)` produces the ordered `PublicProduct` list for a storefront: LISTED items minus hidden, featured first, then the seller's saved order. Shared by the public page and the seller preview so "preview" and "live" can never disagree.

### `app/models/` — SQLAlchemy ORM models (tables). `Base.metadata` drives Alembic.

- **`base.py`** — `Base(DeclarativeBase)`, `UUIDMixin` (UUID PK, `uuid4` default), `TimestampMixin` (`created_at` server-default now).
- **`__init__.py`** — Imports every model so `Base.metadata` is fully populated (needed by Alembic and relationship resolution); re-exports all model classes.
- **`enums.py`** — All string enums: `Role`, `StoreState` (LIVE/DRAFT), `PlanCode`, `AccountType`, `AddressType`, `SocialPlatform`, `DesignType`/`DesignSource`, `ShopItemState` (LISTED/UNLISTED/PENDING/ARCHIVED), `PrintOptionKind`, `PaymentType`, `CallStatus`, `AttachmentKind`, `BidStatus`, `CollabState` (PENDING→PREVIEW→…→COMPLETED state machine), `SubmissionKind`/`SubmissionDecision`, `CollabEventType`, `OrderStatus` (money facts) + `FulfillmentStatus` (per-line production) + `OrderEventType`, `NotificationType`, `AICreditReason`.
- **`user.py`** — Identity + profiles. **`User`** (email, nullable `password_hash` for OAuth-only, names, `auth_provider`, `sessions_revoked_at`, `accepted_terms_at`; relationships to roles/profiles/settings/social_links/notifications). **`UserRole`** (user↔Role, unique). **`SellerProfile`** — the biggest model: slug/store_name/creator_name/bio/cover/avatar, `store_state`, `published_at`/`last_published_at`/`storefront_version` (publish + cache facts), `storefront_draft` (JSON pending edits), published theme/curation/contact/location, onboarding fields (country/currency/account_type/onboarding_completed), `plan_code`/`ai_credits_balance`, reserved Stripe fields; owns shop_items/designer_calls/orders/credit_transactions. **`DesignerProfile`** (slug, display_name, bio, portfolio_state; owns bids). **`PrintShopProfile`** (name, address, city, verified; owns base_items). **`Settings`** (per-user prefs: dark_mode, language, currency, timezone, notification/newsletter flags, `email_verified`, birthday/gender). **`PayoutDetails`** (bank info, reserved). **`Address`** (buyer saved addresses, SHIPPING/BILLING, one default per type). **`SocialLink`** (platform+url, reserved verified/followers).
- **`catalog.py`** — Print-partner catalog. **`ItemCategory`** (unique name). **`BaseItem`** (a blank a PrintShop offers: print_shop_profile_id, category, name/description, `base_price`, image, `production_time`, active; owns variants/print_options/print_areas). **`BaseItemVariant`** (size+color+`price_delta`+is_available). **`PrintOption`** (MATERIAL or PRINT_TYPE, name, price_delta). **`PrintArea`** (printable region name). **`CatalogFavorite`** (seller's favorited blank, keyed by user, unique on user+base_item).
- **`design.py`** — **`Design`** (artwork on a blank: owner_user_id, `type` PERSONAL/PAID, `source` UPLOAD/AI, `resource_url`).
- **`shop.py`** — **`ShopItem`** (a seller's finished product = BaseItem + Design placed in a PrintArea + price). Holds placement (pos_x/pos_y/scale/rotation as % of blank), chosen variant/options (color/size/material/print_type), name/description/tags, `price`, snapshot `production_cost`, `state` (ShopItemState), `updated_at` (onupdate), reserved release_date/only_followers; owns revisions. **`ShopItemRevision`** (append-only save history: `summary` JSON lines + `before` JSON of changed fields, for recoverability).
- **`commerce.py`** — **`Cart`**/**`CartItem`** (buyer basket per seller — model exists, not the primary checkout path). **`Order`** (paid purchase; buyer+seller, `status` OrderStatus, `subtotal`/`commission_rate`/`commission_amount`/`seller_payout_amount` snapshotted at order time, reserved stripe id, shipping fields + tracking + timestamps; owns items and ordered `events`). **`OrderItem`** (purchased line = also the PrintShop production-queue row via `fulfillment_status`; snapshots name/production_cost/placement at purchase). **`StoreVisit`** (one unique visitor per storefront per day, IP-hashed, unique constraint `uq_visit` — powers analytics without cookies). **`OrderEvent`** (append-only order timeline).
- **`hiring.py`** — Designer-hiring domain. **`DesignerCall`** (seller job posting tied to a base_item: title/brief/style/notes, payment_type + budget/revenue-share, deadline/launch date, `status` CallStatus, `published_at`; owns bids + attachments). **`CallAttachment`** (reference image / brand-guideline file). **`Bid`** (designer's price/percent offer + message + status). **`Collaboration`** (created when a bid is accepted; walks `CollabState` machine; links call/bid/seller/designer, agreed price/percent, resulting `shop_item_id`; owns submissions/messages/events). **`CollabEvent`** (append-only collab timeline). **`CollabSubmission`** (preview/final artifact + seller decision + feedback). **`DesignerReview`** (rating 1–5 + comment; nullable seller/collab for seeded demos). **`ChatMessage`** (collab thread message, polled).
- **`platform.py`** — **`Notification`** (user, type, title/body, link_url, seen). **`Plan`** (reference table keyed by code: monthly_price, commission_rate, product_limit, ai_monthly_quota — seeded). **`AICreditTransaction`** (AI credit ledger: seller, delta, reason).

### `app/schemas/` — Pydantic request/response models

- **`__init__.py`** — empty (namespace only).
- **`auth.py`** — `RegisterRequest` (names/email/password/intent buyer|seller/accept_terms, with password-strength + terms validators), `GoogleAuthRequest`, `ForgotPasswordRequest`/`ResetPasswordRequest`/`ForgotPasswordResponse` (includes DEBUG-only `dev_reset_url`), `VerifyEmailRequest`/`ResendVerificationRequest`, `Token` (access_token + `email_verification_required`), `UserPublic`.
- **`onboarding.py`** — `OnboardingUpdate` (all-optional partial autosave) and `OnboardingState`.
- **`dashboard.py`** — `ChecklistFlags`, `StorefrontMini`, `DashboardStats`, `SellerDashboard` (aggregated seller-home payload).
- **`notification.py`** — `NotificationOut`, `NotificationList` (unread count + items).
- **`storefront.py`** — The website-builder contract. `PublishStatus` enum (DRAFT/PUBLISHED/UNPUBLISHED, derived). Validation helpers `normalize_url`, hex/email regexes. Payloads: `SocialLinksPayload` (validates+normalizes URLs, `as_map`), `ThemePayload`, `CurationPayload`, `StorefrontDraftUpdate` (partial autosave). Outputs: `CurationOut`, `ThemeOut`, `StorefrontConfig`, `BuilderProduct`, `SlugCheck`, `StorefrontState` (the full builder state incl. status/blockers/store_url), plus the public-facing `PublicVariant`, `PublicProduct`, `PublicStorefront`. Constants `DEFAULT_THEME`, `SOCIAL_PLATFORMS`, `BUTTON_STYLES`, `DESCRIPTION_MAX`.

> **Note:** several routers (catalog, account, marketplace, analytics, shop_items, hiring, designers, collaborations, orders, designs) define their Pydantic schemas **inline** rather than in `app/schemas/`.

### `app/seams/` — stubbed integration points (MVP free build, swapped for paid services later)

- **`__init__.py`** — docstring only, explaining the seam pattern.
- **`storage.py`** — File/image storage (**the only non-trivial seam**; actually implemented against local disk). `save_image` (validates type/size, flattens transparency, downscales to max-px, re-encodes WebP), `save_design_image` (preserves alpha, keeps PNG for print art, passes SVG through), `save_attachment` (PDF passthrough, else image), `copy_stored_file` (duplicate a blob so records never share files), `delete_image` (best-effort cleanup of own uploads). Raises `StorageError` → HTTP 400. Real impl swaps to S3/Cloudinary + CDN; callers only see the returned URL.
- **`ai.py`** — GenAI image + copy. `generate_design_candidates(prompt, n)` deterministically renders `n` PNG placeholder blobs (Pillow, hash-seeded) so the whole prompt→pick→place flow is real; `generate_product_copy` returns templated title/description/keywords. Real impl = image model + LLM calls.
- **`payments.py`** — Payment gateway. `charge_order` (always "paid"), `pay_designer` (escrow/payout, logs), `start_subscription`. Real impl = Stripe.
- **`delivery.py`** — Notification delivery + shipment. `send_email` (logs instead of sending), `send_password_reset`/`send_verification` wrappers, `create_shipment` (cargo stub). Real impl = transactional email + courier API.
- **`mockups.py`** — `generate_mockups(shop_item_id)` — logged no-op; real impl renders photorealistic product mockups.
- **`search.py`** — `index_product(...)` — logged no-op; real impl pushes into a search index (marketplace search currently uses DB `ILIKE`).

### `app/api/` — routing layer

- **`deps.py`** — Auth dependencies (see Architecture): `oauth2_scheme`/`oauth2_scheme_optional`, `_resolve_user` (decode + session-revocation check), `get_current_user`, `get_optional_user`, `require_role(role)` factory.
- **`routers/__init__.py`** — Builds `api_router` (prefix `/api`) and includes every router below (plus `designers.public_router`, and the lists `orders.routers` and `stubs.routers`).

#### Routers (`app/api/routers/`)

- **`auth.py`** (`/api/auth`) — `POST /register` (create user or claim a guest-checkout account; buyer|seller intent → roles; seeds welcome notifications), `POST /login` (OAuth2 password form + `remember`), `GET /me`, `GET /google/config`, `POST /google` (verify ID token, create/link account), `POST /forgot-password`, `POST /reset-password`, `POST /verify-email`, `POST /resend-verification`.
- **`account.py`** (`/api/settings`) — Account settings, all password-confirmed where sensitive. `GET ""` (full `AccountOut`: personal/business/store/preferences/security). `PATCH /profile`, `POST /avatar` + `DELETE /avatar`, `PATCH /business`, `PATCH /preferences`, `POST /password` (revokes other sessions, returns fresh token), `POST /email` (requires current password, re-triggers verification), `POST /logout-all`. Saved addresses: `GET/POST /addresses`, `PATCH/DELETE /addresses/{id}` (one default per type, "use for both" mirror). Brand/store fields are read-only here (edited in the builder).
- **`catalog.py`** (`/api/catalog`) — Print-partner catalog. `GET /categories`, `GET /facets` (distinct filter values present in active catalog), `GET /base-items` (paged browse with search/category/provider/color/material/print_method/price/available/favorites filters + sort), `GET /base-items/{id}` (detail with variants/options/sizes). Seller favorites: `POST`/`DELETE /base-items/{id}/favorite` (require SELLER). PrintShop write: `POST /base-items` (require PRINTSHOP).
- **`onboarding.py`** (`/api/seller/onboarding`, require SELLER) — `GET ""` (state), `PATCH ""` (partial autosave, upserts `SellerProfile`; regenerates slug only if never published), `POST /complete` (validates brand/country/currency, generates slug, marks complete).
- **`storefront.py`** (`/api/seller/storefront`, require SELLER) — The website builder; all edits go to `storefront_draft`, published columns/public page change only on Publish. `GET ""` (`StorefrontState`), `PATCH ""` (autosave draft, row-locked, prunes draft keys equal to published), `GET /slug-check`, `GET /preview` (draft rendered via the shared renderer), `POST /discard`, `POST/DELETE /logo`, `POST/DELETE /cover` (draft images with orphan cleanup), `POST /publish` (applies draft → published, validates/derives slug, syncs SocialLinks, bumps `storefront_version`/ETag, sets LIVE), `POST /unpublish` (→ UNPUBLISHED, keeps published values).
- **`public_store.py`** (`/api/store`, public) — `GET /{slug}` — buyer-facing published storefront. LIVE-only (else 404), records a `StoreVisit` (IP-hashed, ON CONFLICT), serves a version-stamped weak `ETag` + short `Cache-Control` and honors `If-None-Match` (304). Returns `PublicStorefront` via `curated_products`.
- **`seller_dashboard.py`** (`/api/seller/dashboard`, require SELLER) — `GET ""` — one aggregated `SellerDashboard`: onboarding checklist derived from real state (profile/logo/product/publish-product/publish-store), steps_done/total, `is_active`, storefront mini, lightweight stats.
- **`analytics.py`** (`/api/seller/analytics`, require SELLER) — `GET ""` (date_from/date_to) — full analytics `AnalyticsOut`: revenue (PAID orders), orders, visitors (StoreVisit), conversion, AOV, zero-filled per-day series, by-country, top products (with per-product conversion), top categories. Computed per-request over the seller's rows.
- **`notifications.py`** (`/api/notifications`, auth) — `GET ""` (recent + unread count, polled), `POST /{id}/seen`, `DELETE /{id}`, `POST /read-all`.
- **`designs.py`** (`/api/designs`, require SELLER) — Design artwork + AI credits. `GET /credits` (grants FREE 10-credit quota once via idempotent PLAN_GRANT ledger row), `GET /recent`, `POST /upload` (store via storage seam), `POST /generate` (spends 1 credit; 402 when out; calls AI seam → 4 candidate Designs).
- **`shop_items.py`** (`/api/shop-items`, require SELLER) — Seller products. `GET /commission`, `POST /ai-copy` (AI seam). CRUD: `GET ""` (list with full-catalogue counts + category filter + search/sort), `GET /{id}`, `POST ""` (create from blank+design, enforces `min_price` floor and variant validity, fires mockup+search seams if published), `PATCH /{id}` (edit any facet independently; re-derives production_cost on variant change; enforces state-transition rules `_TRANSITIONS`; writes a `ShopItemRevision` diff), `GET /{id}/revisions`, `POST /{id}/duplicate` (as draft), `DELETE /{id}` (blocked while LISTED).
- **`hiring.py`** (`/api/designer-calls`) — Designer job calls; the 7 display statuses are **derived** from call+bids+collab. `GET /marketplace` (OPEN calls, auth). Seller (require SELLER): `GET ""`, `POST ""` (create draft/published), `PATCH /{id}`, `POST /{id}/close`, `POST /{id}/duplicate`, `DELETE /{id}` (drafts only), `GET /{id}/bids`, `POST /{id}/bids/{bid}/reject`, `POST /{id}/bids/{bid}/accept` (awards call + opens Collaboration + notifies), `POST/DELETE /{id}/attachments...`. Shared: `GET /{id}` (auth). Designer: `POST /{id}/bids` (require DESIGNER; upserts own bid, notifies seller).
- **`designers.py`** — Two routers. `/api/designer` (auth): `GET /me`, `POST /enable` (adds DESIGNER role + profile, idempotent). `/api/designers` (`public_router`, auth): `GET /{slug}` — public designer profile with rating/completed/response stats, reviews, and portfolio.
- **`collaborations.py`** (`/api/collaborations`, auth, membership-checked) — The seller↔designer workspace; every action appends an immutable `CollabEvent`, and the workspace `stage` is derived from state + event log. `GET ""` (my collabs, both roles), `GET /{id}`, `POST /{id}/start` (designer), `POST /{id}/submissions` (designer uploads preview/final via storage seam), `POST /{id}/submissions/{sid}/approve` (seller; final approval → payment or complete), `POST /{id}/submissions/{sid}/revise` (seller feedback → back to designer), `POST /{id}/pay` (seller; payments seam → completes), `GET/POST /{id}/messages` (polled chat). `_complete` auto-creates the seller's draft `ShopItem` from the accepted final design at the pricing floor.
- **`orders.py`** — Exposes four routers (`public`, `router`, `production`, `buyer`) via `orders.routers`. Status model: `Order.status` (money) + `OrderItem.fulfillment_status` (production) → `display_status()` derives the 7 seller-facing statuses; every transition appends an `OrderEvent`.
  - `/api/store` (public): `POST /{slug}/checkout` — buy-now with stubbed payment (find/create buyer, snapshot pricing/placement, mark PAID, notify seller + print shop).
  - `/api/orders` (require SELLER): `GET ""` (list with derived-status counts, filters, sort), `GET /{id}` (detail with economics + timeline), `POST /{id}/cancel` (pre-production only), `POST /{id}/refund` (payments seam).
  - `/api/production` (require PRINTSHOP): `GET /queue` (paid order lines for this shop), `POST /items/{id}/advance` (PAID→IN_PRODUCTION→QC→SHIPPED→DELIVERED via `_NEXT`; fires order-level events + seller notifications only when the aggregate status moves; captures tracking number).
  - `/api/buyer` (require BUYER): `GET /orders`, `GET /orders/{id}` (buyer-facing, no seller economics).
- **`stubs.py`** — Placeholder for not-yet-implemented routers; currently an empty `routers: list = []` keeping `__init__` wiring stable (orders graduated out of here).

### `alembic/` — migrations

- **`alembic.ini`** — Alembic config; `sqlalchemy.url` is set programmatically in `env.py`.
- **`alembic/env.py`** — Loads app `settings` for the URL and imports `app.models.Base` for `target_metadata` (full model metadata → autogenerate + `compare_type`). Standard offline/online runners.
- **`alembic/versions/`** — 22 migrations in a **linear chain** (initial → head):
  1. `904322af6e1b` initial schema
  2. `6b2d2acf08ec` auth names, oauth provider, nullable password
  3. `e7db97983a51` seller onboarding fields
  4. `c9f4a1b7d3e2` storefront publish + social platforms
  5. `d4e8b2a90c15` catalog image_url + favorites
  6. `f1a3c7e920d8` base_item production_time
  7. `b6c2f81ad470` shop_item rotation + tags
  8. `a7d5e3c81b92` designer call job fields + attachments
  9. `c3b9f4d27e15` designer_call published_at
  10. `e8f2a6b41d73` designer reviews
  11. `f4a71c93b528` collaboration activity events
  12. `b1d6e4f28a37` website builder (draft layer, theme, curation)
  13. `c5e8a1f37b64` storefront publishing (version counter + last_published)
  14. `d9c4b7e15a30` shop_item ARCHIVED state + updated_at
  15. `e2a8f60d41c7` product editor variants + revision history
  16. `f7b3d9e24a81` orders checkout + fulfillment (enum values, shipping, events, name snapshot)
  17. `a3f9c2e57d16` order detail deepening (QC/sent-to-provider steps, cost/placement snapshots, payout fix)
  18. `b8e4d1f96c25` store visits (analytics)
  19. `c6d2e9f48b31` notification types
  20. `d7e1f5a83c92` account settings (session revocation, timezone, tax id)
  21. `e9f2b7c4a10d` buyer accounts (terms acceptance timestamp)
  22. `f1a3c8d52e47` buyer profile (phone, currency pref, saved addresses) — **head**

<!-- FRONTEND-SECTION -->
## Frontend

React 18 + TypeScript + Vite SPA for **MyHappinessClub**, a print-on-demand creator marketplace. Sellers design merch (upload or AI), build a public storefront, and sell; designers bid on jobs and collaborate; print shops fulfil orders; buyers browse and purchase. Styling is TailwindCSS with a custom `brand` palette; data-fetching/caching is TanStack Query; routing is React Router v6; HTTP is Axios with a bearer-token interceptor.

### Architecture overview

- **Entry & providers** (`main.tsx`): mounts `<App>` wrapped in `QueryClientProvider` → `BrowserRouter` → `AuthProvider`.
- **Routing** (`App.tsx`): three shells — `PublicLayout` (landing/marketplace/auth/legal), the standalone public `/store/:slug`, full-page `/onboarding`, and the auth-gated `DashboardLayout`. `RequireAuth` gates protected routes (remembers origin via router state); `GuestOnly` bounces logged-in users away from auth screens.
- **API client** (`api/client.ts`): a shared Axios instance at base `/api` (Vite-proxied to backend `:8001`). A request interceptor attaches `Authorization: Bearer <token>`; a response interceptor drops the token and fires a `window` `auth:expired` event on a 401 from non-auth endpoints. Token lives in `localStorage` ("remember me") or `sessionStorage`.
- **State**: server state via React Query (query keys like `["storefront"]`, `["shop-items", filters]`, `["notifications"]`); auth/session via the `AuthProvider` context; ephemeral UI/editor state via local component state and a few `localStorage` helpers.
- **Personas/roles**: `Role = BUYER | SELLER | DESIGNER | PRINTSHOP`. Sidebar nav groups (`components/layout/nav.ts`) render only for roles the user holds. Route prefixes: `/seller/*`, `/designer/*`, `/printshop/*`, `/orders` (buyer). Overview auto-routes sellers to the seller home.
- **Styling**: Tailwind utility classes; `.input`/`.label` component classes and `brand` color scale + `card`/`pop` shadows defined in config. Icons from `lucide-react`; charts from `recharts`.
- **Seams (deferred integrations)**, referenced throughout: storage (local `/uploads`), AI generation, payments (stub checkout), mockup rendering, real-time (chat/notifications are polled).

### Config files (repo root: `frontend/`)

- **`package.json`** — deps: `react` 18, `react-router-dom` 6, `@tanstack/react-query` 5, `axios`, `lucide-react`, `recharts`. Scripts: `dev` (vite), `build` (`tsc --noEmit && vite build`), `preview`.
- **`vite.config.ts`** — React plugin; dev server on port 5173; proxies `/api` and `/uploads` to `http://localhost:8001` (8000 taken by another project).
- **`tsconfig.json`** — strict TS (ES2022, `react-jsx`, bundler resolution, `noUnusedLocals`/`Parameters`, `noFallthroughCasesInSwitch`); `noEmit` (Vite transpiles).
- **`tailwind.config.js`** — scans `index.html` + `src`; extends Inter font, `brand` indigo palette (50–900), `card`/`pop` shadows.
- **`postcss.config.js`** — Tailwind + Autoprefixer.
- **`index.html`** — SPA host page; mounts `#root`, loads `/src/main.tsx`, preconnects/loads Inter from Google Fonts.
- **`.env.example`** — documents `VITE_API_BASE=/api` (override to point at a deployed API).

### `src/` root files

- **`main.tsx`** — React entry; creates the `QueryClient` and renders the provider tree.
- **`App.tsx`** — the full route table plus `RequireAuth`/`GuestOnly` guards. Central map of every path to its page/persona.
- **`auth.tsx`** — `AuthProvider` + `useAuth()` context. Holds `user`/`loading`; on mount fetches `/auth/me` if a token exists. Exposes `login`, `register` (returns `{verifyRequired}`), `loginWithGoogle`, `refreshUser` (re-fetch after gaining a role), `logout`. Listens for the `auth:expired` event to clear the user on session expiry.
- **`styles.css`** — Tailwind layers; base body styling; `.input` and `.label` component classes.
- **`vite-env.d.ts`** — Vite client type reference.

### `src/api/` — typed backend clients (all use the shared `api` instance)

- **`client.ts`** — Axios instance, `getToken`/`setToken`, request/response interceptors (see architecture above).
- **`auth.ts`** — types (`Role`, `UserPublic`, `TokenResponse`, `RegisterInput`, `AuthIntent`). Functions → endpoints: `registerAccount`→`POST /auth/register`, `loginUser`→`POST /auth/login` (form-encoded), `googleLogin`→`POST /auth/google`, `fetchMe`→`GET /auth/me`, `forgotPassword`, `resetPassword`, `verifyEmail`, `resendVerification`, `googleConfig`→`GET /auth/google/config`.
- **`onboarding.ts`** — seller onboarding state. `getOnboarding`/`saveOnboarding`/`completeOnboarding` → `GET/PATCH/POST /seller/onboarding[/complete]`.
- **`dashboard.ts`** — `getSellerDashboard`→`GET /seller/dashboard` returning checklist flags, step counts, storefront mini-status, and stats.
- **`catalog.ts`** — blank/base-item catalog. Types for facets, cards, variants, print options. `getFacets`, `getCatalog` (filter object → query params), `getBaseItem`, `favoriteItem`/`unfavoriteItem`, `listCategories`, `listBaseItems` (flat back-compat list), `createBaseItem` (print-shop). Endpoints under `/catalog/*`.
- **`designs.ts`** — artwork. `getCredits`→`/designs/credits`, `getRecentDesigns`, `uploadDesign` (multipart), `generateDesigns`→`POST /designs/generate` (returns candidates + credits). AI seam.
- **`designers.ts`** — `getMyDesignerProfile`→`/designer/me`, `enableDesigner`→`POST /designer/enable` (adds DESIGNER role), `getDesignerProfile`→`/designers/{slug}` (public profile w/ reviews + portfolio).
- **`collaborations.ts`** — the seller↔designer workflow. Rich types (`CollabStage`, events, submissions, messages, `Collaboration`). Functions: `listCollaborations`, `getCollaboration`, `startWork`, `submitWork` (multipart, PREVIEW/FINAL), `approveSubmission`, `requestRevision`, `completePayment`, `listMessages`, `postMessage`. Endpoints under `/collaborations/*`.
- **`hiring.ts`** — designer job "calls". Types incl. derived 7-state `JobStatus`, `Bid`, attachments. Functions: `listMyCalls`, `listMarketplace`, `getCall`, `createCall`, `updateCall`, `deleteCall`, `uploadAttachment`/`deleteAttachment`, `closeCall`, `duplicateCall`, and bids: `listBids`, `submitBid`, `acceptBid`, `rejectBid`. Endpoints under `/designer-calls/*`.
- **`shopItems.ts`** — the seller's products (design placed on a blank). Types `ShopItem`, `ShopItemPatch`, `ShopItemCreate`, counts, filters, revisions, commission, AI copy. Functions: `getCommission`, `generateCopy`→`POST /shop-items/ai-copy`, `listShopItems`, `getShopItem`, `duplicateShopItem`, `createShopItem`, `updateShopItem`, `listRevisions`, `deleteShopItem`.
- **`storefront.ts`** — the seller's public brand page builder. Types for config, theme, curation, publish status, slug check, public payload. Functions: `getStorefront`, `saveDraft` (autosave), `discardDraft`, `uploadLogo`/`uploadCover`/`removeLogo`/`removeCover`, `publishStorefront`/`unpublishStorefront`, `getPublicStorefront`→`/store/{slug}`, `checkSlug`, `getStorefrontPreview`, plus `absoluteStoreUrl` helper (relative→shareable URL).
- **`orders.ts`** — seller orders + production + public checkout. `OrderDisplayStatus`, list/detail/queue types. Functions: `checkout`→`POST /store/{slug}/checkout` (stub payment seam), `listOrders`, `getOrder`, `cancelOrder`, `refundOrder`, `getProductionQueue`→`/production/queue`, `advanceProduction`.
- **`buyerOrders.ts`** — buyer's own order history. `getBuyerOrders`→`/buyer/orders`, `getBuyerOrder`→`/buyer/orders/{id}`. Reuses `OrderDisplayStatus`.
- **`analytics.ts`** — `getAnalytics(dateFrom, dateTo)`→`/seller/analytics`; returns revenue/orders/visitors, by-day series, and country/product/category breakdowns.
- **`notifications.ts`** — `NotificationType` enum, list type. `getNotifications`, `markNotificationSeen`, `markAllNotificationsRead`, `deleteNotification`. Endpoints under `/notifications/*`.
- **`account.ts`** — settings. `Account` shape (personal/business/store/preferences/security) + addresses. Functions: `getAccount`, `updateProfile`, `uploadAvatar`/`removeAvatar`, `updateBusiness`, `updatePreferences`, address CRUD (`getAddresses`/`createAddress`/`updateAddress`/`deleteAddress`), `changePassword` (rotates token), `changeEmail`, `logoutEverywhere` (rotates token). Under `/settings/*`.
- **`marketplace.ts`** — the public marketplace. `getMarketplaceHome`→`/marketplace/home` (hero, featured, trending brands, categories, new arrivals), `getMarketplaceProducts`→`/marketplace/products` (category/q/sort/limit).

### `src/lib/` — pure utilities & shared vocab

- **`cn.ts`** — `cn(...)` className joiner (filters falsy).
- **`apiError.ts`** — `apiError(e, fallback)` extracts FastAPI `detail` (incl. 422 arrays) into a human message.
- **`password.ts`** — `passwordChecks`/`isPasswordValid` (8+ chars, letter, number).
- **`geo.ts`** — `COUNTRIES`/`CURRENCIES` lists + `currencyForCountry`.
- **`timeAgo.ts`** — compact relative time ("5m ago").
- **`returnTo.ts`** — safe post-login redirect resolution (`?next=` → guard origin → fallback; blocks open-redirects).
- **`recentlyViewed.ts`** — localStorage-backed recently-viewed catalog items (max 8).
- **`productConfig.ts`** — `ProductConfig` type: a seller's chosen blank+variant carried through the design/hire flow via router state.
- **`designState.ts`** — the design editor's model: `Placement`/`PlacedDesign`/`EditorState`, per-area print frames (`AREA_FRAMES`), `centeredPlacement`, localStorage autosave (`loadEditor`/`saveEditor`/`clearEditor`), and image analysis (`analyzeImage`, `computeWarnings` for low-res/no-alpha/out-of-bounds).
- **`jobStatus.ts`** — `JOB_STATUSES` + `jobStatusMeta` (label + Badge tone) for hiring.
- **`collabStage.ts`** — `stageMeta` (stage→label/tone) and `eventLabel` (collab event→text).
- **`socials.ts`** — `SOCIALS` defs (key/backend-code/icon/placeholder) for storefront social links.
- **`publishStatus.ts`** — `PUBLISH_STATUS` (DRAFT/PUBLISHED/UNPUBLISHED → label/tone/dot/hint), single source of storefront-status vocab.
- **`productStatus.ts`** — `PRODUCT_STATUS` maps DB `ShopItemState` to seller-facing labels (UNLISTED→"Draft", LISTED→"Published", etc.).
- **`orderStatus.ts`** — `ORDER_STATUS` (7 statuses→label/tone), `ORDER_EVENT_LABELS`, `ORDER_STEPS` (fulfillment stepper order).
- **`colorHex.ts`** — `colorHex(name)` maps colour names→hex swatch (with multi-word fallback); `isLightColor` for border decisions.
- **`notificationMeta.ts`** — `notificationMeta(type)` (icon/tone/group) and `NOTIFICATION_GROUPS` filter list.
- **`categoryIcon.ts`** — `categoryIcon(name)`→lucide icon for marketplace categories (fallback gift).

### `src/hooks/`

- **`useClickOutside.ts`** — dismisses dropdowns on outside pointerdown/Escape; used by the notification bell and profile menus.

### `src/components/ui/` — reusable primitives

- **`Button.tsx`** — `Button` with `variant` (primary/outline/ghost) and `size` (sm/md).
- **`Card.tsx`** — rounded/bordered/shadowed container.
- **`PageHeader.tsx`** — title + optional subtitle + right-aligned `actions`. Used atop most dashboard pages.
- **`EmptyState.tsx`** — icon + title + hint + optional action; empty-list placeholder.
- **`Stat.tsx`** — KPI tile (icon, label, big value, hint).
- **`Badge.tsx`** — pill with `Tone` (brand/slate/green/amber); exports the shared `Tone` type used across the status libs.
- **`Stars.tsx`** — read-only 5-star rating; also `formatResponse(hours)` ("~6h") for designer response time.

### `src/components/layout/` — app shells & chrome

- **`Brand.tsx`** — the MyHappinessClub logo/wordmark link.
- **`nav.ts`** — `NAV_GROUPS`: per-role sidebar link definitions (Seller/Designer/Print shop/Buyer) consumed by `DashboardLayout`.
- **`DashboardLayout.tsx`** — the authed shell: sticky sidebar (role-filtered nav + user card + logout), top header (Marketplace link, `NotificationsMenu`, `ProfileMenu`), and `<Outlet>`.
- **`PublicLayout.tsx`** — public header (Explore/For-creators nav, login/get-started or dashboard/logout) + footer + `<Outlet>`; wraps landing/marketplace/auth/legal routes.
- **`NotificationsMenu.tsx`** — header bell dropdown. Polls `getNotifications` every 45s (query key `["notifications"]`), unread badge, mark-seen/mark-all-read mutations, navigates on `link_url`, link to full page.
- **`ProfileMenu.tsx`** — avatar dropdown: dashboard/storefront/settings links, "Become a designer" (`enableDesigner` mutation → `refreshUser` → `/designer`), logout.

### `src/components/auth/`

- **`AuthCard.tsx`** — `AuthCard` (centered titled card + footer) and `AuthDivider` ("or") used by every auth screen.
- **`GoogleButton.tsx`** — lazy-loads Google Identity Services, renders the official button when `googleConfig().enabled`, otherwise a disabled placeholder; calls `onCredential`.
- **`PasswordChecklist.tsx`** — live checklist from `passwordChecks`.
- **`TermsCheckbox.tsx`** — required Terms/Privacy consent with new-tab policy links.

### `src/components/dashboard/` — seller home widgets

- **`WelcomeCard.tsx`** — gradient hero; shows setup-progress bar when store isn't active yet, else a "welcome back".
- **`OnboardingChecklist.tsx`** — 5-step setup checklist (profile/logo/product/publish product/publish store) from `ChecklistFlags`, each linking to the relevant page.
- **`QuickActions.tsx`** — grid of shortcut tiles (create product, edit store, browse catalog, hire designer, analytics-"soon").
- **`RecentNotifications.tsx`** — "Recent activity" card; shares the polled `["notifications"]` query, shows latest 4.

### `src/components/catalog/`

- **`ProductCard.tsx`** — a catalog blank card (image, provider, colour swatches, "from €", print-area count) with optimistic favorite toggle; links to `/seller/catalog/:id`.
- **`CatalogFilters.tsx`** — the catalog filter sidebar (category/provider/color/material/print-method chips, price range, in-stock/favorites toggles); single-select chip behavior, "clear all".

### `src/components/design/`

- **`DesignCanvas.tsx`** — interactive editor canvas: blank image, dashed print-area frame, draggable design overlay (pointer events → placement %). Feeds `DesignEditor`.
- **`DesignPreviewThumb.tsx`** — static composite thumbnail (design overlaid on blank at stored pos/scale/rotation); the ubiquitous product mockup used in grids, orders, storefront, queue. Mockup seam stand-in.

### `src/components/storefront/`

- **`StorefrontView.tsx`** — the buyer-facing storefront renderer, **shared** by the public `/store/:slug` page and the builder's live preview so preview == production. Applies theme via CSS variables, renders cover/logo/identity/socials/products; `mobile` prop forces phone layout; optional `onBuy` shows Buy-now buttons (only the public page passes it).
- **`BuyNowModal.tsx`** — checkout dialog: colour/size/quantity + shipping form → `checkout()` (stub payment). Pre-fills logged-in buyer details and saved default shipping address; on success nudges guests to sign up (with `?next`) to adopt the order.

### `src/components/account/`

- **`AddressBook.tsx`** — saved-addresses manager (query `["addresses"]`): shipping/billing groups, add/edit modal form, set-default, delete. Embedded in Settings and reused by `BuyNowModal`.

### `src/components/marketplace/`

- **`ProductTile.tsx`** — a marketplace product card (composite thumb, name, store, price); links to the creator's `/store/:slug` (no separate product page).

### `src/pages/` — public & auth

- **`Landing.tsx`** (`/`) — the marketplace homepage. Fetches `getMarketplaceHome`; renders hero + featured brand, category tiles, featured products, trending brands, new arrivals, and a creator CTA. Empty/error states.
- **`Marketplace.tsx`** (`/marketplace`) — product browse/search: URL-driven category chips, debounced search, sort, "load more" paging via `getMarketplaceProducts`.
- **`Login.tsx`** (`/login`, GuestOnly) — email/password + Google login; "remember me"; redirects via `returnTo`.
- **`Signup.tsx`** (`/signup`, GuestOnly) — buyer signup (intent `buyer`); routes to `/verify-email` if verification required.
- **`SellerSignup.tsx`** (`/sell`, GuestOnly) — seller signup (intent `seller`); routes new sellers to `/onboarding`.
- **`ForgotPassword.tsx`** (`/forgot-password`, GuestOnly) — request reset link; shows dev reset URL when email is stubbed.
- **`ResetPassword.tsx`** (`/reset-password`) — token-based new password with checklist + confirm.
- **`VerifyEmail.tsx`** (`/verify-email`) — verifies token from URL, or shows "check your inbox" + resend.
- **`Legal.tsx`** (`/terms`, `/privacy`) — placeholder `Terms`/`Privacy` pages (exported named).
- **`NotFound.tsx`** (`*`) — 404.

### `src/pages/onboarding/`

- **`SellerOnboarding.tsx`** (`/onboarding`, auth, full-page) — 4-step wizard (welcome → brand → country/currency → finish) with autosave per step; skips if already completed; finishes to `/dashboard`.

### `src/pages/store/`

- **`Storefront.tsx`** (`/store/:slug`, public, own shell) — the live public brand page. Fetches `getPublicStorefront` with stale-guard + distinct not-found/error states; renders `StorefrontView` and mounts `BuyNowModal` on buy.

### `src/pages/dashboard/` — shell root & shared

- **`Overview.tsx`** (`/dashboard`) — role router: sellers get `SellerHome`; others get a workspace grid of role cards.
- **`SellerHome.tsx`** — the seller dashboard body: `WelcomeCard`, then either stats (active store) or `OnboardingChecklist`, `QuickActions`, `RecentNotifications`. Data from `getSellerDashboard`.
- **`Notifications.tsx`** (`/notifications`) — full notifications page: category filter tabs, date buckets (Today/Yesterday/…), mark-seen/read-all/delete; polls 45s.
- **`Settings.tsx`** (`/settings`) — account settings: personal info + avatar, `AddressBook`, business & store (sellers only), preferences (language/currency/timezone/toggles), security (change/set password, connected Google, sessions, logout-everywhere), change-email modal. Each section autosaves via its own mutation.
- **`DesignerProfile.tsx`** (`/designers/:slug`) — public designer profile: header (avatar/rating/completed jobs/response), portfolio grid, reviews. Viewed by sellers from job applications.
- **`CollaborationWorkspace.tsx`** (`/collaborations/:id`) — the shared seller↔designer workspace: overview + stage actions (start work / complete payment / view draft product), submissions list with approve/request-revision (seller) and upload (designer, PREVIEW/FINAL), polled messages chat, and event timeline. Role-aware via `my_role`.

### `src/pages/dashboard/seller/`

- **`SellerStudio.tsx`** (`/seller`) — seller landing: storefront status card (draft/publish/republish + view-live), stat tiles, and a recent-products grid. Pulls storefront, dashboard, and shop-items.
- **`SellerCatalog.tsx`** (`/seller/catalog`) — browse blanks: recently-viewed strip, debounced search, sort, `CatalogFilters` sidebar, infinite-scroll grid of `ProductCard` via `useInfiniteQuery`.
- **`ProductDetail.tsx`** (`/seller/catalog/:id`) — configure a blank: colour/size/material/print-type/position selectors (availability-aware), live price breakdown, favorite; CTAs "Design yourself"→`/seller/design/:id` or "Hire a designer"→`/seller/hiring/new`, passing a `ProductConfig` in router state. Records recently-viewed.
- **`DesignEditor.tsx`** (`/seller/design/:baseItemId`) — the design tool: `DesignCanvas` with drag, size/rotation sliders, center/replace/remove, undo/redo history, area/color pickers, image warnings; upload or AI-generate artwork (credits). Two callers — creation flow (→`/seller/products/new`) and edit flow (`editing` state, hands artwork back to `/seller/products/:id/edit`). Autosaves the creation draft to localStorage.
- **`ProductNew.tsx`** (`/seller/products/new`) — finalize a new product: name/description/AI-copy/tags, profit calculator (min price = cost/(1−rate)), review card with validations; publish or save-as-draft via `createShopItem`. Requires config+design in router state.
- **`ProductEdit.tsx`** (`/seller/products/:id/edit`) — edit an existing product: info, design (re-opens `DesignEditor` via `editing` handoff), variant/print options (recomputes cost/min-price locally), price/profit, change history (revisions), sticky preview + save/publish/unpublish/duplicate/archive/delete. Reuses the creation flow's design editor rather than a second one.
- **`SellerProducts.tsx`** (`/seller/products`) — product manager: tabs Drafts/Published/Collaborations/Archived with counts, search/category/date/sort filters, per-card actions (edit/publish/unpublish/restore/duplicate/archive/delete) with API-aware guarding; the Collaborations tab merges active collabs + legacy PENDING rows.
- **`SellerStorefront.tsx`** (`/seller/storefront`) — the website builder: publishing-status card (URL/copy/visit/blockers), branding (logo/cover uploads, name, description), theme (presets, hex color fields, button style), homepage curation (reorder/feature/hide), store info (live slug-check), socials; debounced draft autosave, publish (flushes pending edits first), unpublish, discard; sticky live `StorefrontView` preview with desktop/mobile toggle.
- **`StorefrontPreview.tsx`** (`/seller/storefront/preview`) — full-page draft preview from `getStorefrontPreview` (same renderer as public), device toggle, publish button; deliberately outside the dashboard chrome.
- **`SellerOrders.tsx`** (`/seller/orders`) — orders table: status tabs with counts, search/date/sort filters, rows linking to detail; shows total + earnings per order.
- **`OrderDetail.tsx`** (`/seller/orders/:id`) — one order: fulfillment stepper (from event log), line items with economics, subtotal/production/commission/profit breakdown, customer/shipping/payment cards, cancel/refund with confirm modals; polls every 15s.
- **`SellerAnalytics.tsx`** (`/seller/analytics`) — analytics dashboard (recharts): date-range presets + custom, KPI tiles, revenue area chart, orders/visitors line charts, country/product/category horizontal bars, product-performance table; polls 60s.
- **`SellerHiring.tsx`** (`/seller/hiring`) — job-offers list: status filter chips, per-job card with applications count/pay/deadline and actions (view/edit/publish/duplicate/close/delete). Exports the shared `payLabel(call)` helper reused by designer pages and `JobDetail`.
- **`JobForm.tsx`** (`/seller/hiring/new` and `/:id/edit`) — create/edit a design job: details, compensation (fixed/percent/both), timeline, attachments (reference images/brand guidelines; deferred to after creation for new jobs); publish or draft. Requires a `ProductConfig` (from catalog) or existing call.
- **`JobDetail.tsx`** (`/seller/hiring/:id`) — one job: applications list with designer social proof and accept/reject, the brief + attachments, product/terms sidebar; links to the collaboration once a bid is accepted.

### `src/pages/dashboard/designer/`

- **`DesignerCalls.tsx`** (`/designer`) — open-job marketplace: card grid of published calls (`listMarketplace`) with pay/style/deadline; links to detail.
- **`CallDetail.tsx`** (`/designer/calls/:id`) — one call for a designer: brief + attachments, product sidebar, and the application form (price/percent/message) via `submitBid`; supports revising an existing application.
- **`DesignerCollabs.tsx`** (`/designer/collabs`) — the designer's collaborations list (`listCollaborations`) with stage badges; links to the shared workspace.

### `src/pages/dashboard/printshop/`

- **`PrintShopQueue.tsx`** (`/printshop`) — production queue: to-produce/in-production/shipped stats, item table with next-action buttons advancing paid→production→QC→shipped (shipping opens a tracking-number modal); polls 20s.
- **`PrintShopCatalog.tsx`** (`/printshop/catalog`) — the print shop's blanks catalog: list plus an add-blank form (`createBaseItem`). These blanks are what sellers design on.

### `src/pages/dashboard/buyer/`

- **`BuyerOrders.tsx`** (`/orders`) — buyer's order history list with thumbnails, status, tracking; polls 30s.
- **`BuyerOrderDetail.tsx`** (`/orders/:id`) — one buyer order: tracking banner, fulfillment stepper, items, total, timeline, storefront + shipping cards; polls 30s. (Read-only counterpart to the seller `OrderDetail`.)

---

## 3. Cross-cutting patterns worth knowing

- **Shared render primitives keep previews honest.** `StorefrontView` (frontend) + `storefront_render.curated_products` (backend) power both the seller preview and the live public page, so "preview" can never drift from "production". Same idea for `DesignPreviewThumb` as the product mockup everywhere.
- **Status vocab lives once.** Frontend `lib/*Status.ts` / `*Stage.ts` + the `Badge` `Tone` type mean no two screens describe a state differently; backend derives those statuses server-side from base facts.
- **Near-real-time = polling.** Notifications (45s), orders (15s), production queue (20s), buyer orders (30s), analytics (60s), collab chat — all React Query `refetchInterval`, standing in for a future websocket seam.
- **Flow state travels via router state + localStorage.** The catalog→design→publish flow passes a `ProductConfig` and design handoff through React Router `location.state`, plus localStorage autosave — no global store.
- **Money is snapshotted at purchase.** `OrderItem` freezes name, unit price, production cost, commission, and design placement at buy-time, so later product edits/renames can never rewrite an order's history.
