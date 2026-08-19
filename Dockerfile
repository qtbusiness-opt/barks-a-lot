FROM node:20-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
# Store timezone, for anything that reads the process's local clock.
# Date logic that must be correct regardless (src/lib/pickup-window.js)
# computes it explicitly instead of relying on this — this is defense in
# depth, not the only thing making that logic correct.
ENV TZ="America/Boise"

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Dev target: runs next dev with hot reload ---
FROM base AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["sh", "-c", "npx prisma generate && node node_modules/prisma/build/index.js migrate deploy && node scripts/start-dev.js"]

# --- Production build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma generate and next build never connect to the database, but a
# well-formed URL keeps anything that parses it at build time happy.
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DATABASE_URL=${DATABASE_URL}
# Browser-side config (Maps key, Square app/location ids) is served at
# RUNTIME via /api/config — set them as env vars on the deployment, not
# here. Deliberately NO NEXT_PUBLIC_* ARG/ENV in this stage: defining
# them during `next build` (even empty) makes the compiler inline the
# build-time value into the bundles, permanently freezing runtime reads.
# The SQUARE_ACCESS_TOKEN secret stays runtime-only and is never baked
# in.
RUN npx prisma generate
RUN npm run build

# --- Production target ---
FROM base AS runner
WORKDIR /app

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/scripts ./scripts

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# DATABASE_URL has no default: it must point at your Postgres instance
# (compose provides it; on Cloud Run set it on the service). The app
# exits at boot with a clear error when it's missing.
ENV JWT_SECRET="change-this-in-production"

CMD ["node", "scripts/start.js"]
