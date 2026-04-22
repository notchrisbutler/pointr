import { renderPage } from "./layout";
import { SHARED_PAGE_STYLES } from "./styles";

const HOME_PAGE_STYLES = `
  .page-main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    min-height: 0;
  }

  .tagline {
    color: var(--text-muted);
    font-size: 0.9375rem;
    margin-top: 0.5rem;
    line-height: 1.4;
  }

  .create-section form {
    display: flex;
    flex-direction: column;
  }

  .join-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .join-label {
    color: var(--text-muted);
    font-size: 0.875rem;
    text-align: center;
  }

  .join-row {
    display: flex;
    gap: 0.5rem;
  }

  .btn-primary {
    width: 100%;
  }

  @media (max-width: 480px) {
    .card {
      padding: 2rem 1.25rem;
    }

    .join-row {
      flex-direction: column;
    }

    .btn-secondary {
      width: 100%;
    }
  }
`;

export function renderHomeContent(): string {
  return `
  <div class="page-main">
    <div class="card">
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
            spellcheck="false"
          >
          <button type="button" id="join-session-btn" class="btn btn-secondary">Join</button>
        </div>
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
