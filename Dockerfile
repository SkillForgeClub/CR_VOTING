# ============================================================
# VIIT CR ELECTIONS 2026 - PRODUCTION MULTI-STAGE DOCKERFILE
# ============================================================

# --- Stage 1: Build Frontend Assets ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies needed for Vite build)
RUN npm ci

# Copy source files
COPY . .

# Build production frontend bundle into /app/dist
RUN npm run build

# --- Stage 2: Production Runtime ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package manifests and install production-only dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server code and database adapters
COPY server ./server
COPY server.js ./server.js
COPY db ./db
COPY public ./public

# Copy compiled frontend from builder stage
COPY --from=builder /app/dist ./dist

# Create dedicated non-root user for security
RUN addgroup -S viit && adduser -S viit -G viit \
    && chown -R viit:viit /app

USER viit

EXPOSE 3000

# Start production server
CMD ["node", "server.js"]
