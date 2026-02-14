# Dockerfile pour Shopify Logistics App (Remix)
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 remixuser

# Copy built files
COPY --from=builder --chown=remixuser:nodejs /app/build ./build
COPY --from=builder --chown=remixuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=remixuser:nodejs /app/package.json ./
COPY --from=builder --chown=remixuser:nodejs /app/prisma ./prisma

# Create logs directory
RUN mkdir -p /app/logs && chown -R remixuser:nodejs /app/logs

USER remixuser

EXPOSE 3000

CMD ["npm", "run", "start"]
