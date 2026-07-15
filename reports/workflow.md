# MyHappinessClub — Development Workflow

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | 10+ | Bundled with Node |
| Supabase account | Free | [supabase.com](https://supabase.com) |
| Git | Any | — |

> **Stripe CLI** is not needed right now — payments are stubbed. It will be required when payments are re-enabled.

---

## Current Environment

The project is already set up and running. For reference:

| What | Value |
|---|---|
| Database | Supabase — `vwlzzsyyqakwwdewgzkj` (West EU, Ireland) |
| Connection | Session pooler — `aws-0-eu-west-1.pooler.supabase.com:5432` |
| Schema | Pushed via `prisma db push` (tables exist in Supabase) |
| Dev server | `npm run dev` → http://localhost:3000 |

---

## Starting the Dev Server

```bash
npm run dev
```

That's it. The database is already connected and the schema is already pushed.

---

## First-Time Setup (for a new machine or collaborator)

### 1. Install dependencies
```bash
npm install
```

### 2. Set up `.env` and `.env.local`

**`.env`** — used by Prisma CLI only:
```env
DATABASE_URL="postgresql://postgres.vwlzzsyyqakwwdewgzkj:[encoded-password]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
```

**`.env.local`** — used by the Next.js app at runtime:
```env
DATABASE_URL="postgresql://postgres.vwlzzsyyqakwwdewgzkj:[encoded-password]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
AUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

> ⚠️ **Password encoding:** Supabase passwords often contain special characters. Encode them before putting them in the URL:
> - `$` → `%24`
> - `#` → `%23`
> - `[` → `%5B`
> - `]` → `%5D`
>
> Example: password `$my#pass` becomes `%24my%23pass` in the URL.

### 3. Push the schema

```bash
npm run db:push
```

> **Why `db:push` and not `db:migrate`?**  
> `prisma migrate dev` requires a direct database connection (port 5432 on the Supabase db host). Supabase free tier blocks direct connections — only the session pooler is reachable. `prisma db push` uses the pooler URL and works fine for development.

### 4. Start the server
```bash
npm run dev
```

---

## Day-to-Day Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start dev server at localhost:3000 |
| `npm run build` | Production build |
| `npx tsc --noEmit` | TypeScript type check |
| `npm run db:push` | Push schema changes to database |
| `npm run db:generate` | Regenerate Prisma client after schema edit |
| `npm run db:studio` | Open Prisma Studio (database browser) at localhost:5555 |

---

## Key Directories

| Directory | Purpose |
|---|---|
| `src/app/` | All pages and API routes (Next.js App Router) |
| `src/app/(auth)/` | Login + signup pages |
| `src/app/(seller)/` | Protected seller pages: dashboard, products, onboarding |
| `src/app/(buyer)/` | Protected buyer pages: order history |
| `src/app/store/[slug]/` | Public storefront — server-side rendered for SEO |
| `src/app/api/` | API route handlers |
| `src/components/ui/` | Low-level UI components (Button, Card, Input, etc.) |
| `src/components/` | Feature components (ProductCard, CartDrawer, ProductActions) |
| `src/lib/` | Shared utilities: Prisma client, auth, commission logic, cart store |
| `src/middleware.ts` | Route protection + role-based redirects |
| `prisma/` | Database schema |
| `reports/` | Project documentation |

---

## User Flows

### Seller — Getting started
1. Go to `/signup` → choose **Seller / Creator** → create account
2. `/onboarding` → pick a plan (Free or Creator — billing is not active yet, plan is just recorded)
3. Set store name, URL slug, and bio → **Launch storefront**
4. `/products/new` → add products (name, price, description, image URL, category)
5. Share `/store/[your-slug]` with buyers

### Buyer — Browsing
1. Go to `/signup` → choose **Buyer** → create account
2. Browse any `/store/[slug]` → click **Add** on products
3. Open the cart drawer (top-right shopping bag icon) → items are saved in browser
4. **Checkout** shows a "coming soon" message — payments are not yet active

---

## Adding New Features

### Add a page
Create a file in `src/app/`. Route groups automatically apply protection:
- `src/app/(seller)/new-page/page.tsx` → SELLER only (middleware enforces)
- `src/app/(buyer)/new-page/page.tsx` → logged-in users only
- `src/app/new-page/page.tsx` → public

### Add an API route
Create `src/app/api/[name]/route.ts`. Export named functions `GET`, `POST`, `PATCH`, `DELETE`.

Always check auth at the top:
```ts
const session = await auth();
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

### Change the database schema
1. Edit `prisma/schema.prisma`
2. Run `npm run db:push` to apply changes to Supabase
3. Run `npm run db:generate` if the Prisma client doesn't update automatically

### Add a UI component
Add to `src/components/ui/` following the existing pattern — use `cn()` from `src/lib/utils.ts` for className merging.

---

## Environment Variables Reference

| Variable | File | Required now | Description |
|---|---|---|---|
| `DATABASE_URL` | `.env` + `.env.local` | ✅ Yes | Supabase session pooler connection string |
| `AUTH_SECRET` | `.env.local` | ✅ Yes | Random secret for NextAuth JWT signing |
| `NEXTAUTH_URL` | `.env.local` | ✅ Yes | App base URL |
| `NEXT_PUBLIC_APP_URL` | `.env.local` | ✅ Yes | Used in redirects |
| `STRIPE_SECRET_KEY` | `.env.local` | ⏳ Later | Needed when payments are re-enabled |
| `STRIPE_PUBLISHABLE_KEY` | `.env.local` | ⏳ Later | Needed when payments are re-enabled |
| `STRIPE_WEBHOOK_SECRET` | `.env.local` | ⏳ Later | Needed when payments are re-enabled |
| `STRIPE_CREATOR_PRICE_ID` | `.env.local` | ⏳ Later | Stripe price ID for Creator plan |
| `STRIPE_PRO_PRICE_ID` | `.env.local` | ⏳ Later | Stripe price ID for Pro plan |

---

## Re-enabling Payments (Future)

When ready to activate Stripe:

1. Create products/prices in [Stripe Dashboard](https://dashboard.stripe.com/test/products) (€19/mo Creator, €49/mo Pro)
2. Fill in all `STRIPE_*` vars in `.env.local`
3. Replace the 3 stubbed routes with their full implementations:
   - `src/app/api/checkout/route.ts`
   - `src/app/api/subscriptions/route.ts`
   - `src/app/api/webhooks/stripe/route.ts`
4. Restore `src/lib/stripe.ts` to initialise the Stripe client
5. Update `CartDrawer.tsx` to call `/api/checkout` properly
6. Update `onboarding/page.tsx` to redirect to Stripe billing for paid plans
7. Run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` in a separate terminal

---

## Deployment (Vercel)

1. Push repo to GitHub
2. Import at [vercel.com](https://vercel.com)
3. Add env vars from `.env.local` in the Vercel dashboard
4. Set `NEXTAUTH_URL` to your production domain
5. Run schema push for production: `npx prisma db push` (pointing at the prod database)

---

## Git Conventions

```bash
# New feature
git checkout -b feat/discount-codes

# Bug fix
git checkout -b fix/product-limit-check

# Commit messages
git commit -m "feat: add discount code redemption"
git commit -m "fix: correct commission calculation on Creator plan"
```

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `P1001: Can't reach database` | Supabase direct connection blocked | Make sure you're using the **session pooler** URL (pooler.supabase.com), not the direct db URL |
| `P1012: DATABASE_URL not found` | Prisma reads `.env`, not `.env.local` | Put `DATABASE_URL` in both `.env` (for Prisma CLI) and `.env.local` (for the app) |
| `P1001` after correct URL | Password has special chars (`$`, `#`, `[`, `]`) | Percent-encode them: `$`→`%24`, `#`→`%23`, `[`→`%5B`, `]`→`%5D` |
| Auth redirecting every page | `AUTH_SECRET` missing or wrong | Check `.env.local` — must be same value every restart |
| TypeScript errors after schema change | Prisma client stale | Run `npm run db:generate` |
| Port 3000 in use | Another process running | `npm run dev -- -p 3001` |
| Prisma Studio won't connect | Same pooler issue | `npm run db:studio` uses `DATABASE_URL` — same pooler URL works |
