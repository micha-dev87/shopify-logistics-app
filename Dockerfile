# Dockerfile for Shopify Logistics App (Remix)
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (use install instead of ci since no lock file)
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy source files
COPY . .

# Build the app
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 remixuser

# Copy built files and dependencies
COPY --from=builder --chown=remixuser:nodejs /app/build ./build
COPY --from=builder --chown=remixuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=remixuser:nodejs /app/package.json ./package.json
COPY --from=builder --chown=remixuser:nodejs /app/prisma ./prisma

USER remixuser

EXPOSE 3000

# Start the app (setup runs prisma migrate)
CMD ["npm", "run", "docker-start"]
