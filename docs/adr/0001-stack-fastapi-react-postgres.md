# 1. Rebuild on FastAPI + React (Vite) + Postgres, split monorepo

- **Status:** Accepted
- **Date:** 2026-07-02

## Context

An initial MVP existed on **Next.js 15 (App Router) + Prisma + NextAuth + Supabase**
(now in `legacy/`). The owner was unhappy with that stack and wanted a Python
backend with a React frontend, in **separate directory trees** so the two can be
split (or deployed independently) later. This coincided with a scope reset
([MVP-SCOPE.md](../../MVP-SCOPE.md)) that made the app much larger (four roles,
print-on-demand, hiring/bidding, collaboration), so a rebuild — rather than an
incremental migration — was the natural moment.

## Decision

Rebuild as a monorepo with two independent trees:

- **`backend/`** — **FastAPI** + **SQLAlchemy 2** + **Alembic** + Pydantic. JWT auth.
- **`frontend/`** — **Vite + React + TypeScript** SPA (React Router, TanStack Query, axios), talking to the API via a dev proxy.
- **Database** — **PostgreSQL** via **Docker Compose** for local dev (production parity).

The old Next.js build is archived under `legacy/` as a reference, not deleted.

## Consequences

- Clear front/back separation; each side can be deployed/scaled/split on its own.
- Backend is API-first with auto OpenAPI docs at `/docs`; the React SPA is a pure client.
- **Public storefront SEO is deferred** — an SPA is not server-rendered. Revisit with prerendering/SSR (or a thin SSR layer) before public launch. This is the main accepted downside.
- We own auth and (future) admin ourselves — FastAPI has no built-in admin (unlike Django). The deferred Admin role is fine with DB tools for now.
- Data model is expressed ORM-agnostically in [DATA-MODEL.md](../../DATA-MODEL.md) and mirrored in SQLAlchemy models.

## Alternatives considered

- **Django + DRF** — batteries included, migrations built in, and a **free admin panel** (would have covered the deferred Admin role). Rejected for MVP: heavier/more opinionated, less async-native, and we wanted an explicit API-first split with a React SPA. Reconsider if the admin surface becomes urgent.
- **Flask + SQLAlchemy** — lighter than both, but the most manual wiring for an app this size.
- **Keep Next.js (frontend only), Python API behind it** — keeps SSR/SEO, but blurs the split and stays close to the stack the owner moved away from.
- **SQLite for dev** — zero setup, but type/enum drift from Postgres; chose Docker Postgres for parity.
