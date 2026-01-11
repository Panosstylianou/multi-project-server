# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install Docker CLI (needed for Docker socket communication)
RUN apk add --no-cache docker-cli

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy dashboard static files (v2 - trigger rebuild)
COPY dashboard/ ./dashboard/

# Create data directories
RUN mkdir -p /app/data /app/backups

# Set environment variables
ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV BACKUPS_DIR=/app/backups

# Expose API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health/live || exit 1

# Run the application
CMD ["node", "dist/index.js"]

