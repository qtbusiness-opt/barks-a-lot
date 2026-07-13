FROM node:20-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

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
ARG DATABASE_URL="file:/app/data/app.db"
ENV DATABASE_URL=${DATABASE_URL}
# NEXT_PUBLIC_* values are inlined into the client bundle at build time,
# so the Maps key must be present here — runtime env is too late for
# production builds. It's a browser-exposed key by design; restrict it by
# HTTP referrer in Google Cloud rather than treating it as a secret.
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
# Square app + location ids are also browser-side (inlined at build);
# the SQUARE_ACCESS_TOKEN secret stays runtime-only and is never baked in.
ARG NEXT_PUBLIC_SQUARE_APP_ID=""
ENV NEXT_PUBLIC_SQUARE_APP_ID=${NEXT_PUBLIC_SQUARE_APP_ID}
ARG NEXT_PUBLIC_SQUARE_LOCATION_ID=""
ENV NEXT_PUBLIC_SQUARE_LOCATION_ID=${NEXT_PUBLIC_SQUARE_LOCATION_ID}
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

RUN mkdir -p /app/data && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/data/app.db"
ENV JWT_SECRET="change-this-in-production"

CMD ["node", "scripts/start.js"]
