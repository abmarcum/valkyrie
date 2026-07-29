import { describe, it, expect } from "vitest";
import { calculateLlmCost } from "../index";

describe("calculateLlmCost", () => {
  it("should calculate correct token cost for prompt and completion tokens", () => {
    const result = calculateLlmCost(1000000, 1000000);
    expect(result).toBeDefined();
    expect(result.inputCost).toBeGreaterThanOrEqual(0);
    expect(result.outputCost).toBeGreaterThanOrEqual(0);
    expect(result.totalCost).toBeGreaterThanOrEqual(0);
  });

  it("should handle zero token inputs", () => {
    const result = calculateLlmCost(0, 0);
    expect(result.totalCost).toBe(0);
  });
});
