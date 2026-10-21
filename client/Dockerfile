# The client image for docker-compose (production is Vercel, which builds
# from source). Vite bakes VITE_* into the bundle at build time, so they're
# build args, not run-time environment.

# ── Build stage ───────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Cypress is a dev dependency; its ~500 MB test browser isn't needed to build.
ENV CYPRESS_INSTALL_BINARY=0

COPY package*.json ./
RUN npm ci

# Defaults match compose: REST through nginx's /api proxy (like Vercel's
# rewrite), the notification stream straight to the API (like Railway).
ARG VITE_API_URL=/api/v1
ARG VITE_STREAM_URL=http://localhost:5000/api/v1
ENV VITE_API_URL=$VITE_API_URL VITE_STREAM_URL=$VITE_STREAM_URL

COPY . .
RUN npm run build

# ── Runtime stage (serve with nginx) ─────────────────────────
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
