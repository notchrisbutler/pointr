import { describe, expect, it } from "vitest";
import {
  applyJoinedPayload,
  getClientStorageKey,
  getOrCreateClientId,
  shouldReconnect,
} from "../src/client-helpers";
import { CLIENT_JS } from "../src/client";

describe("client helpers", () => {
  it("reuses an existing client id for the same session", () => {
    const storage = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
    };

    const first = getOrCreateClientId(localStorage, "abc123", () => "client-1");
    const second = getOrCreateClientId(localStorage, "abc123", () => "client-2");

    expect(first).toBe("client-1");
    expect(second).toBe("client-1");
    expect(getClientStorageKey("abc123")).toBe("pointr:session:abc123:clientId");
  });

  it("only reconnects for the active socket generation", () => {
    expect(
      shouldReconnect({ timedOut: false, closeCode: 1000, socketGeneration: 3, activeGeneration: 3 })
    ).toBe(true);

    expect(
      shouldReconnect({ timedOut: false, closeCode: 1000, socketGeneration: 2, activeGeneration: 3 })
    ).toBe(false);

    expect(
      shouldReconnect({ timedOut: true, closeCode: 1000, socketGeneration: 3, activeGeneration: 3 })
    ).toBe(false);
  });

  it("applies the joined acknowledgement as authoritative self state", () => {
    expect(
      applyJoinedPayload(
        { clientId: "", name: "", amHost: false, isObserver: false },
        { type: "joined", clientId: "client-9", name: "🦊", isHost: true, isObserver: false }
      )
    ).toEqual({ clientId: "client-9", name: "🦊", amHost: true, isObserver: false });
  });

  it("serializes getOrCreateClientId without hidden helper dependencies", () => {
    expect(getOrCreateClientId.toString()).not.toContain("getClientStorageKey(");
  });

  it("uses tab-scoped sessionStorage for browser client identity", () => {
    expect(CLIENT_JS).toContain("sessionStorage");
    expect(CLIENT_JS).not.toContain("localStorage");
  });
});
