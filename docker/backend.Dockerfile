# ── Backend API Dockerfile ─────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
COPY backend/package*.json ./
RUN npm ci

COPY backend/ ./
RUN npm run build

# ── Runtime stage ──────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy built frontend
COPY .Agent_Lee_OS/dist ./.Agent_Lee_OS/dist

ENV PORT=8001
ENV NODE_ENV=production
EXPOSE 8001

HEALTHCHECK --interval=15s --timeout=5s \
  CMD wget -qO- http://localhost:8001/health || exit 1

CMD ["node", "dist/index.js"]
