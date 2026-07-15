# MyHappinessClub — Build Report
**Generated:** 2026-05-27  
**Status:** ✅ MVP running — connected to Supabase, dev server live at localhost:3000

---

## 1. Project Overview

MyHappinessClub is a creator-first merch marketplace. Three user types:
- **Sellers** — create storefronts, list products, choose a subscription plan
- **Buyers** — browse storefronts, add to cart (checkout coming when payments are enabled)
- **Designers** — post-MVP, not yet implemented

The current MVP covers seller signup → storefront creation → product management → public storefront → buyer cart. Payment processing is stubbed and will be wired up in a future session.

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.5.18 |
| Language | TypeScript | 5.x |
| Database ORM | Prisma | 5.22.0 |
| Database | PostgreSQL via Supabase | free tier, West EU (Ireland) |
| Auth | NextAuth.js | v5 beta |
| Payments | Stripe | stubbed — not active yet |
| Styling | Tailwind CSS + shadcn/ui | 3.4.x |
| State (cart) | Zustand | 5.x |
| Hosting target | Vercel | — |

---

## 3. Database

### Connection
- **Provider:** Supabase (project: `vwlzzsyyqakwwdewgzkj`, West EU / Ireland)
- **Connection method:** Session pooler (`aws-0-eu-west-1.pooler.supabase.com:5432`) — direct connection on port 5432 is not available on the Supabase free tier without the IPv4 add-on
- **Schema pushed with:** `prisma db push` (not `migrate dev` — direct connection required for migrations is unavailable; `db push` uses the pooler and works fine for development)

### Models

#### `User`
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| email | String | Unique |
| passwordHash | String | bcrypt, 12 rounds |
| role | Enum: SELLER / BUYER | Set at signup |
| createdAt | DateTime | Auto |

#### `SellerProfile`
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| userId | String | FK → User (1:1) |
| slug | String | Unique — used in /store/[slug] |
| name | String | Display name |
| bio | String? | Optional |
| avatarUrl | String? | Optional |
| plan | Enum: FREE / CREATOR / PRO | Defaults to FREE |
| stripeCustomerId | String? | Reserved for when payments are enabled |
| stripeSubscriptionId | String? | Reserved for when payments are enabled |
| subscriptionStatus | String? | Reserved for when payments are enabled |
| currentPeriodEnd | DateTime? | Reserved for when payments are enabled |

#### `Product`
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| sellerId | String | FK → SellerProfile |
| name | String | Required |
| description | String? | Optional |
| price | Float | In euros |
| imageUrl | String? | Direct URL — file upload is post-MVP |
| category | String? | From predefined list |
| active | Boolean | Toggleable; default true |

#### `Order`
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| buyerId | String | FK → User |
| sellerId | String | FK → SellerProfile |
| stripePaymentIntentId | String? | Reserved for payments |
| stripeSessionId | String? | Reserved for payments |
| subtotal | Float | Full amount paid |
| commissionAmount | Float | Platform cut (calculated at order time) |
| status | Enum: PENDING / PAID / FULFILLED / CANCELLED | |

#### `OrderItem`
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| orderId | String | FK → Order |
| productId | String | FK → Product |
| quantity | Int | |
| priceAtPurchase | Float | Snapshot at time of order |

#### `Session`
Reserved for optional NextAuth DB session adapter. Currently using JWT strategy (no DB sessions).

---

## 4. Commission & Plan Logic

Defined in [src/lib/commission.ts](../src/lib/commission.ts).

| Plan | Monthly fee | Commission rate | Product limit |
|---|---|---|---|
| FREE | €0 | 15% | 5 active |
| CREATOR | €19 | 10% | Unlimited |
| PRO | €49 | 5% | Unlimited |

Commission is calculated at checkout time and stored in `Order.commissionAmount`. Net payout to seller = `subtotal − commissionAmount`. This logic is fully implemented — it will activate when payments are enabled.

---

## 5. File Structure

```
merch_app/
├── prisma/
│   └── schema.prisma                   # All DB models
├── reports/
│   ├── build-report.md                 # This file
│   └── workflow.md                     # Development workflow
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── signup/page.tsx         # Role selector + registration form
│   │   │   └── login/page.tsx          # Credentials login
│   │   ├── (seller)/
│   │   │   ├── onboarding/page.tsx     # 2-step: plan picker → storefront setup
│   │   │   ├── dashboard/page.tsx      # Revenue stats + recent orders + products
│   │   │   └── products/
│   │   │       ├── page.tsx            # Products list with toggle/delete
│   │   │       └── new/page.tsx        # Create product form
│   │   ├── (buyer)/
│   │   │   └── orders/page.tsx         # Order history
│   │   ├── store/
│   │   │   └── [slug]/page.tsx         # Public storefront (SSR, SEO-friendly)
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── [...nextauth]/route.ts   # NextAuth handler
│   │   │   │   └── register/route.ts        # POST /api/auth/register
│   │   │   ├── onboarding/route.ts          # POST /api/onboarding
│   │   │   ├── products/
│   │   │   │   ├── route.ts                 # GET + POST /api/products
│   │   │   │   └── [id]/route.ts            # PATCH + DELETE /api/products/:id
│   │   │   ├── subscriptions/route.ts       # STUBBED — returns 503
│   │   │   ├── checkout/route.ts            # STUBBED — returns 503
│   │   │   └── webhooks/stripe/route.ts     # STUBBED — returns 200 no-op
│   │   ├── layout.tsx                       # Root layout + metadata
│   │   ├── page.tsx                         # Landing page
│   │   └── globals.css                      # Tailwind + CSS variables
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── card.tsx
│   │   │   └── badge.tsx
│   │   ├── ProductCard.tsx             # Buyer-facing product tile with Add to Cart
│   │   ├── CartDrawer.tsx              # Slide-in cart (checkout shows "coming soon")
│   │   └── ProductActions.tsx          # Toggle active / delete (seller-side)
│   ├── lib/
│   │   ├── prisma.ts                   # Prisma client singleton
│   │   ├── stripe.ts                   # Stubbed — plan config only, no Stripe client
│   │   ├── auth.ts                     # NextAuth config + JWT callbacks
│   │   ├── commission.ts               # Commission rates + product limits
│   │   ├── cart-store.ts               # Zustand cart (persisted to localStorage)
│   │   └── utils.ts                    # cn(), formatCurrency(), slugify()
│   ├── middleware.ts                    # Auth guards + role-based redirects
│   └── types/
│       └── next-auth.d.ts              # Session type augmentation (id, role, sellerSlug)
├── .env                                 # DATABASE_URL for Prisma (not committed)
├── .env.local                           # All app secrets — not committed
├── .gitignore
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.mjs
└── package.json
```

---

## 6. API Reference

### Auth

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | None | Create a new user account |
| POST | `/api/auth/signin` | None | NextAuth credentials login |
| GET | `/api/auth/session` | JWT | Return current session |

**Register body:**
```json
{ "email": "...", "password": "...", "role": "SELLER" | "BUYER" }
```

---

### Onboarding

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/onboarding` | SELLER | Create SellerProfile (slug, name, bio, plan) |

**Body:**
```json
{ "name": "My Store", "slug": "my-store", "bio": "...", "plan": "FREE" }
```

---

### Products

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/products` | SELLER | List own products |
| POST | `/api/products` | SELLER | Create product (enforces Free plan limit) |
| PATCH | `/api/products/:id` | SELLER (owner) | Update product fields |
| DELETE | `/api/products/:id` | SELLER (owner) | Delete product |

**POST body:**
```json
{ "name": "...", "description": "...", "price": 29.99, "imageUrl": "...", "category": "Apparel" }
```

---

### Subscriptions ⚠️ Stubbed

| Method | Route | Status |
|---|---|---|
| POST | `/api/subscriptions` | Returns 503 — not active |

---

### Checkout ⚠️ Stubbed

| Method | Route | Status |
|---|---|---|
| POST | `/api/checkout` | Returns 503 — not active |

---

### Webhooks ⚠️ Stubbed

| Method | Route | Status |
|---|---|---|
| POST | `/api/webhooks/stripe` | Returns 200 no-op — not active |

---

## 7. Pages & Routes

| Route | Type | Access | Description |
|---|---|---|---|
| `/` | Client | Public | Landing page |
| `/signup` | Client | Public (redirects if logged in) | Registration |
| `/login` | Client | Public (redirects if logged in) | Login |
| `/onboarding` | Client | SELLER only | Plan picker → storefront setup |
| `/dashboard` | Server | SELLER only | Overview stats + recent orders |
| `/products` | Server | SELLER only | Product list |
| `/products/new` | Client | SELLER only | Create product |
| `/store/[slug]` | Server (SSR) | Public | Buyer-facing storefront |
| `/orders` | Server | Logged in | Buyer order history |

---

## 8. Security Notes

- Passwords hashed with `bcryptjs` (12 rounds)
- All seller API routes verify session role server-side before any DB operation
- Product ownership verified on PATCH/DELETE (cross-seller access impossible)
- No sensitive data in JWT beyond user id, role, and sellerSlug
- `.env` and `.env.local` excluded from git via `.gitignore`
- Stripe webhook signature verification is implemented in code but dormant while payments are stubbed

---

## 9. What Payments Being Stubbed Means

The following are **fully implemented in code** but inactive until Stripe keys are added and the stub routes are replaced:

| Feature | Code status | Active? |
|---|---|---|
| Buyer checkout (Stripe Checkout) | Written | ❌ Stubbed |
| Commission deduction on payment | Written | ❌ Stubbed (no orders created) |
| Seller subscription billing | Written | ❌ Stubbed |
| Webhook: order creation on payment | Written | ❌ Stubbed |
| Webhook: plan sync on subscription change | Written | ❌ Stubbed |
| Plan stored on SellerProfile | ✅ Active | ✅ Yes (set at onboarding) |
| Free plan 5-product limit | ✅ Active | ✅ Yes |
| Cart (add/remove/quantity) | ✅ Active | ✅ Yes |

---

## 10. Post-MVP Backlog

- **Payments** — re-enable Stripe (checkout, subscriptions, webhooks)
- File upload for product images (currently URL input only)
- Designer user type + collaboration marketplace
- AI design generation tool
- Custom subdomains for Pro sellers
- Discount/coupon codes
- Affiliate link tracking
- Featured placement system
- Email notifications (order confirmations, etc.)
- Advanced analytics / sales charts
- Admin panel
- Multi-seller cart

---

## 11. Known Limitations

- Cart supports items from **one seller at a time** by design (multi-seller cart is post-MVP)
- No image upload — sellers paste a direct image URL
- `prisma db push` is used instead of `prisma migrate dev` because Supabase free tier blocks direct connections; push works via the session pooler
- Subscription plan is recorded at onboarding but not enforced via billing until payments are enabled
