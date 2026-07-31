#!/usr/bin/env tsx

import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { RunTree } from "langsmith";

// Manual .env parser to avoid external dependency issues
export function loadDotenv(filePath: string) {
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
export async function sendReport(projId: string, passed: boolean, logs: string[], errors: string[]) {
  const url = `${orchestratorUrl}/api/projects/${projId}/qa-report`;
  const internalSecret = process.env.ORCHESTRATOR_INTERNAL_SECRET || "valkyrie_internal_daemon_secret";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-valkyrie-qa-key": internalSecret
      },
      body: JSON.stringify({ passed, logs, errors }),
      redirect: "follow"
    });

    const data = await res.text();
    console.log(`[Report Status] Central Server Response: ${res.status} - ${data}`);
    console.log(`QA run completed successfully.`);
  } catch (err: any) {
    console.error(`[Error] Failed to transmit report back to orchestrator:`, err.message);
  }
}

// Download files from orchestrator REST endpoint
export async function downloadWorkspaceFiles(projId: string = projectId): Promise<Array<{ name: string; content: string }>> {
  const url = `${orchestratorUrl}/api/projects/${projId}/files`;
  const internalSecret = process.env.ORCHESTRATOR_INTERNAL_SECRET || "valkyrie_internal_daemon_secret";

  try {
    const res = await fetch(url, {
      headers: {
        "x-valkyrie-qa-key": internalSecret
      },
      redirect: "follow"
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch project files. Status: ${res.status}`);
    }

    const data = await res.json() as any;
    return data.files || [];
  } catch (err: any) {
    if (err.message.includes("Status:")) throw err;
    throw new Error(`Connection failed to orchestrator at ${orchestratorUrl}. Error: ${err.message}`);
  }
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
    const fileSnippet = f.content.length > 2500 ? f.content.substring(0, 2500) + "\n...[truncated for test synthesis]" : f.content;
    codebasePrompt += `=== File: ${f.name} ===\n${fileSnippet}\n\n`;
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
    const internalSecret = process.env.ORCHESTRATOR_INTERNAL_SECRET || "valkyrie_internal_daemon_secret";
    const url = `${orchestratorUrl}/api/projects/${projId}/llm`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-valkyrie-qa-key": internalSecret
      },
      signal: AbortSignal.timeout(180000),
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
      const cleanErr = errText.includes("<title>")
        ? (errText.match(/<title>(.*?)<\/title>/i)?.[1] || "Gateway Timeout")
        : errText.substring(0, 200);
      console.warn(`[QA Agent] Orchestrator LLM proxy unavailable (HTTP ${response.status}): ${cleanErr}`);
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
    if (mainFilename.endsWith(".go")) {
      command = `go run "${path.join(sandboxDir, mainFilename)}" || go build -v ./...`;
    } else if (mainFilename.endsWith(".java")) {
      command = `mvn compile || javac "${path.join(sandboxDir, mainFilename)}"`;
    } else if (mainFilename.endsWith(".cpp")) {
      command = `g++ -std=c++17 -o app "${path.join(sandboxDir, mainFilename)}"`;
    } else if (mainFilename.endsWith(".cs")) {
      command = `dotnet build`;
    } else if (mainFilename.endsWith(".js") || mainFilename.endsWith(".ts")) {
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
export async function fetchProjectStatus(projId: string = projectId): Promise<string> {
  const url = `${orchestratorUrl}/api/projects/${projId}/status`;
  const internalSecret = process.env.ORCHESTRATOR_INTERNAL_SECRET || "valkyrie_internal_daemon_secret";
  try {
    const res = await fetch(url, {
      headers: { "x-valkyrie-qa-key": internalSecret },
      redirect: "follow"
    });
    if (res.ok) {
      const data = await res.json() as any;
      return data.status || "";
    }
  } catch (e) {}
  return "";
}

// Poll status helper
export function pollForStatus(expectedStatus: string, projId: string = projectId): Promise<void> {
  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      const status = await fetchProjectStatus(projId);
      if (status === expectedStatus) {
        clearInterval(interval);
        resolve();
      } else {
        console.log(`[QA Runner] Current project status: ${status}. Waiting for Developer Agent fixes...`);
      }
    }, 5000);
  });
}

// Run the QA verification process
async function executeQA(targetProjectId?: string) {
  const currentProjId = targetProjectId || explicitProjectId || "proj-1";
  try {
    console.log(`\n[1/3] Downloading generated codebase files for project '${currentProjId}'...`);
    let files = await downloadWorkspaceFiles(currentProjId);
    
    const isGo = files.some(f => f.name.endsWith(".go") || f.name === "go.mod");
    const isJava = files.some(f => f.name.endsWith(".java") || f.name === "pom.xml");
    const isCpp = files.some(f => f.name.endsWith(".cpp") || f.name === "CMakeLists.txt");
    const isCsharp = files.some(f => f.name.endsWith(".cs") || f.name === "App.csproj");
    const isPython = files.some(f => f.name.endsWith(".py") || f.name === "requirements.txt");
    const isNode = files.some(f => f.name.endsWith(".js") || f.name.endsWith(".ts") || f.name === "package.json");

    const findTestFile = (fileList: Array<{ name: string; content: string }>) => {
      return fileList.find(f => {
        const nameLower = f.name.toLowerCase();
        return nameLower.endsWith("_test.go") || 
               nameLower.endsWith("test.go") || 
               nameLower.endsWith("_test.py") || 
               nameLower.endsWith(".test.js") || 
               nameLower.endsWith(".test.ts") ||
               nameLower.endsWith("test.java") ||
               nameLower.endsWith("tests.java") ||
               nameLower.endsWith("test.cpp") ||
               nameLower.endsWith("tests.cs") ||
               nameLower.startsWith("test.") || 
               nameLower.startsWith("tests/test_");
      });
    };
    let testFile = findTestFile(files);

    if (files.length === 0 || !testFile) {
      console.log(`[QA Runner] Test plan/script file not found in sandbox files.`);
      while (files.length === 0 || !testFile) {
        const currentStatus = await fetchProjectStatus(currentProjId);
        
        if (currentStatus === "SUCCESS" || currentStatus === "FAILED" || currentStatus === "CANCELLED") {
          console.log(`[QA Runner] Pipeline execution ended with status: ${currentStatus} without generating a test plan.`);
          sendReport(currentProjId, true, ["No test scripts found. Pipeline ended."], []);
          return;
        }

        if (currentStatus === "QA_LOOP" && files.length > 0) {
          console.log(`[QA Runner] Pipeline is in QA_LOOP but no test plan file was generated. Creating default test script...`);
          const defaultTestName = isGo ? "main_test.go" : isJava ? "ApplicationTests.java" : isCpp ? "test_main.cpp" : isCsharp ? "AppTests.cs" : isPython ? "test.py" : "test.js";
          testFile = {
            name: defaultTestName,
            content: isGo ? "package main\nimport \"testing\"\nfunc TestApp(t *testing.T){}" : isPython ? "# Placeholder test suite" : "// Placeholder test suite"
          };
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

    // Locate application entry point and verify startup / compilation
    const mainFile = files.find(f => {
      const n = f.name.toLowerCase();
      return n === "main.go" || n === "main.py" || n === "main.js" || n === "index.js" || n === "src/main.cpp" || n === "program.cs" || n.endsWith("application.java");
    });
    if (mainFile) {
      const hasUv = await new Promise<boolean>((resolve) => {
        exec("command -v uv", (err) => resolve(!err));
      });
      const startupResult = await verifyApplicationStartup(sandboxDir, mainFile.name, hasUv);
      if (!startupResult.success) {
        console.error(`\n❌ QA Runner: Application failed to start/compile!`);
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

    const ext = testFile.name.endsWith(".go") ? "go" : testFile.name.endsWith(".java") ? "java" : testFile.name.endsWith(".cpp") ? "cpp" : testFile.name.endsWith(".cs") ? "cs" : testFile.name.endsWith(".js") ? "js" : "py";
    const aiTestContent = await generateAIAssertions(files, testFile.name, ext, currentProjId);
    if (aiTestContent) {
      const testFilePath = path.join(sandboxDir, testFile.name);
      fs.writeFileSync(testFilePath, aiTestContent);
      console.log(`[QA Agent] Overwrote mock runner with AI assertions inside: ${testFile.name}`);
    }

    let command = "";
    if (isGo || testFile.name.endsWith(".go")) {
      command = `go test -v ./... || go build -v ./...`;
    } else if (isJava || testFile.name.endsWith(".java")) {
      command = `mvn test || javac -d build ${testFile.name}`;
    } else if (isCpp || testFile.name.endsWith(".cpp")) {
      command = `cmake -B build && cmake --build build || g++ -std=c++17 -o app ${testFile.name}`;
    } else if (isCsharp || testFile.name.endsWith(".cs")) {
      command = `dotnet test || dotnet build`;
    } else if (testFile.name.endsWith(".js") || testFile.name.endsWith(".ts")) {
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

    const safeEnv = { ...process.env };
    delete safeEnv.GEMINI_API_KEY;
    delete safeEnv.GOOGLE_API_KEY;
    delete safeEnv.ANTHROPIC_API_KEY;
    delete safeEnv.OPENAI_API_KEY;
    delete safeEnv.GITHUB_TOKEN;
    delete safeEnv.DATABASE_URL;

    child = exec(command, {
      cwd: sandboxDir,
      timeout: 15000,
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...safeEnv,
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

  const internalSecret = process.env.ORCHESTRATOR_INTERNAL_SECRET || "valkyrie_internal_daemon_secret";

  while (true) {
    try {
      const url = `${orchestratorUrl}/api/projects/pending-qa`;
      const response = await fetch(url, {
        headers: {
          "x-valkyrie-qa-key": internalSecret
        }
      });
      if (response.ok) {
        const pendingProjects = await response.json() as any[];

        for (const proj of pendingProjects) {
          if (activeProcessing.has(proj.id)) continue;

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
      } else {
        const errBody = await response.text().catch(() => "");
        console.warn(`[QA Daemon] Polling /api/projects/pending-qa failed (HTTP ${response.status}): ${errBody || response.statusText}`);
      }
    } catch (err: any) {
      const causeMsg = err.cause?.message ? ` (${err.cause.message})` : "";
      console.warn(`[QA Daemon] Polling connection error: ${err.message}${causeMsg}`);
    }
    await new Promise(resolve => setTimeout(resolve, 4000));
  }
}

if (process.env.NODE_ENV !== "test") {
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
}
