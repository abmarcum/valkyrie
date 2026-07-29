# Valkyrie Production Deployment Guide (Vercel & Cloud Hosting)

This document provides step-by-step instructions to deploy the Valkyrie multi-agent workspace platform to production.

## 🏛️ Production Architecture Overview

Valkyrie is structured as a monorepo consisting of a Next.js frontend, a Fastify backend, and a shared database client. Because the orchestrator runs **long-running agent workflows** (which exceed Serverless function execution timeouts) and **saves generated codebases to local sandbox directories**, a split-deployment model is required:

```
                  ┌──────────────────────┐
                  │   Vercel Hosting     │
                  │  (Next.js Frontend)  │
                  └──────────┬───────────┘
                             │
            HTTPS API Calls  │
                             ▼
 ┌───────────────────────────────────────────────────────┐
 │                   Cloud VM Hosting                    │
 │    (Fastify Orchestrator Backend & QA sandbox)        │
 │              Render / Railway / AWS                   │
 └──────────────────────────┬────────────────────────────┘
                            │
            Prisma Client   │
                            ▼
                  ┌──────────────────────┐
                  │    Cloud Database    │
                  │   PostgreSQL Neon    │
                  └──────────────────────┘
```

1. **Frontend (Vercel)**: Hosts the Next.js dashboard (`apps/web`).
2. **Backend (Render / Railway / AWS)**: Hosts the Fastify API (`apps/orchestrator`) on a persistent server instance to support file system sandboxes and unlimited execution timeouts.
3. **Database (Neon / Supabase)**: Serverless PostgreSQL database to replace the local SQLite file.

---

## 💾 Step 1: Migrate Database to PostgreSQL

SQLite is stateless and read-only on serverless/container platforms. We need to transition Prisma to PostgreSQL.

1. Create a serverless PostgreSQL database on **[Neon](https://neon.tech/)** or **[Supabase](https://supabase.com/)**.
2. Open [packages/db/prisma/schema.prisma](file:///Users/andrew/ai-workspace/code/valkyrie/packages/db/prisma/schema.prisma) and change the database provider to `postgresql`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Set your local `.env` `DATABASE_URL` to your PostgreSQL connection string:
   ```env
   DATABASE_URL="postgresql://user:password@ep-cool-sun-123456.us-east-2.aws.neon.tech/valkyrie?sslmode=require"
   ```
4. Push the schema migrations to PostgreSQL:
   ```bash
   npx prisma db push
   ```

---

## 🌐 Step 2: Deploy Backend to Render, Railway, AWS ECR, or Docker Hub

To support continuous stream log connections (SSE) and persistent code generation files, deploy `apps/orchestrator` as a containerized service.

### 🐳 1. Dockerfile Configuration ([Dockerfile.backend](file:///Users/andrew/ai-workspace/code/valkyrie/Dockerfile.backend))
A production-optimized Dockerfile targeted for **Linux AMD64 (x86_64)** is included in the monorepo root:

```dockerfile
FROM node:24-bookworm-slim

WORKDIR /app

# Copy monorepo configuration and lockfiles
COPY package.json package-lock.json tsconfig.json ./
COPY apps/orchestrator ./apps/orchestrator
COPY packages/db ./packages/db

# Install dependencies
RUN npm ci

# Generate Prisma client and compile TypeScript orchestrator backend
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma
RUN npm run build --workspace=@valkyrie/orchestrator

EXPOSE 4000

# Start production Fastify orchestrator backend
CMD ["node", "apps/orchestrator/dist/index.js"]
```

### 🔨 2. Build the Docker Image for Linux AMD64
Build the container image targeting `linux/amd64` architecture (crucial when building on Apple Silicon / macOS):
```bash
docker build --platform linux/amd64 -t valkyrie-orchestrator:latest -f Dockerfile.backend .
```

### 📤 3. Push Image to a Container Registry

#### Option A: Docker Hub
```bash
# Log in to Docker Hub
docker login

# Tag and push image
docker tag valkyrie-orchestrator:latest <your-dockerhub-username>/valkyrie-orchestrator:latest
docker push <your-dockerhub-username>/valkyrie-orchestrator:latest
```

#### Option B: GitHub Container Registry (GHCR)
```bash
# Log in to GHCR (using a Personal Access Token with write:packages permission)
echo $GHCR_PAT | docker login ghcr.io -u <your-github-username> --password-stdin

# Tag and push image
docker tag valkyrie-orchestrator:latest ghcr.io/<your-github-username>/valkyrie-orchestrator:latest
docker push ghcr.io/<your-github-username>/valkyrie-orchestrator:latest
```

#### Option C: AWS Elastic Container Registry (ECR)
```bash
# Authenticate Docker to AWS ECR
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <aws_account_id>.dkr.ecr.<region>.amazonaws.com

# Tag and push image
docker tag valkyrie-orchestrator:latest <aws_account_id>.dkr.ecr.<region>.amazonaws.com/valkyrie-orchestrator:latest
docker push <aws_account_id>.dkr.ecr.<region>.amazonaws.com/valkyrie-orchestrator:latest
```

### ⚙️ 4. Environment Variables
Configure these variables in your cloud hosting provider:
* `PORT`: `4000`
* `DATABASE_URL`: Your PostgreSQL connection string.
* `GITHUB_TOKEN`: Personal Access Token or GitHub App credentials.
* API Keys (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `OLLAMA_IP`).

---

## ⚡ Step 3: Deploy Frontend to Vercel

1. Connect your GitHub repository to **[Vercel](https://vercel.com/)**.
2. Select your repository and configure the **Project Settings**:
   * **Framework Preset**: `Next.js`
   * **Root Directory**: `apps/web`
3. Expand **Build and Development Settings**:
   * **Build Command**: `cd ../.. && npm run build --filter=web`
   * **Output Directory**: `Default (.next)`
   * **Install Command**: `cd ../.. && npm install`
4. Add the following **Environment Variable**:
   * `NEXT_PUBLIC_ORCHESTRATOR_URL`: The HTTPS URL of your hosted Fastify backend (e.g. `https://valkyrie-api.fooguru.org`).
   * *Note: The Next.js frontend routes 100% of data traffic through the Fastify API and does NOT require direct database connections or `DATABASE_URL` credentials.*
5. Click **Deploy**.

---

## 🧪 Step 4: Expose Local QA Runner

The Local QA Runner is designed to run locally inside your test sandboxes. Set the `ORCHESTRATOR_URL` environment variable to point to your cloud hosted backend:

```bash
docker run -e ORCHESTRATOR_URL=https://valkyrie-api.fooguru.org valkyrie-qa-runner --project <projectId>
```
