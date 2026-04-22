import { describe, expect, it } from "vitest";
import { chooseCanonicalName, findReconnectCandidate } from "../src/session-identity";

describe("session identity helpers", () => {
  it("keeps the existing canonical name for reconnects", () => {
    const players = [{ clientId: "client-1", name: "🦊", vote: null, isObserver: false }];

    expect(
      chooseCanonicalName({ requestedName: "", existingPlayer: players[0], players })
    ).toBe("🦊");
  });

  it("suffixes colliding names for different client ids", () => {
    const players = [{ clientId: "client-1", name: "Alice", vote: null, isObserver: false }];

    expect(
      chooseCanonicalName({ requestedName: "Alice", existingPlayer: null, players })
    ).toBe("Alice 2");
  });

  it("matches reconnects by client id instead of display name", () => {
    const players = [{ clientId: "client-1", name: "🦊", vote: 5, isObserver: false }];

    expect(findReconnectCandidate(players, "client-1")?.name).toBe("🦊");
    expect(findReconnectCandidate(players, "client-2")).toBeUndefined();
  });

  it("uses the provided random fallback for anonymous names", () => {
    expect(
      chooseCanonicalName({
        requestedName: "",
        existingPlayer: null,
        players: [],
        createFallbackName: () => "🚀",
      })
    ).toBe("🚀");
  });
});
