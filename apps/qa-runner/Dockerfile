# Use Node.js 24 base image
FROM node:24-bookworm-slim

# Copy uv binary from the official uv image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install Microsoft APT Repository for .NET SDK
RUN apt-get update && apt-get install -y --no-install-recommends wget ca-certificates \
    && wget https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb -O packages-microsoft-prod.deb \
    && dpkg -i packages-microsoft-prod.deb \
    && rm packages-microsoft-prod.deb

# Install multi-language compilers (Java, C++, C#, Python, Node)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-17-jdk \
    maven \
    g++ \
    cmake \
    make \
    dotnet-sdk-8.0 \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Go 1.23.4 binary (supports log/slog and go.mod toolchain directive)
RUN curl -fsSL https://go.dev/dl/go1.23.4.linux-amd64.tar.gz | tar -C /usr/local -xz
ENV PATH="/usr/local/go/bin:${PATH}"

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
