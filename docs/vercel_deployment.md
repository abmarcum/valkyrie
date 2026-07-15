# Valkyrie Production Deployment Guide (Vercel & Cloud Hosting)

This document provides step-by-step instructions to deploy the Valkyrie multi-agent workspace platform to production.

## 🏛️ Production Architecture Overview

Valkyrie is structured as a monorepo consisting of a Next.js frontend, an Express backend, and a shared database client. Because the orchestrator runs **long-running agent workflows** (which exceed Serverless function execution timeouts) and **saves generated codebases to local sandbox directories**, a split-deployment model is required:

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
 │    (Express Orchestrator Backend & QA sandbox)        │
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
2. **Backend (Render / Railway / AWS)**: Hosts the Express API (`apps/orchestrator`) on a persistent server instance to support file system sandboxes and unlimited execution timeouts.
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

## 🌐 Step 2: Deploy Backend to Render or Railway

To support continuous stream log connections (SSE) and persistent code generation files, deploy `apps/orchestrator` to Render or Railway.

### Dockerfile Deployment (Recommended)
You can deploy the backend using the root `package.json` configurations or compile a standalone Docker container. Create a `Dockerfile.backend` in the root:

```dockerfile
FROM node:20-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY apps/orchestrator ./apps/orchestrator
COPY packages/db ./packages/db
RUN npm ci
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma
RUN npm run build --workspace=@valkyrie/orchestrator
EXPOSE 4000
CMD ["npm", "run", "dev", "--workspace=@valkyrie/orchestrator"]
```

### Environment Variables
Configure these variables in your hosting panel:
* `PORT`: `4000`
* `DATABASE_URL`: Your PostgreSQL connection string.
* `GITHUB_TOKEN`: GitHub personal access token (or GitHub App parameters) for bug tracking integration.
* API Keys (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `OLLAMA_IP` if hosting a remote Ollama server).

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
4. Add the following **Environment Variables**:
   * `NEXT_PUBLIC_ORCHESTRATOR_URL`: The HTTPS URL of your hosted backend (e.g. `https://valkyrie-orchestrator.onrender.com`).
   * `DATABASE_URL`: The same PostgreSQL connection string (since the Next.js app queries Prisma database runs directly).
5. Click **Deploy**.

---

## 🧪 Step 4: Expose Local QA Runner

The Local QA Runner is designed to run locally inside your test sandboxes. Set the `ORCHESTRATOR_URL` environment variable to point to your cloud hosted backend:

```bash
docker run -e ORCHESTRATOR_URL=https://valkyrie-orchestrator.onrender.com valkyrie-qa-runner --project <projectId>
```
