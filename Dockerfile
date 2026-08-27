# syntax=docker/dockerfile:1

# ---- deps: install all dependencies (needed for build tools like tailwind/postcss) ----
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---- builder: build the Next.js app ----
# .env must be present in the build context — NEXT_PUBLIC_* vars are inlined
# at build time (see docs/DEPLOYMENT_VPS.md).
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- prod-deps: production-only node_modules for the runtime image ----
FROM node:20-alpine AS prod-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ---- runner: minimal runtime image ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_PORT=8004

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 8004

CMD ["node", "server.js"]
