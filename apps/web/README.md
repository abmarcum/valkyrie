# Valkyrie Telemetry & Operations Dashboard

This is the Next.js frontend application for Valkyrie. It provides developer interfaces to create projects, monitor active agent logs, track LLM execution costs, manage company directories, and restart runs.

---

## 🎨 Dashboard Interfaces

### 🏠 Swarm Projects Directory (`/dashboard`)
* Lists all project profiles linked to the user's tenant organization.
* **Project Creator**: Configures names, descriptions, caching preferences, and VCS repository routes.
* **VCS Integration**: Selects PAT (Personal Access Token) or GitHub App authentication (requires Installation ID configuration).

### 🚀 Swarm Run Telemetry (`/project/[id]/run`)
* **Milestone Monitor**: Shows live progress indicators for agent steps:
  `System -> PM -> Architect -> Data Architect -> UI/UX -> Developer -> Security Architect -> Tech Writer -> QA`
* **Console Terminal**: Streams Server-Sent Event (SSE) agent print statements and automatically autoscrolls to the bottom when new telemetry messages arrive.
* **Action Header**: Restart swarm jobs, cancel running jobs, and toggle caching variables.
* **Token Costs Tracker**: Renders real-time LLM token metrics and cost estimations dynamically calculated based on the selected provider.

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
* **Viewer**: Read-only access. Telemetry and dashboards are visible, but run creation, swarm starts, restarts, cancellations, and administration menus are disabled.
* **User**: Standard developer access. Allowed to create, delete, and configure projects under their company namespace. Admin panel is blocked.
* **Admin**: Complete system clearance. Able to provision companies, invite users, access analytics, and manage all projects.

---

## 🚀 Execution Instructions

Run the server independently:
```bash
# Start development server
npm run dev
```
By default, the server boots on port `3000`.
