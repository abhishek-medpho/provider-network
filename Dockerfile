# syntax=docker/dockerfile:1.7

# ---------- deps ----------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

# ---------- build ----------
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client against the schema
RUN npx prisma generate
# Build Next.js (standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- runner ----------
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl tini
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# Full node_modules from builder — guarantees prisma + tsx + transitive deps
# work without cherry-picking. ~500MB extra but bulletproof.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Standalone server + static assets + schema
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
# Entrypoint invokes prisma + tsx via their JS entries, not via .bin/* shims —
# Docker dereferences symlinks, which breaks the prisma CLI's wasm lookup.

# Uploaded files (form attachments) — bind-mounted in compose
RUN mkdir -p /app/public/uploads && chown -R nextjs:nodejs /app/public/uploads

COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
