# Service B Dockerfile (Optimized - Copy node_modules)
FROM node:20-alpine AS builder

# Install build dependencies for canvas (required by chartjs-node-canvas)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    build-base \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    pkgconfig

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove devDependencies to make node_modules smaller
RUN npm prune --omit=dev

# Production stage
FROM node:20-alpine

# Install ONLY runtime dependencies for canvas (no build tools needed)
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib \
    pixman \
    pangomm \
    libjpeg-turbo \
    freetype

WORKDIR /app

# Copy package files
COPY --from=builder /app/package*.json ./

# Copy already-built node_modules from builder (includes canvas binaries)
COPY --from=builder /app/node_modules ./node_modules

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy necessary configuration files
COPY --from=builder /app/nest-cli.json ./
COPY --from=builder /app/tsconfig.json ./

# Create reports directory
RUN mkdir -p /app/reports

# Expose port
EXPOSE 3001

# Start the application
CMD ["npm", "run", "start:prod"]