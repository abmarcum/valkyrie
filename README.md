# Valkyrie: Autonomous Swarm-Driven Codebase Builder & Telemetry

Valkyrie is an autonomous AI agent swarm platform designed to specify, build, verify, audit, and deploy production-grade software applications. Powered by a provider-agnostic engine, Valkyrie supports **Google Gemini**, **Anthropic Claude**, **OpenAI GPT**, and local **Ollama** models, coordinating specialized agents through a rigorous generation, self-correcting validation, and SRE deployment lifecycle.

---

## 🚀 Key Platform Capabilities

- 🌐 **6-Language Multi-Framework Suite**: Generates production code in **Go** (Fiber/Gin), **TypeScript** (Next.js/Node), **Python** (FastAPI/Django), **Java** (Spring Boot/Maven), **C++** (CMake/STL), and **C#** (.NET 8/ASP.NET Core).
- 🎛 **Configurable Source Code Scope**: Dictate application source code boundaries:
  - ⚡ **Small Scope**: 2–4 core code files (Microservices & Utilities)
  - 📦 **Medium Scope**: 5–8 modular code files (Standard Applications)
  - 🏛 **Large Scope**: 9–15+ code files (Enterprise Multi-Layer Architectures)
- 🐳 **Live SRE Infrastructure as Code (IaC)**: SRE Deployer agent automatically synthesizes complete multi-environment deployment packages (`Dockerfile`, `docker-compose.yml`, `deploy/k8s/deployment.yaml`, `deploy/terraform/main.tf`) and pushes them to GitHub.
- 👁 **Interactive File Viewer Modal & Rendered Markup Preview**: Inspect generated files directly in the web UI, toggle between **Rendered Markup** (formatted headers, tables, callouts) and **Raw Code**, and copy snippets to clipboard.
- 💵 **Per-File LangSmith Cost & Token Badges**: Track token usage and USD costs per file in real-time.
- 🔄 **Cohere Context Compression Engine**: Compresses PRDs, architecture documents, database specs, and UI guidelines into high-density prompts.

---

## 🏗️ Monorepo Architecture

Valkyrie is structured as a TypeScript monorepo containing the following components:

```
├── apps/
│   ├── orchestrator/       # Fastify server managing LLM swarm pipelines, SRE IaC synthesis & Git pushes
│   ├── qa-runner/          # Universal compiler & testing CLI (Go, Java, C++, C#, TS, Python) & MCP server
│   └── web/                # Next.js telemetry dashboard, project milestones, file viewer modal & admin panel
├── packages/
│   └── db/                 # Prisma database configuration & SQLite seed script
├── personas/
│   └── agents.json         # Prompt parameters & temperature models for the agent swarm
└── data/                   # Database specifications, connections, & migrations (database.md)
```

---

## 🤖 Swarm Agent Pipeline Flow

When a project run is initiated, the orchestrator triggers the agent pipeline sequentially:

```
[Product Manager] ──► [Software Architect] ──► [Data Architect] ──► [UI/UX Designer]
                                                                        │
                                                                        ▼
[Developer Agent] ◄───[Validation Audit Loop] ◄─── [Security Architect] (OWASP Top 10)
      │
      ▼
[Immediate Git Commit & push to GitHub]
      │
      ▼
[Tech Writer Agent] (README & API Manuals) ──► [Secondary Push]
      │
      ▼
[QA Engineer (Runner)] (Universal Compiler & Assertion Suite) ───[If failed (Max 8 attempts)]──► [Developer Fix]
      │
      ▼
[SRE Deployer Agent] (Synthesizes Dockerfile, K8s & Terraform IaC) ──► [Final Git Commit & Push]
```

---

## ⚙️ Configuration & Environment Variables

Create a `.env` file at the root of the workspace. A template is provided in [.env.example](file:///Users/andrew/ai-workspace/code/valkyrie/.env.example).

```ini
# Gemini API Key (Default AI Swarm Model)
GEMINI_API_KEY=your-gemini-key

# Optional Anthropic / OpenAI Keys
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key

# Optional Cohere Prompt Compression Key
COHERE_API_KEY=your-cohere-key

# Optional LangSmith Tracing Keys
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your-langsmith-key
LANGCHAIN_PROJECT=valkyrie
```

---

## 🚀 Local Deployment Instructions

### 1. Setup Dependencies & DB Schema
From the monorepo root folder, run:
```bash
# Install NPM dependencies
npm install

# Push database schema & seed tenant configurations
npx prisma db push -w @valkyrie/db
```

### 2. Start Development Servers
To boot both the Fastify orchestrator and the Next.js web application, execute:
```bash
npm run dev
```
* **Next.js Dashboard**: [http://localhost:3000](http://localhost:3000)
* **Central Orchestrator**: [http://localhost:4000](http://localhost:4000)

---

## 🧪 QA Runner Deployment

The Local QA Runner executes in two modes:

### Mode A: One-off QA Pipeline Execution
Executes universal compiler and test suites (Go, Java, C++, C#, JS, Python):
```bash
npm run start -w @valkyrie/qa-runner -- --project <project-id>
```

### Mode B: Model Context Protocol (MCP) Server
Launches as a standard MCP `stdio` server, exposing QA execution tools directly to IDE editors or LLMs:
```bash
npm run start -w @valkyrie/qa-runner -- --mcp
```

### Containerized QA Execution (Docker)
To compile and execute tests inside an isolated sandbox, build the Dockerfile:
```bash
# Build the Docker container
docker build -f apps/qa-runner/Dockerfile -t valkyrie-qa-runner .

# Execute tests containerized, mapping ports and environment variables
docker run -e GEMINI_API_KEY=$GEMINI_API_KEY \
           -e ORCHESTRATOR_URL=http://host.docker.internal:4000 \
           valkyrie-qa-runner --project <project-id>
```

---

## 🚀 Production Deployment (Vercel & Cloud)

For production deployment configuration, database migration guides (SQLite to cloud PostgreSQL), monorepo Next.js setup on Vercel, and persistent backend configuration settings on Render or Railway, see the detailed **[Production Deployment Guide](file:///Users/andrew/ai-workspace/code/valkyrie/docs/vercel_deployment.md)**.

