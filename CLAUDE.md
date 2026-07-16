# CLAUDE.md — Barks-A-Lot Project Instructions

## Project Context

Barks-A-Lot Treats & More sells handmade organic dog treats and handmade dog
bandanas. Sales happen two ways: **in-person** (farmer's markets, pet expos,
seasonal events) and **online** (this app, including customer checkout).
This dual-channel model should shape data models and UX decisions throughout
— see "Business-Model-Specific Guidance" below.

**Stack:** Next.js (App Router), React (JSX), Prisma ORM, SQLite, Docker.

Scale note: this is a sole-proprietor business. Favor simple, maintainable
solutions over enterprise-grade complexity. SQLite is fine at this scale;
just build the Prisma layer so migrating to Postgres later is a config
change, not a rewrite.

---

## 1. Security Priorities (non-negotiable)

This app has two distinct trust levels — **customer accounts** (checkout,
order history) and **any admin/owner accounts** (managing products,
inventory, orders). Treat these as fully separate concerns, never share
session logic or middleware between them.

### Authentication & sessions
- Use a vetted auth library (Auth.js/NextAuth, or Lucia) — never hand-roll
  password hashing, token signing, or session storage.
- Passwords hashed with **bcrypt or argon2** only. Never store or log plaintext.
- Sessions via **httpOnly, secure, sameSite=lax (or strict) cookies**. No
  tokens in localStorage — that's XSS-exposed.
- Short session lifetimes for admin accounts; longer is acceptable for
  customer "remember me" if refresh tokens are rotated properly.
- CSRF protection on all state-changing routes (form submissions, checkout,
  admin actions).
- Rate-limit login, signup, and checkout endpoints (e.g. 5 attempts/min per
  IP+account) to blunt credential stuffing and card-testing bots.
- Route protection via middleware, not just UI hiding — every admin API
  route re-checks role server-side, never trusts a client-supplied role.

### Input & data handling
- Validate and sanitize **all** input server-side with a schema library
  (zod recommended), even if the client already validated it.
- Parameterized queries only — Prisma handles this by default, but never
  drop into raw SQL string concatenation (`$queryRawUnsafe` is a red flag).
- Sanitize any user-generated content (e.g. review text) before rendering
  to prevent stored XSS.

### Payments
- Never store raw card numbers, CVVs, or full PANs in this app's database.
  Use a PCI-compliant processor (Stripe, etc.) and store only tokens/IDs.
- Checkout endpoints should re-verify price and inventory server-side —
  never trust a price or quantity sent from the client.

### General hygiene
- All secrets (DB path if sensitive, API keys, session secrets) in
  environment variables, never committed. Maintain a `.env.example` with
  placeholder values.
- Enforce HTTPS in production; set HSTS headers.
- Log authentication events (login, failed login, password reset) without
  logging sensitive payloads.
- Run `npm audit` (or equivalent) as part of the update routine below —
  don't let known-vulnerable dependencies linger.

### Security review workflow
- Run `/security-review` in the terminal before committing or merging any
  change that touches auth, sessions, checkout, payments, or account
  creation. This checks for SQL injection, XSS, auth flaws, insecure data
  handling, and known-vulnerable dependencies.
- Review each finding's explanation, then ask Claude to implement the fix
  directly rather than patching manually.
- Treat this as a required step in the workflow, not an occasional audit —
  run it every time before merging security-sensitive changes.

---

## 2. Docker

Keep Docker artifacts in lockstep with app changes — a stale Dockerfile is
a common source of "works on my machine" bugs.

- **Multi-stage build**: separate `deps`, `builder`, and `runner` stages so
  the final image doesn't ship dev dependencies or source maps.
- **Pin versions**: use a specific Node base image tag (e.g.
  `node:22-alpine`), never `latest`.
- **Run as non-root** user inside the container.
- **Layer caching**: copy `package.json` + lockfile and run install *before*
  copying the rest of the app, so dependency layers don't rebuild on every
  code change.
- **`.dockerignore`**: exclude `node_modules`, `.env`, `.git`, `*.db` dev
  artifacts, and build output.
- **SQLite persistence**: mount the SQLite file via a named volume in
  `docker-compose.yml` — never let the DB live only inside an ephemeral
  container layer, or data vanishes on rebuild.
- **Whenever `package.json`, `prisma/schema.prisma`, or env vars change**,
  update the Dockerfile/compose file in the same commit: rerun
  `npx prisma generate` in the build stage, update `.env.example`, and bump
  any exposed ports/healthchecks as needed.
- Add a basic healthcheck in `docker-compose.yml` so orchestration knows
  when the app is actually ready, not just started.

---

## 3. Next.js / React Conventions

- Functional components with hooks only — no class components.
- Default to **Server Components**; add `'use client'` only where
  interactivity is required (forms, cart state, checkout flow).
- One component, one responsibility. Split data-fetching (server) from
  presentation (client) — don't fetch inside deeply nested UI components.
- Prefer TypeScript-flavored JSDoc or `.tsx` for prop typing if the project
  allows TS; otherwise document prop shapes with PropTypes or comments.
- Co-locate related files: `components/ProductCard/ProductCard.jsx` +
  styles, rather than scattering by type.
- Use CSS Modules or Tailwind — avoid inline style objects for anything
  reused.
- Accessibility basics matter for a storefront: alt text on all product
  images (treats, bandanas), labeled form fields, visible focus states on
  interactive elements.
- Keep client bundles lean — no heavy libraries imported into `'use client'`
  components that only need to run on the server.

---

## 4. Prisma + SQLite

- Model core entities clearly, e.g.:
  `Product`, `ProductVariant`, `Order`, `OrderItem`, `Customer`, `Event`
  (for markets/expos), with explicit relations rather than loose foreign
  keys in app code.
- **Never edit the SQLite file directly.** All schema changes go through
  `npx prisma migrate dev` (local) and `prisma migrate deploy` (production/
  container startup) so history stays in version control.
- Use a **Prisma Client singleton** pattern in Next.js (cache the client on
  `globalThis` in dev) to avoid exhausting connections during hot reload.
- Wrap multi-step writes in `prisma.$transaction(...)` — e.g. creating an
  order and decrementing inventory must succeed or fail together, never
  partially.
- Maintain a `seed.ts`/`seed.js` script for the current treat/bandana
  catalog so dev environments start with realistic data.
- Keep the SQLite file path configurable via env var so it's easy to swap
  in a Postgres connection string later without touching application code.

---

## 5. Business-Model-Specific Guidance

- **Channel field**: give orders/inventory transactions a `channel`
  ("online" | "market") so in-person sales recorded after the fact and
  online checkout orders share one inventory ledger without conflating
  fulfillment types.
- **Order fulfillment type**: distinguish "ship to customer" vs "pickup at
  market/event" — these need different confirmation copy and no shipping
  address requirement for pickup orders.
- **Limited/seasonal drops**: for things like the Father's Day plushie
  "adoptions," model a `limitedQuantity` + `availableFrom/Until` on the
  product so the UI can show real-time remaining stock and auto-hide
  sold-out items — avoid overselling a one-off batch.
- **Product variants**: treats need flavor/size/dietary-tag fields
  (e.g. grain-free); bandanas need size/pattern. Model variants so cart and
  inventory logic doesn't hardcode "treats" vs "bandanas" as special cases.
- **Multi-person access**: since your partner co-manages the business,
  build in a basic admin role (not just a single hardcoded owner login) so
  you can both manage products/orders without sharing one login — this
  also keeps the security separation in Section 1 meaningful.
- **Keep infra proportional to the business**: resist adding infrastructure
  (queues, microservices, caching layers) this scale doesn't need yet. Note
  where you'd extend later (e.g. "swap SQLite for Postgres if concurrent
  order volume grows") rather than building for that scale now.

---

## 6. Code Quality Baseline

- ESLint + Prettier configured and enforced (pre-commit hook recommended).
- Small, composable functions; comments explain *why*, not *what*.
- User-facing error messages stay friendly and generic; detailed errors go
  to server logs only, never to the client response.
- At minimum, add tests around checkout (order creation, inventory
  decrement) and auth (login, protected route access) — these are the two
  areas where a silent bug costs real money or exposes customer data.