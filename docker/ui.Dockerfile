# ── Agent Lee UI Dockerfile ────────────────────────────────────────────────
# Multi-stage: build Vite app → serve with nginx
FROM node:20-alpine AS builder

WORKDIR /app
COPY agent-lee-studio/package*.json ./
RUN npm ci

COPY agent-lee-studio/ ./
RUN npm run build

# ── Nginx serving stage ────────────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# SPA routing — redirect all to index.html
RUN echo 'server { \
  listen 80; \
  root /usr/share/nginx/html; \
  index index.html; \
  location / { try_files $uri $uri/ /index.html; } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
