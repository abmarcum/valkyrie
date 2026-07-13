# Valkyrie Swarm Orchestrator Backend

The Orchestrator manages the execution flow of the AI swarm. It parses developer configs, triggers sequential agent generation loops, validates code integrity, records tokens telemetry, and maintains local databases.

---

## 🛠️ Key Architectural Features

1. **Sequential Swarm Workflow**: Spawns individual agent prompts for PM, Software Architect, Data Architect, UI/UX Designer, Codebase Developer, Security Architect, Tech Writer, and QA Engineer.
2. **Double Validation Auditing**: 
   * The **Software Architect** validates developer files against the architectural design.
   * The **Security Architect** audits the developer code for injection vectors, secret leaks, and OWASP Top 10 vulnerabilities.
3. **Self-Healing Loop**: Receives test reports from the QA Runner. If tests fail, the orchestrator triggers the Developer Agent to analyze the bugs, rewrite the codebase, and wait for re-testing.
4. **Caching Engine**: Built-in in-memory KV prompt response caching. Can be toggled on/off in project telemetry headers.
5. **Model Resilience**: Defaults to `gemini-3.5-flash`. Automatically issues warning indicators and falls back to `gemini-1.5-flash` if a REST API query yields a 404 error.

---

## 🔌 API Reference Guide

### 🚀 Swarm Executions
* **`POST /api/projects/run`**: Initializes a project run. Parses tenant scopes, VCS preferences, caching toggles, and boots the swarm pipeline.
* **`GET /api/projects/:id/status`**: Queries the active pipeline step (`status` string).
* **`GET /api/projects/:id/stream`**: Establishes a Server-Sent Events (SSE) connection streaming real-time console logs from the active swarm.
* **`GET /api/projects/:id/files`**: Returns a JSON array containing all generated files and contents.

### 🧪 QA Reports
* **`POST /api/projects/:id/qa-report`**: Triggered by the QA Runner CLI to submit pass/fail status, stdout, and error details. If `passed` is false, spawns a background fix job.

### 🔒 Admin Panel Controls
* **`POST /api/admin/companies`**: Provisions a new company organization (required `id` slug parameter).
* **`GET /api/admin/companies`**: Lists all registered companies.
* **`GET /api/admin/companies/:id/projects`**: Lists all project profiles associated with a company.
* **`POST /api/admin/users`**: Provisions a user profile with role bindings.

---

## 🚀 Execution Instructions

Run the server independently from the orchestrator folder (requires SQLite setup):
```bash
# Start backend server
npm run dev
```
By default, the backend listens on port `4000`.
