import { renderPage } from "./layout";
import { SHARED_PAGE_STYLES } from "./styles";

const HOME_PAGE_STYLES = `
  .page-main {
    padding: 1rem;
  }

  @media (max-width: 480px) {
    .card {
      padding: 2rem 1.25rem;
    }
  }
`;

export function renderHomeContent(): string {
  return `
  <div class="page-main stage">
    <div class="card entry-card">
      <div class="header">
        <h1>Pointr</h1>
        <p class="tagline">Fast, free planning poker for agile teams</p>
      </div>

      <hr class="divider">

      <div class="create-section">
        <form action="/create" method="POST">
          <button type="submit" class="btn btn-primary">Create Session</button>
        </form>
      </div>

      <div class="join-section">
        <p class="join-label">or join an existing session</p>
        <div class="join-row">
          <input
            type="text"
            id="sessionId"
            placeholder="Session ID"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            maxlength="5"
          >
          <button type="button" id="join-session-btn" class="btn btn-secondary">Join</button>
        </div>
        <p class="field-error hidden" id="sessionId-error">Session IDs must be 5 letters or numbers.</p>
      </div>
    </div>
  </div>`;
}

export function homePage(): string {
  return renderPage({
    title: "Pointr – Planning Poker",
    styles: `${SHARED_PAGE_STYLES}\n${HOME_PAGE_STYLES}`,
    content: renderHomeContent(),
    scriptPath: "/home.js",
  });
}
