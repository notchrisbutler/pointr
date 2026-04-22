import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {}
}

describe("worker routes", () => {
  it("serves the home page", async () => {
    const response = await SELF.fetch("http://example.com/");

    expect(response.status).toBe(200);
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
});
