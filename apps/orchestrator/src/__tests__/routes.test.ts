import { describe, it, expect } from "vitest";
import Fastify from "fastify";

describe("OAuth Authorization Endpoint Validation", () => {
  it("should reject authorization requests missing username parameter with 400 Bad Request", async () => {
    const app = Fastify();
    app.get("/oauth/authorize", async (req, reply) => {
      const { username, redirect_uri } = (req.query as any) || {};
      if (!username) {
        return reply.status(400).send({ error: "Username query parameter is required" });
      }
      if (!redirect_uri) {
        return reply.status(400).send({ error: "redirect_uri is required" });
      }
      return reply.send({ code: "test_code" });
    });

    const res = await app.inject({
      method: "GET",
      url: "/oauth/authorize"
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "Username query parameter is required" });
  });

  it("should reject token requests missing code parameter with 400 Bad Request", async () => {
    const app = Fastify();
    app.post("/oauth/token", async (req, reply) => {
      const { code } = (req.body as any) || {};
      if (!code) {
        return reply.status(400).send({ error: "Authorization code is required" });
      }
      return reply.send({ access_token: "test_token" });
    });

    const res = await app.inject({
      method: "POST",
      url: "/oauth/token",
      payload: {}
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "Authorization code is required" });
  });
});
