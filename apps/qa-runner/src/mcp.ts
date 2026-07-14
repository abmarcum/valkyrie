import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { 
  downloadWorkspaceFiles, 
  generateAIAssertions, 
  verifyApplicationStartup, 
  sendReport
} from "./index";

// Helper to log debug info to stderr so it doesn't corrupt stdout JSON-RPC channel
function debugLog(message: string) {
  process.stderr.write(`[MCP Server Debug] ${message}\n`);
}

export function startMcpServer() {
  debugLog("Starting Valkyrie QA Runner MCP Server over stdio...");

  let buffer = "";

  process.stdin.on("data", (chunk) => {
    buffer += chunk.toString();
    let lineEndIndex;
    while ((lineEndIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.substring(0, lineEndIndex).trim();
      buffer = buffer.substring(lineEndIndex + 1);
      if (line) {
        handleRawRequest(line);
      }
    }
  });

  process.stdin.on("end", () => {
    debugLog("process.stdin stream ended, exiting MCP Server.");
    process.exit(0);
  });
}

function sendResponse(id: number | string | null, result?: any, error?: any) {
  const payload: any = {
    jsonrpc: "2.0",
    id
  };
  if (error) {
    payload.error = error;
  } else {
    payload.result = result;
  }
  process.stdout.write(JSON.stringify(payload) + "\n");
}

async function handleRawRequest(line: string) {
  try {
    const request = JSON.parse(line);
    if (request.jsonrpc !== "2.0") {
      return; // Ignore non-JSON-RPC
    }

    const { method, params, id } = request;
    debugLog(`Received request: ${method} (id: ${id})`);

    switch (method) {
      case "initialize":
        sendResponse(id, {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: "valkyrie-qa-runner",
            version: "1.0.0"
          }
        });
        break;

      case "initialized":
        // Client confirms initialization, no response needed
        break;

      case "ping":
        sendResponse(id, {});
        break;

      case "tools/list":
        sendResponse(id, {
          tools: [
            {
              name: "run_qa_tests",
              description: "Runs AI-driven QA tests for a specific project. Downloads files, executes startup checks, creates unit/integration assertions, executes them, logs outputs, and reports back to the central orchestrator.",
              inputSchema: {
                type: "object",
                properties: {
                  projectId: {
                    type: "string",
                    description: "The project ID (e.g. proj-1783693830508) to execute tests for."
                  }
                },
                required: ["projectId"]
              }
            },
            {
              name: "verify_app_startup",
              description: "Attempts to execute the application main entrypoint (Node/Python) for 2.5 seconds to ensure it boots without throwing exceptions.",
              inputSchema: {
                type: "object",
                properties: {
                  projectId: {
                    type: "string",
                    description: "The project ID to verify startup behavior for."
                  }
                },
                required: ["projectId"]
              }
            }
          ]
        });
        break;

      case "tools/call":
        const { name, arguments: args } = params || {};
        try {
          const result = await handleToolCall(name, args);
          sendResponse(id, result);
        } catch (toolErr: any) {
          sendResponse(id, undefined, {
            code: -32603,
            message: toolErr.message || "Internal error during tool call execution."
          });
        }
        break;

      default:
        sendResponse(id, undefined, {
          code: -32601,
          message: `Method not found: ${method}`
        });
        break;
    }
  } catch (err: any) {
    debugLog(`JSON-RPC parsing error: ${err.message}`);
  }
}

async function handleToolCall(name: string, args: any): Promise<any> {
  const projectId = args?.projectId;
  if (!projectId) {
    throw new Error("Missing required argument: projectId");
  }

  debugLog(`Executing tool call: ${name} for project ${projectId}`);

  if (name === "verify_app_startup") {
    const files = await downloadWorkspaceFiles(projectId);
    if (files.length === 0) {
      return {
        content: [{ type: "text", text: "No files generated yet for this project." }],
        isError: true
      };
    }

    const sandboxDir = path.join(__dirname, "../sandbox", projectId);
    fs.mkdirSync(sandboxDir, { recursive: true });

    files.forEach(file => {
      const filePath = path.join(sandboxDir, file.name);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, file.content);
    });

    const mainFile = files.find(f => f.name === "main.py" || f.name === "main.js" || f.name === "index.js" || f.name === "app/main.py" || f.name === "app/main.js");
    if (!mainFile) {
      return {
        content: [{ type: "text", text: "No main entrypoint file discovered to verify startup." }],
        isError: true
      };
    }

    const hasUv = await new Promise<boolean>((resolve) => {
      exec("command -v uv", (err) => resolve(!err));
    });

    const startupResult = await verifyApplicationStartup(sandboxDir, mainFile.name, hasUv);
    if (!startupResult.success) {
      return {
        content: [{
          type: "text",
          text: `Startup check FAILED.\nLogs:\n${startupResult.logs.join("\n")}\nError:\n${startupResult.errorMsg}`
        }],
        isError: true
      };
    }

    return {
      content: [{ type: "text", text: `Startup check PASSED. Logs:\n${startupResult.logs.join("\n")}` }],
      isError: false
    };
  }

  if (name === "run_qa_tests") {
    const files = await downloadWorkspaceFiles(projectId);
    if (files.length === 0) {
      return {
        content: [{ type: "text", text: "No files generated yet for this project." }],
        isError: true
      };
    }

    const sandboxDir = path.join(__dirname, "../sandbox", projectId);
    fs.mkdirSync(sandboxDir, { recursive: true });

    files.forEach(file => {
      const filePath = path.join(sandboxDir, file.name);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, file.content);
    });

    // Check startup first
    const mainFile = files.find(f => f.name === "main.py" || f.name === "main.js" || f.name === "index.js" || f.name === "app/main.py" || f.name === "app/main.js");
    const hasUv = await new Promise<boolean>((resolve) => {
      exec("command -v uv", (err) => resolve(!err));
    });

    if (mainFile) {
      const startupResult = await verifyApplicationStartup(sandboxDir, mainFile.name, hasUv);
      if (!startupResult.success) {
        sendReport(projectId, false, startupResult.logs, [startupResult.errorMsg]);
        return {
          content: [{
            type: "text",
            text: `QA Execution failed at startup phase.\nLogs:\n${startupResult.logs.join("\n")}\nError:\n${startupResult.errorMsg}`
          }],
          isError: true
        };
      }
    }

    // Locate test file
    const testFile = files.find(f => f.name.startsWith("test."));
    if (!testFile) {
      sendReport(projectId, true, ["No test scripts found. Scaffolding marked successful."], []);
      return {
        content: [{ type: "text", text: "No test script file found. Marked success by default." }],
        isError: false
      };
    }

    const ext = testFile.name.endsWith(".js") ? "js" : "py";
    const aiTestContent = await generateAIAssertions(files, testFile.name, ext, projectId);
    if (aiTestContent) {
      const testFilePath = path.join(sandboxDir, testFile.name);
      fs.writeFileSync(testFilePath, aiTestContent);
    }

    let command = "";
    if (testFile.name.endsWith(".js")) {
      command = `node "${path.join(sandboxDir, testFile.name)}"`;
    } else {
      if (hasUv) {
        const hasReq = fs.existsSync(path.join(sandboxDir, "requirements.txt"));
        if (hasReq) {
          command = `uv run --no-project --with-requirements requirements.txt python "${path.join(sandboxDir, testFile.name)}"`;
        } else {
          command = `uv run --no-project python "${path.join(sandboxDir, testFile.name)}"`;
        }
      } else {
        const hasPython3 = await new Promise<boolean>((resolve) => {
          exec("command -v python3", (err) => resolve(!err));
        });
        const binary = hasPython3 ? "python3" : "python";
        command = `${binary} "${path.join(sandboxDir, testFile.name)}"`;
      }
    }

    return new Promise((resolve) => {
      exec(command, { cwd: sandboxDir }, (error, stdout, stderr) => {
        const logs = stdout.split("\n").filter(Boolean);
        const errors = stderr.split("\n").filter(Boolean);

        // Save local logs
        try {
          const genLogDir = path.join(__dirname, "../../../generated", projectId);
          if (fs.existsSync(genLogDir)) {
            const logContent = `========================================\n Valkyrie QA Runner Execution Log\n Project: ${projectId}\n Timestamp: ${new Date().toISOString()}\n Command: ${command}\n Status: ${error ? "FAILED" : "PASSED"}\n========================================\n\n[STDOUT]\n${stdout}\n\n[STDERR]\n${stderr || (error ? error.message : "")}\n`;
            fs.writeFileSync(path.join(genLogDir, "qa_runner.log"), logContent, "utf-8");
          }
        } catch (e) {}

        if (error) {
          errors.push(error.message);
          sendReport(projectId, false, logs, errors);
          resolve({
            content: [{
              type: "text",
              text: `QA execution FAILED.\nStdout:\n${stdout}\nStderr:\n${stderr || error.message}`
            }],
            isError: true
          });
        } else {
          sendReport(projectId, true, logs, errors);
          resolve({
            content: [{
              type: "text",
              text: `QA execution PASSED.\nStdout:\n${stdout}`
            }],
            isError: false
          });
        }
      });
    });
  }

  throw new Error(`Tool not found: ${name}`);
}
