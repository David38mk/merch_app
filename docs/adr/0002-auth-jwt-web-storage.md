# 2. Auth: JWT in web storage, Google via ID token, email as a seam

- **Status:** Accepted
- **Date:** 2026-07-02

## Context

The seller auth system needs: email/password signup + login, Google sign-in,
forgot/reset password, optional email verification, logout, and "remember me".
The frontend is a pure SPA (no server-rendered pages), the backend a stateless
FastAPI service. Email delivery and Google are external dependencies.

## Decision

- **Access tokens are JWTs, stored in web storage by the SPA.** "Remember me" →
  `localStorage` (survives restarts, 30-day token); unchecked → `sessionStorage`
  (cleared with the tab, 1-day token). The `Authorization: Bearer` header is
  attached by an axios interceptor.
- **No refresh tokens.** A single access token with a longer lifetime covers
  "stay logged in". Logout just clears storage.
- **Every JWT carries a `type` claim** (`access` / `reset` / `verify`) so a
  reset link can't be replayed as a login token.
- **Google sign-in uses Google Identity Services on the client + server-side
  ID-token verification** (`google-auth`). No OAuth authorization-code flow, no
  client secret. Gated on `GOOGLE_CLIENT_ID`; empty = the button is disabled.
- **Email is a seam.** Forgot-password / verification "emails" are logged; in
  `DEBUG` the link is returned in the API response so the flow is testable
  without a provider. Email verification is built but **off by default**.

## Consequences

- Simple and stateless — no session store, works with the SPA + proxy setup.
- **Trade-off (the reason for this ADR):** tokens in `localStorage` are readable
  by JavaScript, so a successful XSS can steal them. We accept this for the MVP;
  the mitigation path is httpOnly, SameSite cookies + CSRF protection, which we
  can adopt later without changing the endpoints (only where the token lives).
- No refresh tokens means no server-side revocation before expiry — a stolen
  token is valid until it expires. Acceptable at MVP scale; revisit with refresh
  tokens + rotation if needed.
- Google ID-token verification is the lightest integration; if we later need
  Google *API* access (Drive, contacts, …) we'd switch to the code flow.

## Alternatives considered

- **httpOnly cookie sessions** — safer against XSS token theft, but adds CSRF
  handling and doesn't fit the "stateless bearer token to a proxied API" shape as
  cleanly. Deferred, not rejected forever.
- **Refresh + short access token rotation** — better revocation story, more
  moving parts than an MVP needs.
- **Full Google OAuth code flow** — needed only if we call Google APIs; overkill
  for "sign in with Google".
