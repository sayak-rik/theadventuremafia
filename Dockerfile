# syntax=docker/dockerfile:1

# ---- Dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
# libc6-compat keeps some native deps (e.g. pg) happy on alpine.
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Migrator (one-shot job: applies db/migrations, then exits) ----
# Reuses the locked dependency tree from the deps stage (already built and
# cached for the app image), so it needs no extra install and adds nothing to
# the runner image. Run via the `migrate` service in docker-compose.yml.
FROM deps AS migrator
ENV NODE_ENV=production
COPY scripts/migrate.mjs ./scripts/migrate.mjs
COPY db/migrations ./db/migrations
USER node
CMD ["node", "scripts/migrate.mjs"]

# ---- Builder ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* is inlined at build time — bake the real public URL so canonical
# tags, OG images and JSON-LD point at the production domain (not localhost).
ARG NEXT_PUBLIC_SITE_URL=https://theadventuremafia.com
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build

# ---- Runner (production) ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Next.js "standalone" output ships a minimal node_modules + server.js.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Operator photos land here when Cloudflare R2 isn't configured. Mount a volume
# at this path (docker-compose.yml does) so uploads survive redeploys.
RUN mkdir -p /data/uploads && chown nextjs:nodejs /data/uploads
ENV UPLOAD_DIR=/data/uploads

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
