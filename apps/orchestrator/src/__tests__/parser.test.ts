import { describe, it, expect } from "vitest";
import { isValidFilePath, stripCritiqueHeaders, extractJsonBlock } from "../index";

describe("isValidFilePath", () => {
  it("should return true for valid code and infrastructure file paths", () => {
    expect(isValidFilePath("src/index.ts")).toBe(true);
    expect(isValidFilePath("package.json")).toBe(true);
    expect(isValidFilePath("Dockerfile")).toBe(true);
    expect(isValidFilePath("main.go")).toBe(true);
    expect(isValidFilePath("data/schema.sql")).toBe(true);
    expect(isValidFilePath("terraform/main.tf")).toBe(true);
    expect(isValidFilePath("terraform.tfvars")).toBe(true);
    expect(isValidFilePath("deploy/config.hcl")).toBe(true);
  });

  it("should reject path traversal attempts, equals signs, and invalid markdown titles", () => {
    expect(isValidFilePath("../secret.env")).toBe(false);
    expect(isValidFilePath("## Markdown Title")).toBe(false);
    expect(isValidFilePath("from-file=config.yaml=./config.yaml")).toBe(false);
    expect(isValidFilePath("")).toBe(false);
    expect(isValidFilePath("- bullet point")).toBe(false);
  });

  it("should reject bogus uppercase inline backtick references like pkg/types.UUID", () => {
    expect(isValidFilePath("pkg/types.UUID")).toBe(false);
    expect(isValidFilePath("models/User.SCHEMA")).toBe(false);
  });

  it("should reject paths where a code extension or single-file root name is used as an intermediate directory", () => {
    expect(isValidFilePath("main.go/proxy.go")).toBe(false);
    expect(isValidFilePath("go.mod/main.go")).toBe(false);
    expect(isValidFilePath("package.json/index.ts")).toBe(false);
    expect(isValidFilePath("Dockerfile/build.sh")).toBe(false);
  });

  it("should reject URLs and domain hostnames", () => {
    expect(isValidFilePath("https://example.com/file.go")).toBe(false);
    expect(isValidFilePath("github.com/pkg/errors")).toBe(false);
    expect(isValidFilePath("https:")).toBe(false);
  });
});

describe("extractJsonBlock", () => {
  it("should extract JSON block wrapped in LLM commentary and markdown code blocks", () => {
    const raw = "Here is the requested manifest:\n```json\n{\n  \"files\": [\"main.go\"]\n}\n```\nHope this helps!";
    const extracted = extractJsonBlock(raw);
    expect(extracted).toBe('{\n  "files": ["main.go"]\n}');
    expect(JSON.parse(extracted)).toEqual({ files: ["main.go"] });
  });

  it("should strip single line comments and trailing commas", () => {
    const raw = "```json\n{\n  // Manifest list\n  \"files\": [\"main.go\",],\n}\n```";
    const extracted = extractJsonBlock(raw);
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
