# Valkyrie Telemetry & Operations Dashboard

This is the Next.js frontend application for Valkyrie. It provides developer interfaces to create projects, monitor active agent logs, track LLM execution costs, manage company directories, and restart runs.

---

## 🔌 API-First Decoupled Architecture

* **Zero Direct Database Coupling**: The frontend does **not** connect directly to SQLite or PostgreSQL and carries zero database credentials.
* **100% API-Routed Data Flow**: All data operations (projects, telemetry streaming, companies, users, settings, and stats) route exclusively through the Fastify Orchestrator API backend.
* **Centralized Configuration**: Configured via `src/lib/config.ts` using `process.env.NEXT_PUBLIC_ORCHESTRATOR_URL` (defaulting to `http://localhost:4000`).

---

## 🎨 Dashboard Interfaces

### 🏠 Swarm Projects Directory (`/dashboard`)
* Lists all project profiles linked to the user's tenant organization.
* **Project Creator**: Configures names, descriptions, caching preferences, and VCS repository routes.
* **6-Language Selector**: Selects Go, TypeScript, Python, Java, C++, or C#.
* **Source Code Scope Selector**: Configures Small Scope (2–4 code files), Medium Scope (5–8 code files), or Large Scope (9–15+ code files).

### 🚀 Swarm Run Telemetry (`/project/[id]/run`)
* **Milestone Monitor**: Shows live progress indicators for agent steps:
  `PM -> Software Architect -> Data Architect -> UI/UX -> Developer -> Security Architect -> Tech Writer -> QA -> SRE Deployer`
* **Console Terminal**: Streams Server-Sent Event (SSE) console logs and updates automatically.
* **Planning Approval Gate**: Interactive approval card presented during `AWAITING_APPROVAL` status to review `docs/prd.md`, `docs/architecture.md`, `docs/database.md`, and `docs/ui_ux.md` before developer synthesis.
* **Interactive File Viewer Modal**: Click any generated file to open an interactive viewer with line numbers, copy-to-clipboard button, and a **Rendered Markup** (formatted Markdown headers, tables, callouts) vs **Raw Code** toggle.
* **Per-File Cost & Token Badges**: Displays prompt and completion tokens and USD cost badges (`💵 $0.00028`) next to each file.

### 🔒 Administration Panel (`/admin`)
* Restricted to Admin users.
* **Swarm AI Configurations Form**: Selects the system-wide AI provider (Google, Anthropic, OpenAI, Ollama) and model, saves API keys (masked with password inputs), or configures custom connection endpoints (such as Ollama's local IP address).
* **Company Profiles Builder**: Provisions tenant organizations (Company ID slug parameter).
* **Users Creator**: Configures users, company bindings, and RBAC roles.
* **Telemetry Explorer**: Inspects projects associated with selected companies and calculates total LLM usage statistics.

---

## 🔐 Auth & Role-Based Access Control (RBAC)

### Passwordless Username OAuth Flow
Users log in by entering their username at `/login`. The system issues a JWT containing user details:
* Username containing `admin` -> Assumes `admin` role.
* Username containing `viewer` -> Assumes `viewer` role.
* All other usernames -> Assumes `user` role.

### RBAC Enforcement matrix:
* **Viewer**: Read-only access. Telemetry and dashboards are visible, but run creation, pipeline starts, restarts, cancellations, and administration menus are disabled.
* **User**: Standard developer access. Allowed to create, delete, and configure projects under their company namespace. Admin panel is blocked.
* **Admin**: Complete system clearance. Able to provision companies, invite users, access analytics, and manage all projects.

---

## 🐳 Containerized Deployment (Docker)

The web frontend can be built and executed inside a production Docker container using [Dockerfile.web](../../Dockerfile.web):

```bash
# Build the Docker image from monorepo root
docker build -f Dockerfile.web -t valkyrie-web:latest .

# Run the container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_ORCHESTRATOR_URL=https://valkyrie-api.yourdomain.com \
  valkyrie-web:latest
```

---

## 🚀 Execution Instructions

Run the server independently in development:
```bash
# Start development server
npm run dev
```
By default, the server boots on port `3000`.

---

## 🚀 Vercel Production Deployment

To host this Next.js app on Vercel and connect it to a cloud hosted Postgres database and orchestrator server, see the **[Valkyrie Production Deployment Guide](../../docs/vercel_deployment.md)**.


