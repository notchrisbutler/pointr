import { beforeEach, describe, expect, it } from "vitest";
import { HOME_CLIENT_JS } from "../src/home-client";

type TestGlobalScope = {
  document?: { documentElement: { innerHTML: string }; getElementById(id: string): unknown };
  navigator?: { userAgent: string };
  location?: { href: string };
};

describe("home client", () => {
  beforeEach(() => {
    delete (globalThis as TestGlobalScope).document;
    delete (globalThis as TestGlobalScope).navigator;
    delete (globalThis as TestGlobalScope).location;
  });

  it("shows the inline validation message for empty join attempts", () => {
    const harness = createHomeClientHarness();

    harness.joinButton.dispatch("click");

    expect(harness.sessionError.textContent).toBe(
      "Session IDs must be 5 letters or numbers.",
    );
    expect(harness.sessionError.classList.contains("hidden")).toBe(false);
    expect(harness.focusCalls).toBe(1);
    expect(harness.location.href).toBe("http://example.com/");
  });

  it("validates live input and clears the message when the value becomes valid", () => {
    const harness = createHomeClientHarness();

    harness.sessionInput.value = "abc!";
    harness.sessionInput.dispatch("input");
    expect(harness.sessionError.classList.contains("hidden")).toBe(false);

    harness.sessionInput.value = "AbC12";
    harness.sessionInput.dispatch("input");

    expect(harness.sessionError.textContent).toBe(
      "Session IDs must be 5 letters or numbers.",
    );
    expect(harness.sessionError.classList.contains("hidden")).toBe(true);
  });

  it("normalizes valid ids to lowercase before navigation", () => {
    const harness = createHomeClientHarness();

    harness.sessionInput.value = "AbC12";
    harness.joinButton.dispatch("click");

    expect(harness.location.href).toBe("/abc12");
    expect(harness.sessionError.classList.contains("hidden")).toBe(true);
  });
});

function createHomeClientHarness() {
  const listeners = new Map<string, (event?: { key?: string; preventDefault(): void }) => void>();
  let focusCalls = 0;

  const sessionInput = {
    value: "",
    addEventListener(type: string, handler: (event?: { key?: string; preventDefault(): void }) => void) {
      listeners.set(`input:${type}`, handler);
    },
    dispatch(type: string, event: { key?: string; preventDefault(): void } = { preventDefault() {} }) {
      const handler = listeners.get(`input:${type}`);
      if (handler) {
        handler(event);
      }
    },
    focus() {
      focusCalls += 1;
    },
  };

  const joinButton = {
    addEventListener(type: string, handler: () => void) {
      listeners.set(`button:${type}`, handler);
    },
    dispatch(type: string) {
      const handler = listeners.get(`button:${type}`);
      if (handler) {
        handler();
      }
    },
  };

  const hiddenClasses = new Set(["hidden"]);
  const sessionError = {
    textContent: "Session IDs must be 5 letters or numbers.",
    classList: {
      add(className: string) {
        hiddenClasses.add(className);
      },
      remove(className: string) {
        hiddenClasses.delete(className);
      },
      contains(className: string) {
        return hiddenClasses.has(className);
      },
    },
  };

  const document = {
    documentElement: { innerHTML: "" },
    getElementById(id: string) {
      if (id === "sessionId") return sessionInput;
      if (id === "sessionId-error") return sessionError;
      if (id === "join-session-btn") return joinButton;
      return null;
    },
  };

  const navigator = { userAgent: "Desktop" };
  const location = { href: "http://example.com/" };

  Object.assign(globalThis, { document, navigator, location });
  new Function(HOME_CLIENT_JS)();

  return {
    sessionInput,
    joinButton,
    sessionError,
    location,
    get focusCalls() {
      return focusCalls;
    },
  };
}
