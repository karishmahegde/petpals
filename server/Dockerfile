# The API image — used by docker-compose locally and by Railway in production.
# Configuration comes from the environment at run time (server/.env via
# compose's env_file, Railway's variables); nothing secret is baked in.

# ── Build stage ───────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Production dependencies only. The Prisma CLI is one of them: Railway's
# pre-deploy command runs `npx prisma migrate deploy` in this image.
COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma.config.ts swagger.js ./
COPY src ./src

# prisma.config.ts reads DATABASE_URL, but generating the client never
# connects — a placeholder is enough at build time.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate

# ── Runtime stage ─────────────────────────────────────────────
FROM node:22-alpine

# Prisma's schema engine (migrate deploy) needs OpenSSL.
RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json /app/prisma.config.ts /app/swagger.js ./
COPY --from=builder --chown=node:node /app/src ./src

USER node

EXPOSE 5000

CMD ["node", "src/index.js"]
