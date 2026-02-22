# ── Leeway File Gateway Dockerfile ────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --production

COPY backend/dist ./dist

# Gateway aliases — real drives mounted via docker-compose volumes
# Adjust DRIVE_ROOTS env var or volume mounts in docker-compose.yml
ENV PORT=8101
ENV DRIVE_ROOT_L=/drives/L
ENV DRIVE_ROOT_LEE=/drives/LEE
ENV NODE_ENV=production
EXPOSE 8101

HEALTHCHECK --interval=15s --timeout=5s \
  CMD wget -qO- http://localhost:8101/health || exit 1

# In production, you'd have a dedicated gateway server.
# For now backend handles /api/fs; this image is a placeholder.
CMD ["node", "dist/index.js"]
