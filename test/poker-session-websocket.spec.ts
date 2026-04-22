import { describe, expect, it } from "vitest";
import { nextJsonMessage, openSessionSocket } from "./helpers/websocket";

describe("poker session websocket reconnects", () => {
  it("keeps one logical player for blank-name reconnects", async () => {
    const first = await openSessionSocket("rejoin01");
    first.send(JSON.stringify({ type: "join", clientId: "client-1", name: "", isObserver: false }));

    const joinedFirst = await nextJsonMessage(first);
    const stateFirst = await nextJsonMessage(first);

    expect(joinedFirst.type).toBe("joined");
    expect(stateFirst.players).toHaveLength(1);

    const second = await openSessionSocket("rejoin01");
    second.send(JSON.stringify({ type: "join", clientId: "client-1", name: "", isObserver: false }));

    const joinedSecond = await nextJsonMessage(second);
    const stateSecond = await nextJsonMessage(second);

    expect(joinedSecond.name).toBe(joinedFirst.name);
    expect(stateSecond.players).toHaveLength(1);
    expect(stateSecond.players[0].name).toBe(joinedFirst.name);
  });
});
