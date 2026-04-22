export function renderLobby(sessionId: string): string {
  return `
  <div id="lobby" class="stage entry-stage">
    <div class="card entry-card">
      <div class="header">
        <h1>Pointr</h1>
        <p class="session-label">Session: ${sessionId}</p>
      </div>

      <hr class="divider">

      <div class="name-row">
        <label for="name-input">Your name</label>
        <input
          type="text"
          id="name-input"
          placeholder="Leave blank for a random emoji"
          autocomplete="off"
          spellcheck="false"
          maxlength="32"
        >
      </div>

      <p class="join-count hidden" id="join-count"></p>

      <div class="join-buttons">
        <button type="button" class="btn btn-primary" id="join-player-btn">Join as Player</button>
        <button type="button" class="btn btn-secondary" id="join-observer-btn">Observer</button>
      </div>
    </div>
  </div>`;
}

export function renderStorySetup(): string {
  return `
  <div id="story-setup" class="hidden stage entry-stage">
    <div class="card entry-card story-setup-card">
      <div class="header">
        <h1>Pointr</h1>
        <p class="session-label">Optional — add tickets to vote on</p>
      </div>

      <hr class="divider">

      <div class="story-input-row">
        <input
          type="text"
          id="story-add-input"
          placeholder="Story title or ticket URL…"
          autocomplete="off"
          spellcheck="false"
          maxlength="200"
        >
        <button type="button" class="btn btn-secondary" id="story-add-btn">Add</button>
      </div>

      <div id="story-list-items" class="story-list-items"></div>

      <button type="button" class="btn btn-primary" id="story-start-btn">Start Session</button>
    </div>
  </div>`;
}

export function renderSessionBoard(sessionId: string): string {
  return `
  <div id="session" class="hidden stage">
    <div class="session-shell">
      <div class="brand-bar">
        <a href="/" class="brand-link">Pointr</a>
      </div>

      <div class="top-bar">
        <div class="session-id-wrap">
          <span>Session</span>
          <span class="session-id-copy" id="session-id-copy" title="Click to copy invite link">${sessionId}</span>
        </div>
        <div class="timers-wrap">
          <div class="timer-block">
            <span class="timer-label">Voting</span>
            <span class="timer" id="timer-voting">0:00</span>
          </div>
          <div class="timer-block">
            <span class="timer-label">Discussion</span>
            <span class="timer" id="timer-discussion">0:00</span>
          </div>
        </div>
      </div>

      <div class="story-nav hidden" id="story-nav">
        <button type="button" class="btn-icon" id="story-prev-btn" title="Previous story">&larr;</button>
        <span class="story-progress" id="story-progress">1 of 5</span>
        <button type="button" class="btn-icon" id="story-next-btn" title="Next story">&rarr;</button>
      </div>

      <div class="story-wrap">
        <label for="story">Story / ticket</label>
        <textarea id="story" placeholder="Paste a story, ticket URL, or description…" rows="3" spellcheck="false"></textarea>
      </div>

      <div class="cards-section">
        <label>Your vote</label>
        <div class="cards-row" id="cards-row"></div>
      </div>

      <div class="action-buttons">
        <button type="button" class="btn btn-primary" id="show-votes-btn">Start Round</button>
        <button type="button" class="btn btn-secondary" id="new-round-btn">New Round</button>
      </div>

      <div class="results-row hidden" id="results-row">
        <div class="stats-side">
          <div class="stat-item">
            <span class="stat-value" id="stat-average">–</span>
            <span class="stat-label">Avg</span>
          </div>
          <div class="stat-item">
            <span class="stat-value" id="stat-median">–</span>
            <span class="stat-label">Med</span>
          </div>
          <div class="stat-item">
            <span class="stat-value" id="stat-votes">0</span>
            <span class="stat-label">Votes</span>
          </div>
        </div>
        <div class="final-side">
          <span class="final-label">Final</span>
          <div class="final-cards" id="final-cards"></div>
        </div>
      </div>

      <div class="players-section">
        <div class="players-header">
          <h2>Players</h2>
          <span class="players-count" id="players-count">(0)</span>
        </div>
        <div class="players-list" id="players-list"></div>
      </div>
    </div>
  </div>

  <div id="toast">Invite link copied!</div>`;
}
