import { describe, it, expect } from "vitest";
import { isValidFilePath, stripCritiqueHeaders, extractJsonBlock } from "../index";

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

  it("should reject bogus uppercase inline backtick references like pkg/types.UUID", () => {
    expect(isValidFilePath("pkg/types.UUID")).toBe(false);
    expect(isValidFilePath("models/User.SCHEMA")).toBe(false);
  });
});

describe("extractJsonBlock", () => {
  it("should extract JSON block wrapped in LLM commentary and markdown code blocks", () => {
    const raw = "Here is the requested manifest:\n```json\n{\n  \"files\": [\"main.go\"]\n}\n```\nHope this helps!";
    const extracted = extractJsonBlock(raw);
    expect(extracted).toBe('{\n  "files": ["main.go"]\n}');
    expect(JSON.parse(extracted)).toEqual({ files: ["main.go"] });
  });
});

describe("stripCritiqueHeaders", () => {
  it("should strip Cohere AI Quality Audit metadata from prompt strings", () => {
    const raw = "System Architecture Content\n\n--- Cohere AI Quality Audit ---\nSome audit text";
    const cleaned = stripCritiqueHeaders(raw);
    expect(cleaned).toBe("System Architecture Content");
  });
});
