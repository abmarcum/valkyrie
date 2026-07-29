# Use Node.js 24 base image
FROM node:24-bookworm-slim

# Copy uv binary from the official uv image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install Python and build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    ca-certificates \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy lock files and workspace settings
COPY package.json package-lock.json tsconfig.json ./
COPY apps/qa-runner ./apps/qa-runner

# Install workspace dependencies
RUN npm ci --workspace=@valkyrie/qa-runner

# Build the TS codebase
WORKDIR /app/apps/qa-runner
RUN npm run build

# Default execution entrypoint
ENTRYPOINT ["node", "dist/index.js"]
