import { describe, expect, it } from "vitest";
import { homePage, renderHomeContent } from "../src/pages/home";
import { renderPage } from "../src/pages/layout";
import { SESSION_PAGE_STYLES, sessionPage } from "../src/pages/session";
import {
  renderLobby,
  renderSessionBoard,
  renderStorySetup,
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
  it("contains the shared tokens and cross-page primitives", () => {
    expect(SHARED_PAGE_STYLES).toContain(":root {");
    expect(SHARED_PAGE_STYLES).toContain(".page-footer");
    expect(SHARED_PAGE_STYLES).toContain(".card");
    expect(SHARED_PAGE_STYLES).toContain(".btn");
    expect(SHARED_PAGE_STYLES).toContain(".hidden");
    expect(SHARED_PAGE_STYLES).not.toContain(".page-main");
  });
});

describe("SESSION_PAGE_STYLES", () => {
  it("contains session-only selectors without re-owning shared primitives", () => {
    expect(SESSION_PAGE_STYLES).toContain(".story-nav {");
    expect(SESSION_PAGE_STYLES).toContain(".players-list {");
    expect(SESSION_PAGE_STYLES).toContain("#toast {");
    expect(SESSION_PAGE_STYLES).toContain(".btn-icon {");
    expect(SESSION_PAGE_STYLES).toContain("#story-start-btn {");
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
  });
});

describe("home page", () => {
  it("renders home content without owning the document shell", () => {
    const content = renderHomeContent();

    expect(content).toContain('<div class="page-main">');
    expect(content).toContain("Create Session");
    expect(content).toContain('id="sessionId"');
    expect(content).not.toContain("<!DOCTYPE html>");
    expect(content).not.toContain('<script src="/home.js"></script>');
  });

  it("wraps the home content with the shared page shell", () => {
    const html = homePage();

    expect(html).toContain("<title>Pointr – Planning Poker</title>");
    expect(html).toContain("Fast, free planning poker for agile teams");
    expect(html).toContain(".page-main {");
    expect(html).toContain('<script src="/home.js"></script>');
    expect(html).toContain('<footer class="page-footer">');
  });
});

describe("session sections", () => {
  it("renders the lobby section with the join controls", () => {
    const html = renderLobby("abc123");

    expect(html).toContain('id="lobby"');
    expect(html).toContain("Session: abc123");
    expect(html).toContain('id="join-player-btn"');
    expect(html).toContain('id="join-observer-btn"');
  });

  it("renders the story setup section independently", () => {
    const html = renderStorySetup();

    expect(html).toContain('id="story-setup" class="hidden"');
    expect(html).toContain('id="story-add-input"');
    expect(html).toContain('id="story-start-btn"');
    expect(html).not.toContain('style="width:100%;"');
  });

  it("renders the active session board independently", () => {
    const html = renderSessionBoard("abc123");

    expect(html).toContain('id="session" class="hidden"');
    expect(html).toContain('id="session-id-copy"');
    expect(html).toContain('id="cards-row"');
    expect(html).toContain('id="players-list"');
    expect(html).toContain('id="toast"');
    expect(html).toContain(">abc123<");
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
    expect(html).toContain(renderStorySetup());
    expect(html).toContain(renderSessionBoard("abc123"));
    expect(html).toContain('<script src="/client.js"></script>');
    expect(html).toContain('<footer class="page-footer">');
  });
});
