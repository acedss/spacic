FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
# npm ci enforces the lockfile — fails if package-lock.json is out of sync.
# --omit=dev mirrors the former --production flag but is the current npm convention.
RUN npm ci --omit=dev
COPY --chown=node:node . .
EXPOSE 4000
USER node
# Poll /health every 30 s; allow 15 s start-up grace before the first check.
# Returns 503 if MongoDB or Redis is unreachable — signals a degraded container.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:4000/health | grep -q '"status":"ok"' || exit 1
CMD ["node", "src/index.js"]
