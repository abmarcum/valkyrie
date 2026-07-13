# Valkyrie QA Runner & Model Context Protocol (MCP) Server

The QA Runner package is an automated testing agent that downloads generated application sandboxes, validates runtime startup behaviors, generates unit assertions using **Gemini 3.5 Flash**, and runs test suites. It also boots as an MCP Server over stdio.

---

## ⚙️ Core Testing Workflow

When executed, the QA Runner follows this pipeline:
1. **Workspace Syncing**: Downloads code structures from the orchestrator and writes them to a local folder (`apps/qa-runner/sandbox/<project-id>`).
2. **Startup Check Safeguard**: Spawns the main script entry point in the background. If the application crashes or exits with a non-zero code within **2.5 seconds**, the runner halts, captures stdout/stderr diagnostics, and reports the logs back to the self-healing feedback pipeline.
3. **AI Test Generation**: If the startup check passes, the runner sends the code to Gemini to scaffold a native test file (`test.py` or `test.js`).
4. **Environment Execution**: Runs the test suite:
   * **NodeJS**: Executes using `node test.js`.
   * **Python**: Probe for `uv` binary. If `uv` exists, runs via `uv run --no-project --with-requirements requirements.txt python test.py` (which builds virtual environments and resolves imported requirements dynamically). Falls back to python3/python if `uv` is absent.
5. **Report & Healing**: Submits test results to the orchestrator. If assertions fail, the runner enters a polling state. Once the Developer Agent applies fixes, the runner automatically updates code files, builds new tests, and re-tests.
6. **Logging**: Saves all execution details to `generated/<project-id>/qa_runner.log` and traces LLM calls inside LangSmith.

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

To run the QA runner inside a container containing Node, Python, and `uv`:

```bash
# 1. Build the container
docker build -f apps/qa-runner/Dockerfile -t valkyrie-qa-runner .

# 2. Execute tests containerized
docker run -e GEMINI_API_KEY=$GEMINI_API_KEY \
           -e ORCHESTRATOR_URL=http://host.docker.internal:4000 \
           valkyrie-qa-runner --project <project-id>
```
