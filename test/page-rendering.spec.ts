import { describe, expect, it } from "vitest";
import { homePage, renderHomeContent } from "../src/pages/home";
import { renderPage } from "../src/pages/layout";
import { SESSION_PAGE_STYLES, sessionPage } from "../src/pages/session";
import {
  renderLobby,
  renderSessionBoard,
} from "../src/pages/session-sections";
import { SHARED_PAGE_STYLES } from "../src/pages/styles";

describe("renderPage", () => {
  it("renders a shared document shell with footer, styles, and external script", () => {
    const html = renderPage({
      title: "Pointr – Demo",
      bodyAttributes: 'data-session-id="abc123"',
      styles: ".demo { color: red; }",
      content: "<main>hello</main>",
      scriptPath: "/client.js",
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>Pointr – Demo</title>");
    expect(html).toContain('<body data-session-id="abc123">');
    expect(html).toContain("<style>.demo { color: red; }</style>");
    expect(html).toContain("<main>hello</main>");
    expect(html).toContain('<footer class="page-footer">');
    expect(html).toContain('<script src="/client.js"></script>');
  });
});

describe("SHARED_PAGE_STYLES", () => {
  it("contains shared stage and entry panel primitives", () => {
    expect(SHARED_PAGE_STYLES).toContain(".stage {");
    expect(SHARED_PAGE_STYLES).toContain(".entry-stage {");
    expect(SHARED_PAGE_STYLES).toContain(".entry-card {");
    expect(SHARED_PAGE_STYLES).toContain(".field-error {");
    expect(SHARED_PAGE_STYLES).not.toContain("--stage-top-offset");
    expect(SHARED_PAGE_STYLES).not.toContain(".page-main");
  });

  it("allows the document to scroll vertically when entry stages overflow", () => {
    expect(SHARED_PAGE_STYLES).toContain("html, body {");
    expect(SHARED_PAGE_STYLES).toContain("min-height: 100%;");
    expect(SHARED_PAGE_STYLES).not.toContain("overflow: hidden;");
  });
});

describe("SESSION_PAGE_STYLES", () => {
  it("contains session-only selectors without re-owning shared primitives", () => {
    expect(SESSION_PAGE_STYLES).toContain(".players-list {");
    expect(SESSION_PAGE_STYLES).toContain("#toast {");
    expect(SESSION_PAGE_STYLES).toContain(".vote-card {");
    expect(SESSION_PAGE_STYLES).toContain(".results-row {");
    expect(SESSION_PAGE_STYLES).not.toContain(":root {");
    expect(SESSION_PAGE_STYLES).not.toContain(".page-footer");
    expect(SESSION_PAGE_STYLES).not.toContain("\n  .btn-primary {");
  });

  it("preserves the lobby button growth and mobile card spacing overrides", () => {
    expect(SESSION_PAGE_STYLES).toContain(".join-buttons .btn-primary {");
    expect(SESSION_PAGE_STYLES).toContain("flex: 1;");
    expect(SESSION_PAGE_STYLES).toContain("@media (max-width: 480px) {");
    expect(SESSION_PAGE_STYLES).toContain(".card {");
    expect(SESSION_PAGE_STYLES).toContain("padding: 2rem 1.25rem;");
    expect(SESSION_PAGE_STYLES).not.toContain(".story-setup-card {");
    expect(SESSION_PAGE_STYLES).not.toContain(".story-nav {");
    expect(SESSION_PAGE_STYLES).not.toContain(".story-wrap {");
    expect(SESSION_PAGE_STYLES).not.toContain("#story {");
    expect(SESSION_PAGE_STYLES).not.toContain(".story-input-row {");
    expect(SESSION_PAGE_STYLES).not.toContain(".story-list-items {");
    expect(SESSION_PAGE_STYLES).not.toContain("#story-start-btn {");
    expect(SESSION_PAGE_STYLES).not.toContain(".btn-icon {");
  });
});

describe("home page", () => {
  it("renders home content without owning the document shell", () => {
    const content = renderHomeContent();

    expect(content).toContain('<div class="stage entry-stage">');
    expect(content).toContain("Create Session");
    expect(content).toContain('id="sessionId"');
    expect(content).not.toContain("<!DOCTYPE html>");
    expect(content).not.toContain('<script src="/home.js"></script>');
  });

  it("renders the inline validation anchor for the join flow", () => {
    const content = renderHomeContent();

    expect(content).toContain('class="stage entry-stage"');
    expect(content).toContain('class="card entry-card"');
    expect(content).toContain('id="sessionId-error"');
    expect(content).toContain('maxlength="5"');
  });

  it("wraps the home content with the shared page shell", () => {
    const html = homePage();

    expect(html).toContain("<title>Pointr – Planning Poker</title>");
    expect(html).toContain("Fast, free planning poker for agile teams");
    expect(html).not.toContain(".page-main {");
    expect(html).toContain('<script src="/home.js"></script>');
    expect(html).toContain('<footer class="page-footer">');
  });
});

describe("session sections", () => {
  it("renders the lobby inside the shared entry stage without a separate setup view", () => {
    expect(renderLobby("abc12")).toContain('id="lobby" class="stage entry-stage"');
    expect(renderLobby("abc12")).toContain('class="card entry-card"');
  });

  it("renders the active session board in the shared stage shell without story controls", () => {
    const html = renderSessionBoard("abc12");

    expect(html).toContain('id="session" class="hidden stage"');
    expect(html).toContain('class="session-shell"');
    expect(html).toContain('id="session-id-copy"');
    expect(html).toContain('id="timer-voting"');
    expect(html).toContain('id="timer-discussion"');
    expect(html).toContain('id="cards-row"');
    expect(html).toContain('id="show-votes-btn"');
    expect(html).toContain('id="new-round-btn"');
    expect(html).toContain('id="results-row"');
    expect(html).toContain('id="final-cards"');
    expect(html).toContain('id="players-list"');
    expect(html).toContain('id="toast"');
    expect(html).not.toContain('id="story-nav"');
    expect(html).not.toContain('id="story"');
    expect(html).not.toContain('id="story-prev-btn"');
    expect(html).not.toContain('id="story-next-btn"');
    expect(html).not.toContain('id="story-progress"');
    expect(html).toContain(">abc12<");
  });
});

describe("sessionPage", () => {
  it("wraps the composed session sections with the shared page shell", () => {
    const html = sessionPage("abc123");

    expect(html).toContain("<title>Pointr – abc123</title>");
    expect(html).toContain('<body data-session-id="abc123">');
    expect(html).toContain(SHARED_PAGE_STYLES);
    expect(html).toContain(SESSION_PAGE_STYLES);
    expect(html).toContain(renderLobby("abc123"));
    expect(html).toContain(renderSessionBoard("abc123"));
    expect(html).not.toContain('id="story-setup"');
    expect(html).toContain('<script src="/client.js"></script>');
    expect(html).toContain('<footer class="page-footer">');
  });
});
