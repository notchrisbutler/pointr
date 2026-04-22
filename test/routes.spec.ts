import { SELF } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import app from "../src/index";

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {}
}

describe("worker routes", () => {
  it("serves the home page", async () => {
    const response = await SELF.fetch("http://example.com/");

    expect(response.status).toBe(200);
  });

  it("serves the home page without inline script execution", async () => {
    const response = await SELF.fetch("http://example.com/");
    const html = await response.text();

    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)/i);
    expect(html).not.toContain("onclick=");
    expect(html).toContain('<script src="/home.js"></script>');
  });

  it("rejects invalid info route ids before DO routing", async () => {
    const response = await SELF.fetch("http://example.com/api/INVALID!/info");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid session id" });
  });

  it("rejects invalid websocket ids before DO routing", async () => {
    const response = await SELF.fetch("http://example.com/ws/INVALID!", {
      headers: { Upgrade: "websocket" },
    });

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Invalid session id");
  });

  it("serves the session page without inline script execution", async () => {
    const response = await SELF.fetch("http://example.com/abc123");
    const html = await response.text();

    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)/i);
    expect(html).not.toContain("onclick=");
    expect(html).toContain('<script src="/client.js"></script>');
  });

  it("uses a route-scoped create rate-limit key", async () => {
    const { env, createLimit } = createTestEnv();

    const response = await app.request(
      "http://example.com/create",
      {
        method: "POST",
        headers: { "CF-Connecting-IP": "203.0.113.5" },
      },
      env,
    );

    expect(response.status).toBe(429);
    expect(createLimit).toHaveBeenCalledWith({ key: "create:203.0.113.5" });
  });

  it("uses a session-scoped info rate-limit key", async () => {
    const { env, infoLimit } = createTestEnv();

    const response = await app.request(
      "http://example.com/api/abc123/info",
      {
        headers: { "CF-Connecting-IP": "203.0.113.5" },
      },
      env,
    );

    expect(response.status).toBe(429);
    expect(infoLimit).toHaveBeenCalledWith({ key: "info:abc123:203.0.113.5" });
  });

  it("uses a session-scoped websocket rate-limit key", async () => {
    const { env, wsLimit } = createTestEnv();

    const response = await app.request(
      "http://example.com/ws/abc123",
      {
        headers: {
          "CF-Connecting-IP": "203.0.113.5",
          Upgrade: "websocket",
        },
      },
      env,
    );

    expect(response.status).toBe(429);
    expect(wsLimit).toHaveBeenCalledWith({ key: "ws:abc123:203.0.113.5" });
  });
});

function createTestEnv(): {
  env: Env;
  createLimit: ReturnType<typeof vi.fn>;
  infoLimit: ReturnType<typeof vi.fn>;
  wsLimit: ReturnType<typeof vi.fn>;
} {
  const createLimit = vi.fn().mockResolvedValue({ success: false });
  const infoLimit = vi.fn().mockResolvedValue({ success: false });
  const wsLimit = vi.fn().mockResolvedValue({ success: false });

  return {
    env: {
      RATE_LIMITER_CREATE: { limit: createLimit },
      RATE_LIMITER_INFO: { limit: infoLimit },
      RATE_LIMITER_WS: { limit: wsLimit },
      POKER_SESSION: {
        idFromName: vi.fn(),
        get: vi.fn(),
      },
    } as unknown as Env,
    createLimit,
    infoLimit,
    wsLimit,
  };
}
