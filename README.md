# MyHappinessClub

Creator print-on-demand marketplace. Four roles (Buyer, Seller, Designer, PrintShop),
a design tool, designer hiring by bidding, and print-shop fulfillment.

This repo is the **walking-skeleton rebuild**: real data model + every role's core
views, built with only free tooling, with paid capabilities left as clearly-marked
**seams** (see `backend/app/seams/`).

## Project docs

| File | What |
|---|---|
| [MVP-SCOPE.md](MVP-SCOPE.md) | What's in / stubbed (seam) / deferred |
| [CONTEXT.md](CONTEXT.md) | Domain glossary (ubiquitous language) |
| [DATA-MODEL.md](DATA-MODEL.md) | ER diagram + table specs (source of truth for the schema) |
| [docs/adr/](docs/adr/) | Architecture decisions (0001 = the stack) |
| [legacy/](legacy/) | The old Next.js MVP, kept for reference only |

## Stack

- **backend/** — FastAPI + SQLAlchemy 2 + Alembic (JWT auth). Docs at `/docs`.
- **frontend/** — Vite + React + TypeScript SPA (React Router, TanStack Query).
- **db** — PostgreSQL via Docker Compose.

## Run it (three terminals)

> **Windows PowerShell note:** PowerShell 5.1 has no `&&`. Run each line separately.
> If `Activate.ps1` is blocked, first run `Set-ExecutionPolicy -Scope Process -Bypass -Force`
> (session-only), or just prefix tools with `.\.venv\Scripts\` instead of activating.

### 1. Database
```
docker compose up -d --wait          # Postgres on :5432, waits until healthy
```

### 2. Backend  →  http://localhost:8001  (docs at /docs)

> Port 8001 (not 8000) — 8000 is used by the legalgpt project on this machine.

**Windows (PowerShell):**
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
alembic revision --autogenerate -m "initial schema"   # first time only
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 8001
```

**macOS / Linux (bash):**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic revision --autogenerate -m "initial schema" && alembic upgrade head && python -m app.seed
uvicorn app.main:app --reload --port 8001
```

### 3. Frontend  →  http://localhost:5173
```
cd frontend
npm install
npm run dev
```

Sign up (pick extra roles), log in, hit the dashboard. `/api/*` is proxied to the backend.

## Authentication

Full seller auth: signup (first/last/email/password + confirm, validated), login with
**remember-me**, **Google sign-in**, **forgot/reset password**, **email verification**
(built, off by default), logout. Signup grants Buyer+Seller and redirects to
`/onboarding`; login goes to `/dashboard`. Details in
[docs/adr/0002](docs/adr/0002-auth-jwt-web-storage.md).

- **Enable Google:** paste your Google OAuth *Web* Client ID into `backend/.env` as
  `GOOGLE_CLIENT_ID=...`. Empty = the button stays disabled.
- **Require email verification:** set `EMAIL_VERIFICATION_ENABLED=true` in `backend/.env`.
- **Email is stubbed:** reset/verify links are printed to the backend console and (in
  `DEBUG`) shown on-screen, so the flows are testable without an email provider.

## Day-to-day

| Command | Where | What |
|---|---|---|
| `docker compose up -d` / `down` | root | start / stop Postgres |
| `alembic revision --autogenerate -m "msg"` | backend | create a migration after editing models |
| `alembic upgrade head` | backend | apply migrations |
| `uvicorn app.main:app --reload --port 8001` | backend | run API |
| `npm run dev` | frontend | run SPA |
| `npm run build` | frontend | typecheck + production build |

## Layout
```
backend/   FastAPI app (app/models, app/api/routers, app/seams), Alembic
frontend/  Vite React SPA (src/pages, src/api, src/auth.tsx)
legacy/    old Next.js build (reference)
docs/adr/  architecture decisions
```
