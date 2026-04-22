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

  it("serves the home page with the DOM anchors the browser client expects", async () => {
    const response = await SELF.fetch("http://example.com/");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('id="sessionId"');
    expect(html).toContain('id="join-session-btn"');
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

  it("serves the session route with the DOM anchors the browser client expects", async () => {
    const response = await SELF.fetch("http://example.com/abc123");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<body data-session-id="abc123">');
    expect(html).toContain('id="lobby"');
    expect(html).toContain('id="story-setup" class="hidden"');
    expect(html).toContain('id="session" class="hidden"');
    expect(html).toContain('id="name-input"');
    expect(html).toContain('id="join-player-btn"');
    expect(html).toContain('id="join-observer-btn"');
    expect(html).toContain('id="join-count"');
    expect(html).toContain('id="story-add-input"');
    expect(html).toContain('id="story-add-btn"');
    expect(html).toContain('id="story-list-items"');
    expect(html).toContain('id="story-start-btn"');
    expect(html).toContain('id="story-nav"');
    expect(html).toContain('id="story-prev-btn"');
    expect(html).toContain('id="story-next-btn"');
    expect(html).toContain('id="story-progress"');
    expect(html).toContain('id="session-id-copy"');
    expect(html).toContain('id="timer-voting"');
    expect(html).toContain('id="timer-discussion"');
    expect(html).toContain('id="story"');
    expect(html).toContain('id="cards-row"');
    expect(html).toContain('id="show-votes-btn"');
    expect(html).toContain('id="new-round-btn"');
    expect(html).toContain('id="results-row"');
    expect(html).toContain('id="final-cards"');
    expect(html).toContain('id="stat-average"');
    expect(html).toContain('id="stat-median"');
    expect(html).toContain('id="stat-votes"');
    expect(html).toContain('id="players-count"');
    expect(html).toContain('id="players-list"');
    expect(html).toContain('id="toast"');
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
