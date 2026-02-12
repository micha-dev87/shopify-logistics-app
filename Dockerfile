# Dockerfile pour Shopify Logistics App (Remix)
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Build the app
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Remix app
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 remixuser

# Copy built files
COPY --from=builder --chown=remixuser:nodejs /app/build ./build
COPY --from=builder --chown=remixuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=remixuser:nodejs /app/package.json ./package.json
COPY --from=builder --chown=remixuser:nodejs /app/public ./public
COPY --from=builder --chown=remixuser:nodejs /app/prisma ./prisma

# Create logs directory
RUN mkdir -p /app/logs && chown -R remixuser:nodejs /app/logs

USER remixuser

EXPOSE 3000

CMD ["npm", "run", "start"]
