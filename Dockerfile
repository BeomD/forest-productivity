# ─────────────────────────────────────────────────────────────────────
# Forest Focus — web deployment image
#
# Stage 1 builds the Expo Router static web bundle.
# Stage 2 serves the static files with nginx (listens on port 80).
# ─────────────────────────────────────────────────────────────────────

# ── Stage 1: build the static web bundle ─────────────────────────────
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install dependencies first so this layer is cached between source edits.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy the rest of the project and produce the static export in /app/dist.
COPY . .
ENV NODE_ENV=production \
    CI=1
RUN npx expo export --platform web

# ── Stage 2: serve with nginx ────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Routing / caching / compression rules.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static site produced by the builder stage.
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
