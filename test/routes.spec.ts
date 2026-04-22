import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("worker routes", () => {
  it("serves the home page", async () => {
    const response = await SELF.fetch("http://example.com/");

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Pointr");
  });
});
