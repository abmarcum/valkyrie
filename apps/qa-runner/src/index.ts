#!/usr/bin/env tsx

import http from "http";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { RunTree } from "langsmith";

// Manual .env parser to avoid external dependency issues
function loadDotenv(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      content.split("\n").forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const eqIdx = trimmed.indexOf("=");
          const key = trimmed.substring(0, eqIdx).trim();
          let val = trimmed.substring(eqIdx + 1).trim();
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.substring(1, val.length - 1);
          } else if (val.startsWith("'") && val.endsWith("'")) {
            val = val.substring(1, val.length - 1);
          }
          process.env[key] = val;
        }
      });
    }
  } catch (e) {}
}

loadDotenv(path.join(__dirname, "../../../.env"));

const args = process.argv.slice(2);
const isMcp = args.includes("--mcp");
export const projectIdIndex = args.indexOf("--project");
export const explicitProjectId = projectIdIndex !== -1 ? args[projectIdIndex + 1] : undefined;
export const projectId = explicitProjectId || "global-daemon";
export const orchestratorUrl = process.env.ORCHESTRATOR_URL || "http://localhost:4000";

// Helper to post JSON report
export function sendReport(projId: string, passed: boolean, logs: string[], errors: string[]) {
  const payload = JSON.stringify({ passed, logs, errors });
  const url = new URL(`${orchestratorUrl}/api/projects/${projId}/qa-report`);
  
  const req = http.request({
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload)
    }
  }, (res) => {
    let data = "";
    res.on("data", (chunk) => { data += chunk; });
    res.on("end", () => {
      console.log(`[Report Status] Central Server Response: ${res.statusCode} - ${data}`);
      console.log(`QA run completed successfully.`);
    });
  });

  req.on("error", (err) => {
    console.error(`[Error] Failed to transmit report back to orchestrator:`, err.message);
  });

  req.write(payload);
  req.end();
}

// Download files from orchestrator REST endpoint
export function downloadWorkspaceFiles(projId: string = projectId): Promise<Array<{ name: string; content: string }>> {
  return new Promise((resolve, reject) => {
    const url = `${orchestratorUrl}/api/projects/${projId}/files`;
    
    http.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch project files. Status: ${res.statusCode}`));
        return;
      }
      
      let rawData = "";
      res.on("data", (chunk) => { rawData += chunk; });
      res.on("end", () => {
        try {
          const data = JSON.parse(rawData);
          resolve(data.files || []);
        } catch (e: any) {
          reject(e);
        }
      });
    }).on("error", (err) => {
      reject(new Error(`Connection failed to orchestrator at ${orchestratorUrl}. Make sure the development server is running (npm run dev) first! Error: ${err.message}`));
    });
  });
}

async function traceQALlmCall(
  agentName: string,
  prompt: string,
  output: string,
  promptTokens?: number,
  completionTokens?: number
) {
  if (!process.env.LANGCHAIN_API_KEY) return;
  try {
    const costUSD = (promptTokens !== undefined && completionTokens !== undefined)
      ? Number(((promptTokens * 0.075 / 1000000) + (completionTokens * 0.30 / 1000000)).toFixed(6))
      : 0;

    const runTree = new RunTree({
      name: `${agentName} Decision`,
      run_type: "llm",
      inputs: { prompt },
      project_name: process.env.LANGCHAIN_PROJECT || "valkyrie",
      extra: {
        metadata: {
          model: "gemini-3.5-flash",
          prompt_tokens: promptTokens || 0,
          completion_tokens: completionTokens || 0,
          total_tokens: (promptTokens || 0) + (completionTokens || 0),
          cost_usd: costUSD,
          rates: {
            input_usd_per_million: 0.075,
            output_usd_per_million: 0.30
          },
          usage_metadata: {
            input_tokens: promptTokens || 0,
            output_tokens: completionTokens || 0,
            total_tokens: (promptTokens || 0) + (completionTokens || 0),
            input_cost: Number(((promptTokens || 0) * 0.075 / 1000000).toFixed(6)),
            output_cost: Number(((completionTokens || 0) * 0.30 / 1000000).toFixed(6)),
            total_cost: costUSD
          }
        }
      }
    });
    await runTree.postRun();

    await runTree.end({
      outputs: { response: output }
    });

    if (promptTokens !== undefined) (runTree as any).prompt_tokens = promptTokens;
    if (completionTokens !== undefined) (runTree as any).completion_tokens = completionTokens;
    if (promptTokens !== undefined && completionTokens !== undefined) {
      (runTree as any).total_tokens = promptTokens + completionTokens;
      (runTree as any).cost = costUSD;
    }

    await runTree.patchRun();
    console.log(`[QA LangSmith] QA execution successfully traced to LangSmith.`);
  } catch (err: any) {
    console.error("[QA LangSmith] Tracing failed:", err.message);
  }
}

// Invoke Gemini API to write actual unit assertions for the code
export async function generateAIAssertions(
  files: Array<{ name: string; content: string }>, 
  testFilename: string, 
  ext: string,
  projId: string = projectId
): Promise<string> {
  const codeFiles = files.filter(f => {
    const name = f.name.toLowerCase();
    return !name.startsWith("test.") && !name.startsWith("docs/") && !name.endsWith(".md") && !name.endsWith(".sql");
  });

  let codebasePrompt = "You are the Valkyrie QA Agent. Analyze the generated codebase below and write a comprehensive unit/integration test suite.\n\n";
  codebasePrompt += "Here is the codebase files that you need to write tests for:\n\n";
  
  codeFiles.forEach(f => {
    codebasePrompt += `=== File: ${f.name} ===\n${f.content}\n\n`;
  });
  
  codebasePrompt += `Write a comprehensive, fully functional unit test file named '${testFilename}'.
It must import/load the relevant source files and perform real assertions (e.g. testing pricing logic, currency structures, validation routes, or core classes).
Do NOT use random numbers or dummy mock outcomes. Write actual assertions that test inputs and outputs.
If database connections are needed, use mock database adapters or sqlite in-memory connections directly in the test file.
For Python, write tests using python's built-in 'unittest' module and execute them. Ensure that if tests fail, you call exit(1), and if they pass, exit(0).
For JavaScript, write native node assertions and execute them.
Output ONLY the raw code inside a markdown code block (between \`\`\`${ext === "js" ? "javascript" : "python"} and \`\`\`). No explanations, no conversation.`;

  console.log(`[QA Agent] Querying Orchestrator LLM Proxy to analyze code and generate assertions...`);

  try {
    const url = `${orchestratorUrl}/api/projects/${projId}/llm`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemPrompt: "You are a professional software QA automation engineer agent.",
        userPrompt: codebasePrompt,
        agentName: "QA Engineer (Runner)"
      })
    });

    if (response.ok) {
      const data = await response.json() as any;
      const responseText = data.text || "";
      const inputTokens = data.inputTokens || 0;
      const outputTokens = data.outputTokens || 0;

      // Log execution trace back to LangSmith API
      await traceQALlmCall("QA Engineer (Runner)", codebasePrompt, responseText, inputTokens, outputTokens);
      
      const marker = ext === "js" ? "javascript" : "python";
      const regex = new RegExp("```" + marker + "\\n([\\s\\S]*?)\\n```", "i");
      const match = responseText.match(regex);
      if (match && match[1]) {
        return match[1];
      }
      return responseText.replace(/```[a-z]*\n/gi, "").replace(/```/g, "").trim();
    } else {
      const errText = await response.text();
      console.error("[QA Agent] Orchestrator LLM proxy failed:", errText);
    }
  } catch (err: any) {
    console.error("[QA Agent] Error contacting LLM proxy:", err.message);
  }
  return "";
}

// Verify that the application can start up and run without crashing
export function verifyApplicationStartup(sandboxDir: string, mainFilename: string, hasUv: boolean): Promise<{ success: boolean, logs: string[], errorMsg: string }> {
  return new Promise(async (resolve) => {
    let command = "";
    if (mainFilename.endsWith(".js")) {
      command = `node "${path.join(sandboxDir, mainFilename)}"`;
    } else {
      if (hasUv) {
        const hasReq = fs.existsSync(path.join(sandboxDir, "requirements.txt"));
        if (hasReq) {
          command = `uv run --no-project --with-requirements requirements.txt python "${path.join(sandboxDir, mainFilename)}"`;
        } else {
          command = `uv run --no-project python "${path.join(sandboxDir, mainFilename)}"`;
        }
      } else {
        const hasPython3 = await new Promise<boolean>((resolve) => {
          exec("command -v python3", (err) => resolve(!err));
        });
        const binary = hasPython3 ? "python3" : "python";
        command = `${binary} "${path.join(sandboxDir, mainFilename)}"`;
      }
    }

    console.log(`[QA Runner] Startup test command: ${command}`);
    const proc = exec(command, {
      cwd: sandboxDir,
      env: {
        ...process.env,
        PYTHONPATH: sandboxDir
      }
    });
    
    let stdoutData = "";
    let stderrData = "";
    let exited = false;
    let exitCode: number | null = null;
    let procError: any = null;

    proc.stdout?.on("data", (chunk) => { stdoutData += chunk; });
    proc.stderr?.on("data", (chunk) => { stderrData += chunk; });
    proc.on("error", (err) => { procError = err; });
    proc.on("exit", (code) => {
      exited = true;
      exitCode = code;
    });

    // Wait for 2.5 seconds to monitor startup behaviour
    setTimeout(() => {
      if (exited) {
        if (exitCode !== 0 && exitCode !== null) {
          resolve({
            success: false,
            logs: stdoutData.split("\n").filter(Boolean),
            errorMsg: `Application failed startup immediately. Exit code: ${exitCode}. Stderr: ${stderrData || procError?.message}`
          });
        } else {
          resolve({
            success: true,
            logs: stdoutData.split("\n").filter(Boolean),
            errorMsg: ""
          });
        }
      } else {
        try {
          proc.kill("SIGTERM");
        } catch (e) {}
        resolve({
          success: true,
          logs: stdoutData.split("\n").filter(Boolean),
          errorMsg: ""
        });
      }
    }, 2500);
  });
}

let fixAttempts = 0;
const MAX_FIX_ATTEMPTS = 8;

// Fetch current project status from the orchestrator
export function fetchProjectStatus(projId: string = projectId): Promise<string> {
  return new Promise((resolve) => {
    const url = `${orchestratorUrl}/api/projects/${projId}/status`;
    http.get(url, (res) => {
      if (res.statusCode === 200) {
        let rawData = "";
        res.on("data", (chunk) => { rawData += chunk; });
        res.on("end", () => {
          try {
            const data = JSON.parse(rawData);
            resolve(data.status || "");
          } catch (e) {
            resolve("");
          }
        });
      } else {
        resolve("");
      }
    }).on("error", () => {
      resolve("");
    });
  });
}

// Poll status helper
export function pollForStatus(expectedStatus: string, projId: string = projectId): Promise<void> {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const url = `${orchestratorUrl}/api/projects/${projId}/status`;
      http.get(url, (res) => {
        if (res.statusCode === 200) {
          let rawData = "";
          res.on("data", (chunk) => { rawData += chunk; });
          res.on("end", () => {
            try {
              const data = JSON.parse(rawData);
              if (data.status === expectedStatus) {
                clearInterval(interval);
                resolve();
              } else {
                console.log(`[QA Runner] Current project status: ${data.status}. Waiting for Developer Agent fixes...`);
              }
            } catch (e) {}
          });
        }
      }).on("error", () => {});
    }, 5000);
  });
}

// Run the QA verification process
async function executeQA(targetProjectId?: string) {
  const currentProjId = targetProjectId || explicitProjectId || "proj-1";
  try {
    console.log(`\n[1/3] Downloading generated codebase files for project '${currentProjId}'...`);
    let files = await downloadWorkspaceFiles(currentProjId);
    const findTestFile = (fileList: Array<{ name: string; content: string }>) => {
      return fileList.find(f => {
        const nameLower = f.name.toLowerCase();
        return nameLower.startsWith("test.") || 
               nameLower.startsWith("tests/test_") || 
               nameLower.endsWith("_test.py") || 
               nameLower.endsWith(".test.js") || 
               nameLower.endsWith(".test.ts");
      });
    };
    let testFile = findTestFile(files);

    if (files.length === 0 || !testFile) {
      console.log(`[QA Runner] Test plan/script file not found in sandbox files.`);
      while (files.length === 0 || !testFile) {
        const currentStatus = await fetchProjectStatus(currentProjId);
        
        // If the execution has finished or was cancelled, we stop waiting
        if (currentStatus === "SUCCESS" || currentStatus === "FAILED" || currentStatus === "CANCELLED") {
          console.log(`[QA Runner] Pipeline execution ended with status: ${currentStatus} without generating a test plan.`);
          sendReport(currentProjId, true, ["No test scripts found. Pipeline ended."], []);
          return;
        }

        // If the status is QA_LOOP (meaning we are ready to test) and we still have no test file,
        // we break the loop and create a default test file rather than waiting indefinitely.
        if (currentStatus === "QA_LOOP" && files.length > 0) {
          console.log(`[QA Runner] Pipeline is in QA_LOOP but no test plan file was generated. Creating default test script...`);
          const isPython = files.some(f => f.name.endsWith(".py") || f.name === "requirements.txt");
          const defaultTestName = isPython ? "test.py" : "test.js";
          testFile = { name: defaultTestName, content: "# Placeholder test suite" };
          files.push(testFile);
          break;
        }

        console.log(`[QA Runner] Awaiting creation of test plan/script file for ${currentProjId}... (Current status: ${currentStatus || "unknown"})`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        files = await downloadWorkspaceFiles(currentProjId);
        testFile = findTestFile(files);
      }
      console.log(`[QA Runner] Test plan/script found: ${testFile.name}. Proceeding to local testing sandbox...`);
    }

    // Prepare local sandbox folder
    const sandboxDir = path.join(__dirname, "../sandbox", currentProjId);
    if (fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
    fs.mkdirSync(sandboxDir, { recursive: true });

    console.log(`[2/3] Writing files to local sandbox: ${sandboxDir}`);
    files.forEach(file => {
      const filePath = path.join(sandboxDir, file.name);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, file.content);
      console.log(`  -> Wrote ${file.name}`);
    });

    // Locate application entry point and verify startup
    const mainFile = files.find(f => f.name === "main.py" || f.name === "main.js" || f.name === "index.js" || f.name === "app/main.py" || f.name === "app/main.js");
    if (mainFile) {
      const hasUv = await new Promise<boolean>((resolve) => {
        exec("command -v uv", (err) => resolve(!err));
      });
      const startupResult = await verifyApplicationStartup(sandboxDir, mainFile.name, hasUv);
      if (!startupResult.success) {
        console.error(`\n❌ QA Runner: Application failed to start!`);
        console.error(startupResult.errorMsg);
        
        sendReport(currentProjId, false, startupResult.logs, [startupResult.errorMsg]);
        
        if (fixAttempts >= MAX_FIX_ATTEMPTS) {
          console.error(`\n❌ QA Runner: Exceeded maximum fix attempts (${MAX_FIX_ATTEMPTS}). Halting self-healing loop.`);
          return;
        }

        fixAttempts++;
        console.log(`[QA Runner] (Attempt ${fixAttempts}/${MAX_FIX_ATTEMPTS}) Waiting for Developer Agent to analyze logs and apply fixes...`);
        await pollForStatus("QA_LOOP", currentProjId);
        console.log(`[QA Runner] Developer Agent has applied fixes! Re-triggering QA test suite run...`);
        executeQA(currentProjId);
        return;
      }
      console.log(`\n[QA Runner] Application startup verified successfully. Proceeding to AI QA Agent assertions testing...\n`);
    }

    console.log(`[3/3] Locating and executing test script assertions...`);

    const ext = testFile.name.endsWith(".js") ? "js" : "py";
    const aiTestContent = await generateAIAssertions(files, testFile.name, ext, currentProjId);
    if (aiTestContent) {
      const testFilePath = path.join(sandboxDir, testFile.name);
      fs.writeFileSync(testFilePath, aiTestContent);
      console.log(`[QA Agent] Overwrote mock runner with AI assertions inside: ${testFile.name}`);
    }

    let command = "";
    if (testFile.name.endsWith(".js")) {
      command = `node "${path.join(sandboxDir, testFile.name)}"`;
    } else {
      const hasUv = await new Promise<boolean>((resolve) => {
        exec("command -v uv", (err) => resolve(!err));
      });
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

    console.log(`Executing QA command: ${command}`);

    let child: any = null;
    let isRestarting = false;
    const testFilePath = path.join(sandboxDir, testFile.name);

    const fileWatcher = fs.watch(testFilePath, (eventType) => {
      if (eventType === "change" && !isRestarting) {
        console.log(`\n[QA Runner] Detect update to test plan file: ${testFile.name}. Restarting test plan...`);
        isRestarting = true;
        if (child) {
          try {
            child.kill("SIGTERM");
          } catch (e) {}
        }
        fileWatcher.close();
        setTimeout(() => {
          executeQA(currentProjId);
        }, 1000);
      }
    });

    child = exec(command, {
      cwd: sandboxDir,
      env: {
        ...process.env,
        PYTHONPATH: sandboxDir
      }
    }, async (error, stdout, stderr) => {
      if (isRestarting) {
        return;
      }
      fileWatcher.close();

      const logs = stdout.split("\n").filter(Boolean);
      const errors = stderr.split("\n").filter(Boolean);

      // Save stdout/stderr logs locally to the generated project directory for review and commit
      try {
        const genLogDir = path.join(__dirname, "../../../generated", currentProjId);
        if (fs.existsSync(genLogDir)) {
          const logContent = `========================================\n Valkyrie QA Runner Execution Log\n Project: ${currentProjId}\n Timestamp: ${new Date().toISOString()}\n Attempt: ${fixAttempts}\n Command: ${command}\n Status: ${error ? "FAILED" : "PASSED"}\n========================================\n\n[STDOUT]\n${stdout}\n\n[STDERR]\n${stderr || (error ? error.message : "")}\n`;
          fs.writeFileSync(path.join(genLogDir, "qa_runner.log"), logContent, "utf-8");
          console.log(`[QA Agent] QA Execution logs successfully saved to: generated/${currentProjId}/qa_runner.log`);
        }
      } catch (logErr: any) {
        console.error("[QA Agent] Failed to write local log file:", logErr.message);
      }

      if (error) {
        console.error(`\n❌ QA Suite Failure reported!`);
        console.error(stderr || error.message);
        errors.push(error.message);
        sendReport(currentProjId, false, logs, errors);

        if (fixAttempts >= MAX_FIX_ATTEMPTS) {
          console.error(`\n❌ QA Runner: Exceeded maximum fix attempts (${MAX_FIX_ATTEMPTS}). Halting self-healing loop.`);
          return;
        }

        fixAttempts++;
        console.log(`[QA Runner] (Attempt ${fixAttempts}/${MAX_FIX_ATTEMPTS}) Waiting for Developer Agent to analyze logs and apply fixes...`);
        await pollForStatus("QA_LOOP", currentProjId);
        console.log(`[QA Runner] Developer Agent has applied fixes! Re-triggering QA test suite run...`);
        // Recurse to run the updated codebase
        executeQA(currentProjId);
      } else {
        console.log(`\n✅ QA Suite Success! All assertions verified for project ${currentProjId}.`);
        console.log(stdout);
        sendReport(currentProjId, true, logs, errors);
      }
    });

  } catch (err: any) {
    console.error(`\nQA Execution aborted:`, err.message);
  }
}

async function startGlobalQaDaemon() {
  console.log(`===============================================`);
  console.log(` Valkyrie Dynamic QA Daemon v1.0.0`);
  console.log(` Mode: Global Multi-Project Listener`);
  console.log(` Central Orchestrator: ${orchestratorUrl}`);
  console.log(`===============================================`);
  console.log(`[QA Daemon] Monitoring orchestrator for active projects in QA_LOOP...`);

  const activeProcessing = new Set<string>();

  while (true) {
    try {
      const url = `${orchestratorUrl}/api/projects`;
      const response = await fetch(url);
      if (response.ok) {
        const projects = await response.json() as any[];
        const pendingProjects = projects.filter(p => p.status === "QA_LOOP" && !activeProcessing.has(p.id));

        for (const proj of pendingProjects) {
          console.log(`\n[QA Daemon] 🎯 Picked up project '${proj.name}' (${proj.id}) in QA_LOOP! Executing test suite...`);
          activeProcessing.add(proj.id);
          try {
            await executeQA(proj.id);
          } catch (e: any) {
            console.error(`[QA Daemon] Error processing ${proj.id}:`, e.message);
          } finally {
            activeProcessing.delete(proj.id);
          }
        }
      }
    } catch (err: any) {
      // Quiet retry when orchestrator is starting up
    }
    await new Promise(resolve => setTimeout(resolve, 4000));
  }
}

if (!isMcp) {
  if (explicitProjectId) {
    console.log(`===============================================`);
    console.log(` Valkyrie Local QA Runner CLI v1.0.0`);
    console.log(` Target Project: ${explicitProjectId}`);
    console.log(` Central Orchestrator: ${orchestratorUrl}`);
    console.log(`===============================================`);
    executeQA(explicitProjectId);
  } else {
    startGlobalQaDaemon();
  }
} else {
  // Start the lightweight MCP server inside the QA Runner package
  import("./mcp").then((mcp) => {
    mcp.startMcpServer();
  });
}
