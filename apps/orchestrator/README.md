# Valkyrie Swarm Orchestrator Backend

The Orchestrator manages the execution flow of the AI swarm. It parses developer configs, triggers sequential agent generation loops, validates code integrity, records tokens telemetry, proxies LLM completions, and maintains local databases.

---

## 🛠️ Key Architectural Features

1. **Sequential Swarm Workflow**: Spawns individual agent prompts for PM, Software Architect, Data Architect, UI/UX Designer, Codebase Developer, Security Architect, Tech Writer, and QA Engineer.
2. **Double Validation Auditing**: 
   * The **Software Architect** validates developer files against the architectural design (capped at a maximum of 3 validation iterations).
   * The **Security Architect** audits the developer code for injection vectors, secret leaks, and OWASP Top 10 vulnerabilities.
3. **Immediate Remote pushes**: Codebase changes are committed and pushed to the project's GitHub repository immediately after the Security Architect finishes auditing the code, before technical manuals are built.
4. **Self-Healing Loop & Issue Tracker**: Receives test reports from the QA Runner. If tests fail, the orchestrator automatically **submits a descriptive GitHub bug issue** containing full stdout/stderr system log segments, triggers the Developer Agent to analyze the bugs and apply fixes, commits and pushes the fixes to GitHub, and **comments on the issue with a direct link to the new commit** before closing it.
5. **Multi-API Provider Engine**: Supports Google (Gemini), Anthropic (Claude), OpenAI (GPT), and Ollama (local server). System settings default to local Ollama inference running model `qwen3-coder:latest` on port `11434`.
6. **LLM Proxying Service**: Decouples sandboxed runners from API key variables by hosting a centralized completion proxy.
7. **Caching Engine**: Built-in in-memory KV prompt response caching. Can be toggled on/off in project telemetry headers.
8. **Model Resilience**: Automatically issues warning indicators and falls back to `gemini-1.5-flash` if a Google API query yields a 404 error.

---

## 🔌 API Reference Guide

### 🚀 Swarm Executions
* **`POST /api/projects/run`**: Initializes a project run. Parses tenant scopes, VCS preferences, caching toggles, and boots the swarm pipeline.
* **`GET /api/projects/:id/status`**: Queries the active pipeline step (`status` string).
* **`GET /api/projects/:id/stream`**: Establishes a Server-Sent Events (SSE) connection streaming real-time console logs from the active swarm.
* **`GET /api/projects/:id/files`**: Returns a JSON array containing all generated files and contents.
* **`POST /api/projects/:id/llm`**: Proxies LLM completions using the active provider, model, and secret key configurations.

### 🧪 QA Reports
* **`POST /api/projects/:id/qa-report`**: Triggered by the QA Runner CLI to submit pass/fail status, stdout, and error details. If `passed` is false, registers a GitHub issue and spawns a background fix job.

### 🔒 Admin Panel Controls
* **`GET /api/admin/settings`**: Loads active swarm model, provider, keys, and endpoint configurations (Admin only).
* **`POST /api/admin/settings`**: Updates and saves global Swarm configuration preferences (Admin only).
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
