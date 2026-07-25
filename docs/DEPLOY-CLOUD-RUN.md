# Deploying to Google Cloud Run

This guide exists because of a real failed deploy that ended with:

> The user-provided container failed to start and listen on the port
> defined provided by the PORT=8080 environment variable within the
> allocated timeout.

The app itself is verified to boot correctly under Cloud Run's contract:
the production image (Dockerfile `runner` stage) was booted locally with
only the image's default env plus `PORT=8080`, and it ran migrations,
seeded, and answered `/api/health` on port 8080 in ~9 seconds, peaking at
~131 MiB of memory. So when this error appears, the cause is in the
service or build configuration, not the code. Work through the checklist
below.

## First: read the real error

The message above is generic. The actual failure reason is in the logs:

Cloud Run → your service → **Logs** tab (or Cloud Logging). Look at the
first lines from the crashed revision. What you find decides the fix:

| Log says                                                        | Cause                                             | Fix                                                                                                  |
| --------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `exec format error`                                             | Image built on an Apple Silicon Mac (ARM)         | Build with `docker build --platform linux/amd64 …` or let Cloud Build do it (`gcloud builds submit`) |
| `DATABASE_URL is not set` / `P1001 Can't reach database server` | Postgres connection not configured or unreachable | See "Database" below                                                                                 |
| `Memory limit … exceeded`                                       | Instance too small                                | Boot peaks ~131 MiB, so the 512 MiB default is fine — only raise if you see this line                |
| Nothing at all / `npm` lines then exit                          | Wrong build type or start command                 | See "Build type" below                                                                               |

## Build type: use the Dockerfile

When setting up "Continuously deploy from a repository" (or a Cloud Build
trigger), Google preselects **Buildpacks**. Choose
**Dockerfile** instead — the repo's multi-stage Dockerfile produces the
intended production image (its final `runner` stage runs
`node scripts/start.js`: migrations → seed → standalone server).

As a safety net, `npm start` now runs that same script, so even a
Buildpacks build boots the right way. But the Dockerfile build is smaller,
pinned, and runs as a non-root user — prefer it.

Also make sure the trigger deploys the branch you actually mean to ship
(`main`).

## Port: nothing to configure

Cloud Run injects `PORT=8080` at runtime and it overrides the image's
`ENV PORT=3000` default. The standalone server reads `process.env.PORT`,
so it binds 8080 automatically. Leave the service's container port at 8080. Do not set `PORT` yourself (Cloud Run reserves it).

## Environment variables

Set these on the Cloud Run service (Variables & Secrets tab). Use Secret
Manager for the secrets.

Required for a working store:

- `AUTH_SECRET` — long random string (`openssl rand -base64 32`). The
  image ships a placeholder `JWT_SECRET` fallback; **never** go live on it.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — first-boot admin account seed.
- `APP_URL` — the public URL (used in emails/links).
- `RESEND_API_KEY` / `EMAIL_FROM` — order + verification email.
- `SQUARE_ACCESS_TOKEN` / `SQUARE_ENV` — payments (`production` when live).
- `TZ` — e.g. `America/Boise` (pickup cutoff math).

The browser-side values — `NEXT_PUBLIC_SQUARE_APP_ID`,
`NEXT_PUBLIC_SQUARE_LOCATION_ID`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — are
served to the browser at **runtime** via `/api/config`, so set them as
normal service env vars like everything above; no rebuild needed when
they change. (They also work as Docker build args for static inlining,
but that's optional.)

## Database: hosted Postgres required

The app uses Postgres (uploads included — the container needs no
persistent disk, which is exactly what Cloud Run requires). **You must
set `DATABASE_URL`** on the service to a hosted Postgres connection
string; the container exits at boot with a clear log line when it's
missing. Migrations run automatically at startup.

Good options:

- **Neon** (neon.tech) — serverless Postgres with a free tier that fits
  this store comfortably; scales to zero like Cloud Run does. Copy the
  pooled connection string into `DATABASE_URL` (as a Secret Manager
  secret).
- **Cloud SQL for Postgres** — Google's managed option, from roughly
  $10/month; connect via the Cloud SQL connector or its public IP.
- **Supabase** — also fine; use the connection-pooler string.

Local dev doesn't need any of this: `docker compose up` now bundles a
`postgres:16` service with a persistent named volume.

One note on scaling: sessions are stateless (JWT cookies) and the data
now lives in Postgres, so multiple instances are safe. The login rate
limiter is per-instance memory, so leaving **max instances = 1** keeps
it strict (and is plenty of capacity for this store); raising it only
loosens rate limiting, nothing else.

## Gating a staging/dev site (Basic Auth)

To keep a dev deployment (e.g. dev.barks-a-lot.com) private without GCP
accounts: leave the Cloud Run service public (Ingress "All",
"Allow unauthenticated") and set **both** of these env vars on the dev
service:

- `BASIC_AUTH_USER`
- `BASIC_AUTH_PASSWORD` (use a Secret Manager secret)

Every page then prompts a standard browser login popup; share the
credentials with whoever needs access. `/api/health` stays open so
health probes keep passing. **Do not set these on the production
service** — leaving them unset turns the gate off, keeping the store
public.

## Known-good manual deploy

```sh
gcloud builds submit --tag gcr.io/PROJECT_ID/barks-a-lot .
gcloud run deploy barks-a-lot \
  --image gcr.io/PROJECT_ID/barks-a-lot \
  --region us-west1 \
  --max-instances 1 \
  --set-env-vars TZ=America/Boise,SQUARE_ENV=sandbox,APP_URL=https://your-url \
  --set-secrets DATABASE_URL=database-url:latest,AUTH_SECRET=auth-secret:latest,ADMIN_PASSWORD=admin-password:latest \
  --allow-unauthenticated
```

(Defaults are fine for memory/CPU; add the rest of the env vars as you
enable email and payments.)
