import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { loadDotenv } from "../index";

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
