# Valkyrie QA Runner & Model Context Protocol (MCP) Server

The QA Runner package is an automated testing agent that downloads generated application sandboxes, validates runtime startup behaviors, generates unit assertions via the central orchestrator's LLM settings proxy, and executes native compiler and test suites across all 6 supported languages. It also boots as an MCP Server over stdio.

---

## ⚙️ Core Testing Workflow

When executed, the QA Runner follows this pipeline:
1. **Workspace Syncing**: Downloads code structures from the orchestrator and writes them to a local folder (`apps/qa-runner/sandbox/<project-id>`).
2. **Startup Check Safeguard**: Spawns main script entry point in background to ensure clean initial load without crashes.
3. **AI Assertion Generation**: Calls orchestrator LLM proxy to generate functional test assertions for the codebase.
4. **Universal Environment Execution**: Runs native compiler and test suite based on language:
   - **Go**: Executes `go test -v ./...`
   - **Java**: Executes `mvn test` or `javac`
   - **C++**: Executes `cmake -B build && cmake --build build` or `g++`
   - **C#**: Executes `dotnet test` or `dotnet build`
   - **NodeJS/TS**: Executes `node test.js`
   - **Python**: Executes `python -m unittest` or `uv run`
5. **Live Test Reload**: Uses `fs.watch` file listener. Restarts test suite if test plan files are updated.
6. **Report & Self-Healing Loop**: Submits test results to orchestrator. If tests fail, developer agent applies fixes and re-runs testing loop (up to 8 attempts).

---

## 🔌 CLI Usage Guide

### Run One-off QA Testing Cycle
```bash
npm run start -w @valkyrie/qa-runner -- --project <project-id>
```

### Start as stdio Model Context Protocol (MCP) Server
Allows any MCP-compatible client (like Cursor or Claude Desktop) to invoke Valkyrie's testing modules:
```bash
npm run start -w @valkyrie/qa-runner -- --mcp
```

#### MCP Tools Exposed:
* **`run_qa_tests`**: Runs codebase assertions, logs console outcomes, and reports execution status to the orchestrator.
  * Inputs: `projectId` (string)
* **`verify_app_startup`**: Runs the application main entry point for 2.5 seconds to capture diagnostics and ensure it loads cleanly.
  * Inputs: `projectId` (string)

---

## 🐳 Containerized Execution (Docker)

To run the QA runner as a continuous background daemon that listens for and tests **any project**:

```bash
# 1. Build the container
docker build -f apps/qa-runner/Dockerfile -t valkyrie-qa-runner .

# 2. Run as Global Multi-Project Daemon (No project ID required!)
docker run -d \
       --name valkyrie-qa-runner \
       --restart unless-stopped \
       -e ORCHESTRATOR_URL=https://valkyrie-api.fooguru.org \
       valkyrie-qa-runner
```

*Note: If you wish to target a specific single project, pass `--project <project-id>` at the end of `docker run`.*
