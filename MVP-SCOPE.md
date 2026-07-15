# MyHappinessClub — MVP Scope

**Decided:** 2026-07-02 (grill session)
**Status:** scope agreed — pending DB re-model (step 2) and stack rebuild (step 3)

---

## What the MVP is

A **walking skeleton of the full platform**: every user role has real, working
views over a real data model, so the whole concept is demoable end-to-end. We
build **only what is free** right now. Every capability that costs money or needs
a third-party account is left as a **clearly-marked seam** — a stub behind an
interface — so it can be plugged in later without reshaping the app.

**Three guiding rules:**
1. Every role's core views work on real data.
2. If it costs money or needs an external paid account, it's a seam, not a build.
3. The data model + directory layout must survive the later integrations without a rewrite.

> **Glossary:** domain terms (BaseItem, ShopItem, Design, DesignerCall, Bid,
> Collab, Order, …) are defined in [CONTEXT.md](CONTEXT.md).

---

## Roles (4, multi-role accounts)

One account can hold several roles at once. Everyone is a **Buyer** by default.

| Role | In MVP | Notes |
|---|---|---|
| **Buyer** | ✅ | Default. Browse, cart, checkout, order history. |
| **Seller** | ✅ | Storefront, products, design tool, hiring, analytics. |
| **Designer** | ✅ | Portfolio, browse calls, bid, collaborate, chat. |
| **PrintShop** | ✅ | Owns blank catalog + production queue. |
| **Admin** | ❌ later | Managed out-of-band (DB tools) for now. |

---

## Core commerce model

Print-on-demand **concept**: a Seller picks a **BaseItem** (blank) from a
PrintShop's catalog, applies a **Design**, sets a price → publishes a **ShopItem**.
A Buyer buys it → an **Order** flows to the PrintShop's production queue → the
PrintShop makes it and hands it to shipment.

---

## What's IN the MVP (build now, free)

### Seller
- Onboarding: pick a **Plan** (Free/Creator/Pro — recorded, billing stubbed), set up storefront.
- **Storefront editor**: cover, avatar, bio, social links (plain URLs), product order, live/draft toggle.
- **My Products**: listed / unlisted / pending sections; list & unlist; edit price/name/description/photos.
- **"Design now" tool**: upload a PNG → drag onto the blank's print area (store x/y/scale) → CSS-overlay preview. Set name/price/description, see estimated earnings. Publish as listed or unlisted.
- **"Hire a designer"**: post a **DesignerCall** (brief, reference image, deadline, payment type = fixed/%/both, optional budget).
- **Bids inbox**: review Designer **Bids**, chat, accept one → creates a Pending **Collab**.
- **Collab (seller side)**: walk the state machine, accept/decline submissions with feedback.
- **Basic analytics**: revenue over time, orders per product, top products.

### Designer
- **Portfolio** page (same shape as a storefront).
- Browse open **DesignerCalls**, submit **Bids** (price + message), manage/withdraw them.
- **Collab (designer side)**: submit work, see feedback, advance states. (Can never list the final product themselves.)
- **Chat** with the Seller (basic polled thread).
- Basic analytics (own collabs/earnings).

### Buyer
- **Landing / discovery**: categories, best-sellers, top-influencer cards.
- **All products** page with filters + basic name search.
- Product page → **Cart** (single seller, multi-item) → **Checkout** (creates a real paid Order, no real gateway).
- **Order history**.

### PrintShop
- **Catalog management**: CRUD **BaseItems** + sizes/colors/print options/base prices.
- **Production queue**: paid Orders to make → mark `in_production` → `handed_to_shipment`.

### Cross-cutting (IN)
- **Auth** + multi-role accounts + role-based routing/guards.
- **In-app Notifications**: bell + list (sale, new bid, bid accepted, collab state change, new production order). Email delivery = seam.
- **Plans**: 3 tiers as config; free limits enforced (product cap, AI quota); paid perks shown but gated.
- **AI credits**: balance shown, decrements on (stubbed) AI generation.
- **Orders + plan-based Commission**: `Free 15% / Creator 10% / Pro 5%`, computed & stored at order time.

---

## Seams — left open for later paid/API integration

Each is an interface with a stub implementation now; swap in the real service later.

| # | Seam | MVP stub behavior |
|---|---|---|
| 1 | **GenAI image generation** | "Generate with AI" button returns a placeholder / mock image. |
| 2 | **Mockup rendering** | Preview = CSS overlay of art on the blank photo (no realistic render). |
| 3 | **Payment gateway** (Stripe) | Checkout marks Order `paid` with no charge; subscription billing + designer fixed-fee **escrow** stubbed. |
| 4 | **Cargo / shipment** | Ends at `handed_to_shipment`; tracking + cargo notifications stubbed. |
| 5 | **Social OAuth + follower verification** | Social links are plain URLs; no verified follower counts. |
| 6 | **Email / push delivery** | Notifications are in-app only. |
| 7 | **File / image storage** | Uploads to local/free storage; cloud (S3/etc.) later. |
| 8 | **Search** | Basic name match; AI/vector search later. |

---

## Explicitly DEFERRED to later phases

- **Admin** dashboard (approvals, moderation).
- **Follower-based commission** brackets (`FollowersPercentage`) + **follower-gated products** (`only_followers`).
- **Cargo/delivery modeling**: pickup/drop options, cities, delivery times, base price.
- **Promotions**: discount codes, referral links, affiliate tracking (shown as locked plan perks).
- **Real-time chat** (websockets) — MVP chat is a polled message thread.
- **Custom subdomain** + white-label (Pro perk).
- **AI add-on credit packs**, high-res/commercial AI tiers.
- **Advanced analytics**: sales-by-country, calendar.
- **Real payments, real AI, real mockups, real fulfillment** — see seams above.

---

## Next steps (per project plan)

1. ✅ **Step 1 — MVP scope agreed** (this doc).
2. ✅ **Step 2 — Database re-modelled** → [DATA-MODEL.md](DATA-MODEL.md) (added Order/Cart/production-queue; cleaned User/Role/Design/Collab).
3. ✅ **Step 3 — Stack scaffolded** → FastAPI + SQLAlchemy/Alembic backend (`/backend`) + Vite/React SPA (`/frontend`) + Docker Postgres. 27 tables mapped; auth + catalog live; every other role surface stubbed. Old Next.js build archived in `/legacy`. See [docs/adr/0001](docs/adr/0001-stack-fastapi-react-postgres.md).
4. 🚧 **In progress — Fill in the role surfaces.** Implement the stub routers + build the React views per role, following the `catalog` router pattern and swapping seams as paid services come online.
   - ✅ Seller **auth** (JWT, Google, reset, verify seam) + **onboarding** wizard.
   - ✅ Seller **storefront**: brand editor (logo/cover upload → local-disk storage seam #7 with Pillow optimize, description, social links, custom store URL), in-app Preview, Draft→Publish, and the public `/store/{slug}` page (product grid stubbed until products ship).
   - ✅ Seller **dashboard** (`/dashboard`, role-aware): welcome + onboarding checklist (derived from real state), quick actions, and **in-app notifications** — real router (list/unread/mark-seen/mark-all), ~45s polling (websockets = deferred seam #6), Welcome+Tip seeded at signup, top-bar bell + profile dropdowns.
