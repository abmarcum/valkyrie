import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";

describe("JWT Auth Cycle", () => {
  const secret = "test_jwt_secret_key_12345";

  it("should sign and verify valid user tokens", () => {
    const payload = { id: "user-123", username: "alice", role: "developer", tenantId: "acme-corp" };
    const token = jwt.sign(payload, secret, { expiresIn: "1h" });

    const decoded = jwt.verify(token, secret) as any;
    expect(decoded.id).toBe("user-123");
    expect(decoded.username).toBe("alice");
    expect(decoded.role).toBe("developer");
    expect(decoded.tenantId).toBe("acme-corp");
  });

  it("should reject tampered JWT tokens", () => {
    const token = jwt.sign({ id: "user-123" }, secret);
    const tampered = token + "bad";

    expect(() => {
      jwt.verify(tampered, secret);
    }).toThrow();
  });
});
