# Valkyrie: Autonomous Swarm-Driven Codebase Builder & Telemetry

Valkyrie is an autonomous AI agent swarm platform designed to specify, build, verify, audit, and deploy production-grade software applications. Powered by a provider-agnostic engine, Valkyrie supports **Google Gemini**, **Anthropic Claude**, **OpenAI GPT**, and local **Ollama** models (defaulting to Ollama `qwen3-coder:latest`), coordinating specialized agents through a rigorous generation and self-correcting validation lifecycle.

---

## 🏗️ Monorepo Architecture

Valkyrie is structured as a TypeScript monorepo containing the following components:

```
├── apps/
│   ├── orchestrator/       # Express server managing the LLM swarm pipelines, Git pushes & LLM proxying
│   ├── qa-runner/          # Local QA executor CLI, Docker wrapper, & Model Context Protocol (MCP) server
│   └── web/                # Next.js telemetry dashboard, project milestones, & admin panel
├── packages/
│   └── db/                 # Prisma database configuration & SQLite seed script
├── personas/
│   └── agents.json         # Prompt parameters & temperature models for the agent swarm
└── data/                   # Database specifications, connections, & migrations (database.md)
```

---

## 🤖 Swarm Agent Pipeline Flow

When a project run is initiated, the orchestrator triggers the agent pipeline sequentially, where each phase is audited by validation actors before continuing:

```
[PM Agent] (PRD Design)
   │
   ▼
[Software Architect] (Technical Blueprint)
   │
   ▼
[Data Architect] (Database Schema & Connection Pools)
   │
   ▼
[UI/UX Designer] (Interface Guidelines)
   │
   ▼
[Developer Agent] (Heavy Inline Commented Source Code)
   │
   ▼
[Software Architect] (Validation Audit Loop) ───[If gaps found]───► [Re-develop]
   │
   ▼
[Security Architect] (OWASP Top 10 Audit) ─────[If vulnerabilities]─► [Re-develop]
   │
   ▼
   ├──► [Immediate Git Commit & push to GitHub]
   │
   ▼
[Tech Writer Agent] (README & API Docs Manuals) ───► [Secondary Push]
   │
   ▼
[QA Engineer (Runner)] (Startup Verification & AI Assertion Test Sweeps)
   │
   ├──► [Poller: Waits/retries if test plan does not exist yet]
   │
   ├──► [Hot Reload: Restarts test execution if test plan is updated]
   │
   └────────────[If tests fail (Self-Healing Loop, Max 8 attempts)]
                 │
                 ├──► [Creates GitHub Bug Issue detailing execution failures]
                 │
                 ├──► [Developer Agent updates, pushes fix, and closes issue]
                 │
                 ▼
            [Re-develop]
```

---

## ⚙️ Configuration & Environment Variables

Create a `.env` file at the root of the workspace. A template is provided in [.env.example](file:///Users/andrew/ai-workspace/code/valkyrie/.env.example).

```ini
# Gemini API Key (Default AI Swarm Model)
GEMINI_API_KEY=your-gemini-key

# Optional LangSmith Tracing Keys
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your-langsmith-key
LANGCHAIN_PROJECT=valkyrie

# Optional GitHub App VCS Configuration
GITHUB_APP_ID=your-github-app-id
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
```

---

## 🚀 Local Deployment Instructions

### 1. Prerequisite Installations
Ensure you have Node.js 20+ and Python 3 installed. We recommend installing `uv` for fast Python dependency resolving:
```bash
# Install uv locally
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 2. Setup Dependencies & DB Schema
From the monorepo root folder, run:
```bash
# Install NPM dependencies
npm install

# Push database schema & seed tenant configurations
npx Prisma db push -w @valkyrie/db
```

### 3. Start Development Servers
To boot both the Express orchestrator and the Next.js web application, execute:
```bash
npm run dev
```
* **Next.js Dashboard**: [http://localhost:3000](http://localhost:3000)
* **Central Orchestrator**: [http://localhost:4000](http://localhost:4000)

---

## 🧪 QA Runner Deployment

The Local QA Runner executes in two modes:

### Mode A: One-off QA Pipeline Execution
Executes unit/integration test suites and starts self-correcting loops:
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
