import { describe, expect, it } from "vitest";
import { CLIENT_JS } from "../src/client";

describe("session client", () => {
  it("shows timeout actions for creating a new session or returning home", () => {
    const harness = createClientHarness();

    harness.joinPlayerButton.dispatch("click");
    harness.socket.receive({ type: "timeout" });

    const overlay = harness.document.getElementById("timeout-overlay");
    expect(overlay).toBeTruthy();

    const newSessionForm = harness.document.getElementById("timeout-new-session-form");
    expect(newSessionForm).toBeTruthy();
    expect(newSessionForm?.tagName).toBe("FORM");
    expect(newSessionForm?.action).toBe("/create");
    expect(newSessionForm?.method).toBe("POST");

    const homeLink = harness.document.findByText("Back to Home");
    expect(homeLink).toBeTruthy();
    expect(homeLink?.tagName).toBe("A");
    expect(homeLink?.href).toBe("/");

    const newSessionButton = harness.document.findByText("New Session");
    expect(newSessionButton).toBeTruthy();
    expect(newSessionButton?.tagName).toBe("BUTTON");
  });

  it("waits for a sessionReady state before transitioning from setup to session", () => {
    const harness = createClientHarness();

    harness.joinPlayerButton.dispatch("click");
    harness.socket.receive(buildStatePayload({ sessionReady: false }));

    expect(harness.storySetup.classList.contains("hidden")).toBe(false);
    expect(harness.session.classList.contains("hidden")).toBe(true);

    harness.storyStartButton.dispatch("click");

    expect(harness.socket.sentMessages.at(-1)).toEqual({ type: "skip-setup" });
    expect(harness.storySetup.classList.contains("hidden")).toBe(false);
    expect(harness.session.classList.contains("hidden")).toBe(true);

    harness.socket.receive(buildStatePayload({ sessionReady: true }));

    expect(harness.storySetup.classList.contains("hidden")).toBe(true);
    expect(harness.session.classList.contains("hidden")).toBe(false);
  });
});

type Listener = (event?: { key?: string; preventDefault(): void; target?: TestElement }) => void;

class TestElement {
  id = "";
  className = "";
  textContent = "";
  value = "";
  placeholder = "";
  readOnly = false;
  disabled = false;
  href = "";
  action = "";
  method = "";
  type = "";
  title = "";
  style = { display: "" };
  dataset: Record<string, string> = {};
  attributes: Record<string, string> = {};
  children: TestElement[] = [];
  parentElement: TestElement | null = null;
  listeners = new Map<string, Listener[]>();

  constructor(readonly tagName: string, private documentRef: TestDocument) {}

  classList = {
    add: (...classNames: string[]) => {
      const classes = new Set(this.className.split(/\s+/).filter(Boolean));
      classNames.forEach((className) => classes.add(className));
      this.className = Array.from(classes).join(" ");
    },
    remove: (...classNames: string[]) => {
      const classes = new Set(this.className.split(/\s+/).filter(Boolean));
      classNames.forEach((className) => classes.delete(className));
      this.className = Array.from(classes).join(" ");
    },
    contains: (className: string) => this.className.split(/\s+/).filter(Boolean).includes(className),
    toggle: (className: string, force?: boolean) => {
      const hasClass = this.className.split(/\s+/).filter(Boolean).includes(className);
      const shouldHaveClass = force ?? !hasClass;
      if (shouldHaveClass) {
        this.classList.add(className);
      } else {
        this.classList.remove(className);
      }
      return shouldHaveClass;
    },
  };

  appendChild(child: TestElement) {
    child.parentElement = this;
    this.children.push(child);
    this.documentRef.track(child);
    return child;
  }

  removeChild(child: TestElement) {
    this.children = this.children.filter((candidate) => candidate !== child);
    child.parentElement = null;
    return child;
  }

  get firstChild() {
    return this.children[0] ?? null;
  }

  addEventListener(type: string, handler: Listener) {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  dispatch(type: string, event: { key?: string; preventDefault(): void; target?: TestElement } = { preventDefault() {} }) {
    for (const handler of this.listeners.get(type) ?? []) {
      handler({ ...event, target: event.target ?? this });
    }
  }

  setAttribute(name: string, value: string) {
    if (name === "id") {
      this.id = value;
      this.documentRef.track(this);
      return;
    }

    if (name.startsWith("data-")) {
      this.dataset[name.slice(5)] = value;
      return;
    }

    this.attributes[name] = value;
  }

  getAttribute(name: string) {
    if (name === "id") return this.id;
    if (name.startsWith("data-")) return this.dataset[name.slice(5)] ?? null;
    return this.attributes[name] ?? null;
  }

  querySelectorAll(selector: string) {
    if (!selector.startsWith(".")) return [];
    const className = selector.slice(1);
    return this.children.filter((child) => child.classList.contains(className));
  }

  closest(selector: string) {
    if (!selector.startsWith(".")) return null;
    const className = selector.slice(1);
    let current: TestElement | null = this;
    while (current) {
      if (current.classList.contains(className)) return current;
      current = current.parentElement;
    }
    return null;
  }

  focus() {}
}

class TestDocument {
  private elementsById = new Map<string, TestElement>();
  private elements: TestElement[] = [];
  readonly body = new TestElement("BODY", this);
  readonly documentElement = new TestElement("HTML", this);
  activeElement: TestElement | null = null;

  constructor() {
    this.track(this.body);
    this.track(this.documentElement);
  }

  createElement(tagName: string) {
    return new TestElement(tagName.toUpperCase(), this);
  }

  getElementById(id: string) {
    return this.elementsById.get(id) ?? null;
  }

  findByText(text: string) {
    return this.elements.find((element) => element.textContent === text) ?? null;
  }

  track(element: TestElement) {
    if (!this.elements.includes(element)) {
      this.elements.push(element);
    }
    if (element.id) {
      this.elementsById.set(element.id, element);
    }
  }
}

class FakeWebSocket {
  static OPEN = 1;
  readyState = FakeWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  sentMessages: unknown[] = [];

  constructor(readonly url: string) {}

  send(payload: string) {
    this.sentMessages.push(JSON.parse(payload));
  }

  receive(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

function createClientHarness() {
  const document = new TestDocument();
  const ids = [
    "lobby",
    "session",
    "name-input",
    "join-player-btn",
    "join-observer-btn",
    "session-id-copy",
    "timer-voting",
    "timer-discussion",
    "story",
    "cards-row",
    "show-votes-btn",
    "new-round-btn",
    "results-row",
    "final-cards",
    "stat-average",
    "stat-median",
    "stat-votes",
    "players-count",
    "players-list",
    "toast",
    "story-setup",
    "story-add-input",
    "story-add-btn",
    "story-list-items",
    "story-start-btn",
    "story-nav",
    "story-prev-btn",
    "story-next-btn",
    "story-progress",
    "join-count",
  ];

  for (const id of ids) {
    const tagName = id.includes("btn") || id === "session-id-copy" ? "BUTTON" : id === "story" ? "TEXTAREA" : "DIV";
    const element = document.createElement(tagName);
    element.id = id;
    if (id === "story-setup" || id === "session") {
      element.className = "hidden";
    }
    if (id === "name-input") {
      element.value = "Chris";
    }
    if (id === "cards-row") {
      element.parentElement = document.createElement("DIV");
    }
    document.track(element);
  }

  document.body.dataset.sessionId = "abc12";

  const sessionStorage = new Map<string, string>();
  const socketHolder: { current: FakeWebSocket | null } = { current: null };

  Object.assign(globalThis as Record<string, unknown>, {
    document,
    navigator: { userAgent: "Desktop" },
    location: {
      href: "http://example.com/abc12",
      protocol: "http:",
      host: "example.com",
    },
    sessionStorage: {
      getItem(key: string) {
        return sessionStorage.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        sessionStorage.set(key, value);
      },
    },
    crypto: { randomUUID: () => "client-1" },
    fetch: () => Promise.resolve({ json: () => Promise.resolve({ playerCount: 0 }) }),
    WebSocket: class extends FakeWebSocket {
      constructor(url: string) {
        super(url);
        socketHolder.current = this;
      }
    },
    setTimeout: (callback: () => void) => {
      callback();
      return 1;
    },
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {},
  });

  new Function(CLIENT_JS)();

  const joinPlayerButton = document.getElementById("join-player-btn");
  if (!joinPlayerButton) {
    throw new Error("join-player-btn not initialized");
  }

  return {
    document,
    joinPlayerButton,
    storySetup: document.getElementById("story-setup")!,
    storyStartButton: document.getElementById("story-start-btn")!,
    session: document.getElementById("session")!,
    get socket() {
      if (!socketHolder.current) {
        throw new Error("socket not connected");
      }
      return socketHolder.current;
    },
  };
}

function buildStatePayload({ sessionReady }: { sessionReady: boolean }) {
  return {
    type: "state",
    players: [
      {
        name: "Chris",
        isHost: true,
        isObserver: false,
        vote: null,
        voted: false,
      },
    ],
    roundStartTime: 0,
    revealTime: 0,
    finalVote: null,
    discussionPausedAt: 0,
    discussionPausedTotal: 0,
    pointValues: [1, 2, 3],
    revealed: false,
    stories: [],
    currentStoryIndex: 0,
    sessionReady,
    story: "",
  };
}
