import { describe, it, expect } from "vitest";
import { prisma } from "../index";

describe("packages/db Prisma Client Export", () => {
  it("should export a defined Prisma client instance", () => {
    expect(prisma).toBeDefined();
    expect(typeof prisma.tenant.findMany).toBe("function");
    expect(typeof prisma.project.findMany).toBe("function");
    expect(typeof prisma.agentRun.findMany).toBe("function");
  });
});
