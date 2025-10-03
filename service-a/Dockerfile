# Service A Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy necessary files
COPY --from=builder /app/nest-cli.json ./
COPY --from=builder /app/tsconfig.json ./

# Create data directory
RUN mkdir -p /app/data/uploads

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start:prod"]