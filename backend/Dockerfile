# Youngness CMS — backend API
FROM node:20-alpine
WORKDIR /app

# Install production deps first (better layer caching).
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 4000

# Basic container healthcheck hitting the readiness endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-4000}/health/ready || exit 1

CMD ["node", "server.js"]
