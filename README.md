# Barks-A-Lot Treats & More

E-commerce storefront and admin for Barks-A-Lot: Next.js (App Router, JSX),
Prisma + Postgres, Auth.js, Tailwind, Docker.

## Quick start

```bash
# 1. Create your .env (see "API keys" below)
# 2. Start the dev stack (hot reload, seeded catalog + admin account)
docker compose -f docker-compose.dev.yml up --build
```

- Storefront: http://localhost:3000
- Admin login: `admin@barks-a-lot.com` / `admin123` (dev defaults —
  override with `ADMIN_EMAIL` / `ADMIN_PASSWORD`; admin passwords need
  8+ characters with a letter and a number)
- Qual runs on port 3001 (`docker-compose.qual.yml`), prod on 3002
  (`docker-compose.prod.yml`)

## API keys

Create a `.env` file next to the compose files (it's gitignored; compose
reads it automatically) with:

```bash
# Google Maps — event address autofill + embedded maps.
# Browser-exposed by design: restrict it by HTTP referrer in Google Cloud
# Console (Maps Embed API + Places API enabled).
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your-maps-key"

# Resend — verification, order confirmation, and status-update emails.
RESEND_API_KEY="re_..."
# Until your domain is verified in Resend, their sandbox sender is the
# only allowed from-address and delivery is limited to your own account
# email. After verifying barks-a-lot.com in Resend, switch to e.g.
# "Barks-A-Lot <orders@barks-a-lot.com>".
EMAIL_FROM="Barks-A-Lot <onboarding@resend.dev>"

# Absolute base URL used inside emailed links (verification etc.)
APP_URL="http://localhost:3000"
```

Without these keys everything still runs: the location field is a plain
input, maps render as open-in-Google-Maps links, and outgoing email is
logged to the server console instead.

Note for qual/prod: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is baked into the
client bundle at image build time, so rebuild (`--build`) after changing it.

## Everyday commands

```bash
npm test          # integration + unit tests (boots a real server)
npm run lint      # eslint
npm run format    # prettier
npx prisma migrate dev --name <change>   # after editing schema.prisma
```
