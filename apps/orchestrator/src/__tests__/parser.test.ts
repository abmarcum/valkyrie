import { describe, it, expect } from "vitest";
import { isValidFilePath, stripCritiqueHeaders } from "../index";

describe("isValidFilePath", () => {
  it("should return true for valid code file paths", () => {
    expect(isValidFilePath("src/index.ts")).toBe(true);
    expect(isValidFilePath("package.json")).toBe(true);
    expect(isValidFilePath("Dockerfile")).toBe(true);
    expect(isValidFilePath("main.go")).toBe(true);
    expect(isValidFilePath("data/schema.sql")).toBe(true);
  });

  it("should reject path traversal attempts and invalid markdown titles", () => {
    expect(isValidFilePath("../secret.env")).toBe(false);
    expect(isValidFilePath("## Markdown Title")).toBe(false);
    expect(isValidFilePath("")).toBe(false);
    expect(isValidFilePath("- bullet point")).toBe(false);
  });
});

describe("stripCritiqueHeaders", () => {
  it("should strip Cohere AI Quality Audit metadata from prompt strings", () => {
    const raw = "System Architecture Content\n\n--- Cohere AI Quality Audit ---\nSome audit text";
    const cleaned = stripCritiqueHeaders(raw);
    expect(cleaned).toBe("System Architecture Content");
  });
});
