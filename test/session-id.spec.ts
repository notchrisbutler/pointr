import { describe, expect, it } from "vitest";
import { isValidSessionId, normalizeSessionId } from "../src/session-id";

describe("session id helpers", () => {
  it("accepts exactly five alphanumeric characters regardless of case", () => {
    expect(isValidSessionId("abc12")).toBe(true);
    expect(isValidSessionId("AbC12")).toBe(true);
    expect(isValidSessionId("ZZ999")).toBe(true);
  });

  it("rejects values that are too short, too long, or contain symbols", () => {
    expect(isValidSessionId("abc1")).toBe(false);
    expect(isValidSessionId("abcdef")).toBe(false);
    expect(isValidSessionId("ab$12")).toBe(false);
    expect(isValidSessionId("")).toBe(false);
  });

  it("normalizes valid ids to lowercase", () => {
    expect(normalizeSessionId("AbC12")).toBe("abc12");
    expect(normalizeSessionId("ZZ999")).toBe("zz999");
  });
});
