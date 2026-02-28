export function sessionPage(sessionId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pointr – ${sessionId}</title>
  <style>
    /* Design system custom properties */
    :root {
      --bg: #f3f4f6;
      --surface: #ffffff;
      --text: #111827;
      --text-muted: #6b7280;
      --accent: #4f46e5;
      --accent-hover: #4338ca;
      --border: #e5e7eb;
      --shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
      --radius: 8px;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f172a;
        --surface: #1e293b;
        --text: #f1f5f9;
        --text-muted: #94a3b8;
        --accent: #6366f1;
        --accent-hover: #818cf8;
        --border: #334155;
        --shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
      }
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      height: 100%;
      overflow: hidden;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
    }

    .page-footer {
      flex-shrink: 0;
      text-align: center;
      padding: 0.5rem;
      font-size: 0.6875rem;
      color: var(--text-muted);
    }

    .page-footer a {
      color: var(--text-muted);
      text-decoration: none;
    }

    .page-footer a:hover {
      color: var(--accent);
    }

    .hidden {
      display: none !important;
    }

    /* ── Lobby ── */

    #lobby {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      min-height: 0;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: calc(var(--radius) * 2);
      box-shadow: var(--shadow);
      padding: 2.5rem 2rem;
      width: 100%;
      max-width: 420px;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .header {
      text-align: center;
    }

    h1 {
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--accent);
      letter-spacing: -0.03em;
      line-height: 1;
    }

    .session-label {
      color: var(--text-muted);
      font-size: 0.875rem;
      margin-top: 0.375rem;
      font-family: 'SF Mono', 'Fira Code', 'Fira Mono', monospace;
      letter-spacing: 0.05em;
    }

    .divider {
      border: none;
      border-top: 1px solid var(--border);
    }

    /* ── Buttons ── */

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.625rem 1.25rem;
      border-radius: var(--radius);
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
      text-decoration: none;
      white-space: nowrap;
      font-family: inherit;
    }

    .btn-primary {
      background: var(--accent);
      color: #ffffff;
      flex: 1;
    }

    .btn-primary:hover {
      background: var(--accent-hover);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
    }

    .btn-primary:active {
      transform: translateY(0);
      box-shadow: none;
    }

    .btn-secondary {
      background: var(--border);
      color: var(--text);
      flex-shrink: 0;
    }

    .btn-secondary:hover {
      background: var(--text-muted);
      color: var(--surface);
      transform: translateY(-1px);
    }

    .btn-secondary:active {
      transform: translateY(0);
    }

    /* ── Inputs ── */

    input[type="text"],
    textarea {
      flex: 1;
      min-width: 0;
      padding: 0.625rem 0.875rem;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--bg);
      color: var(--text);
      font-size: 0.9375rem;
      font-family: inherit;
      transition: border-color 0.15s, box-shadow 0.15s;
      outline: none;
    }

    input[type="text"]::placeholder,
    textarea::placeholder {
      color: var(--text-muted);
    }

    input[type="text"]:focus,
    textarea:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
    }

    .name-row {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .name-row label {
      font-size: 0.875rem;
      color: var(--text-muted);
      font-weight: 500;
    }

    .join-buttons {
      display: flex;
      gap: 0.5rem;
    }

    /* ── Session layout ── */

    #session {
      flex: 1;
      max-width: 800px;
      width: 100%;
      margin: 0 auto;
      padding: 1rem 1rem 0;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      min-height: 0;
      overflow-y: auto;
    }

    /* ── Top bar ── */

    .top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .session-id-wrap {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-muted);
      font-size: 0.875rem;
    }

    .session-id-copy {
      font-family: 'SF Mono', 'Fira Code', 'Fira Mono', monospace;
      font-size: 0.875rem;
      color: var(--accent);
      cursor: pointer;
      padding: 0.25rem 0.5rem;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--surface);
      transition: background 0.15s, border-color 0.15s;
      user-select: none;
    }

    .session-id-copy:hover {
      background: var(--bg);
      border-color: var(--accent);
    }

    .timer {
      font-variant-numeric: tabular-nums;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text);
      letter-spacing: -0.02em;
      min-width: 4ch;
      text-align: right;
    }

    /* ── Story textarea ── */

    .story-wrap {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .story-wrap label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-muted);
    }

    #story {
      width: 100%;
      min-height: 80px;
      resize: vertical;
    }

    /* ── Cards ── */

    .cards-section {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .cards-section label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-muted);
    }

    .cards-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .vote-card {
      width: 64px;
      height: 88px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      color: var(--text);
      font-size: 1.125rem;
      font-weight: 700;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s, color 0.15s, transform 0.15s, box-shadow 0.15s;
      user-select: none;
    }

    .vote-card:hover {
      border-color: var(--accent);
      background: var(--bg);
      transform: translateY(-3px);
      box-shadow: 0 6px 16px rgba(79, 70, 229, 0.15);
    }

    .vote-card.selected {
      background: var(--accent);
      border-color: var(--accent);
      color: #ffffff;
      transform: translateY(-4px);
      box-shadow: 0 8px 20px rgba(79, 70, 229, 0.35);
    }

    .vote-card.disabled {
      opacity: 0.4;
      pointer-events: none;
      transform: none;
      box-shadow: none;
    }

    /* ── Action buttons ── */

    .action-buttons {
      display: flex;
      gap: 0.75rem;
    }

    .action-buttons .btn-primary {
      flex: 1;
    }

    /* ── Stats row ── */

    .stats-row {
      display: flex;
      gap: 1.5rem;
      justify-content: center;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1rem 1.5rem;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--accent);
    }

    .stat-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 500;
    }

    /* ── Players section ── */

    .players-section {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .players-header {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
    }

    .players-header h2 {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text);
    }

    .players-count {
      font-size: 0.875rem;
      color: var(--text-muted);
    }

    .players-list {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .player-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.625rem 0.875rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }

    .player-name {
      font-size: 0.9375rem;
      font-weight: 500;
      color: var(--text);
    }

    .player-status {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.875rem;
    }

    .status-waiting {
      color: var(--text-muted);
      font-style: italic;
    }

    .status-voted {
      color: #16a34a;
      font-weight: 500;
    }

    .status-voted::before {
      content: '✓';
      font-style: normal;
      font-weight: 700;
    }

    .vote-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 2rem;
      padding: 0.125rem 0.5rem;
      border-radius: 999px;
      background: var(--accent);
      color: #ffffff;
      font-size: 0.875rem;
      font-weight: 700;
    }

    .observer-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.125rem 0.5rem;
      border-radius: 999px;
      background: var(--border);
      color: var(--text-muted);
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* ── Toast ── */

    #toast {
      position: fixed;
      bottom: 1.5rem;
      left: 50%;
      transform: translateX(-50%);
      background: var(--text);
      color: var(--surface);
      padding: 0.625rem 1.25rem;
      border-radius: var(--radius);
      font-size: 0.9375rem;
      font-weight: 500;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
      white-space: nowrap;
      z-index: 100;
    }

    #toast.show {
      opacity: 1;
    }

    /* ── Brand bar ── */

    .brand-bar {
      text-align: center;
    }

    .brand-link {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--accent);
      text-decoration: none;
      letter-spacing: -0.03em;
    }

    .brand-link:hover {
      opacity: 0.8;
    }

    /* ── Story setup ── */

    .story-setup-card {
      max-width: 600px;
    }

    #story-setup {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      min-height: 0;
    }

    .story-input-row {
      display: flex;
      gap: 0.5rem;
    }

    .story-list-items {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .story-list-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0.75rem;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      font-size: 0.875rem;
    }

    .story-list-item .story-text {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .story-list-item .story-num {
      color: var(--text-muted);
      font-size: 0.75rem;
      font-weight: 600;
      margin-right: 0.5rem;
      flex-shrink: 0;
    }

    .story-list-item .story-remove {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 1rem;
      padding: 0 0.25rem;
      line-height: 1;
      flex-shrink: 0;
    }

    .story-list-item .story-remove:hover {
      color: #ef4444;
    }

    /* ── Story nav bar ── */

    .story-nav {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 0.5rem 1rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }

    .story-progress {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text);
      min-width: 5ch;
      text-align: center;
    }

    .btn-icon {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      color: var(--text);
      cursor: pointer;
      font-size: 1rem;
      padding: 0.375rem 0.75rem;
      transition: background 0.15s, border-color 0.15s;
    }

    .btn-icon:hover {
      border-color: var(--accent);
      background: var(--surface);
    }

    .btn-icon:disabled {
      opacity: 0.3;
      cursor: default;
    }

    /* ── Responsive ── */

    @media (max-width: 480px) {
      .card {
        padding: 2rem 1.25rem;
      }

      .join-buttons {
        flex-direction: column;
      }

      .top-bar {
        flex-wrap: wrap;
      }

      .cards-row {
        gap: 0.375rem;
      }

      .vote-card {
        width: 56px;
        height: 76px;
        font-size: 1rem;
      }

      .stats-row {
        gap: 1rem;
        padding: 0.75rem 1rem;
      }

      .action-buttons {
        flex-direction: column;
      }

      .story-input-row {
        flex-direction: column;
      }
    }
  </style>
</head>
<body data-session-id="${sessionId}">

  <!-- ── Lobby ── -->
  <div id="lobby">
    <div class="card">
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
          placeholder="e.g. Alex"
          autocomplete="off"
          spellcheck="false"
          maxlength="32"
        >
      </div>

      <div class="join-buttons">
        <button type="button" class="btn btn-primary" id="join-player-btn">Join as Player</button>
        <button type="button" class="btn btn-secondary" id="join-observer-btn">Observer</button>
      </div>
    </div>
  </div>

  <!-- ── Story Setup (shown after join, before stories are locked) ── -->
  <div id="story-setup" class="hidden">
    <div class="card story-setup-card">
      <div class="header">
        <h1>Pointr</h1>
        <p class="session-label">Optional — add stories to vote on in sequence</p>
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

      <div id="story-list-items" class="story-list-items">
        <!-- Rendered by client.js -->
      </div>

      <button type="button" class="btn btn-primary" style="width:100%;" id="story-start-btn">Start Session</button>
    </div>
  </div>

  <!-- ── Session ── -->
  <div id="session" class="hidden">

    <!-- Brand header -->
    <div class="brand-bar">
      <a href="/" class="brand-link">Pointr</a>
    </div>

    <!-- Top bar -->
    <div class="top-bar">
      <div class="session-id-wrap">
        <span>Session</span>
        <span class="session-id-copy" id="session-id-copy" title="Click to copy invite link">${sessionId}</span>
      </div>
      <div class="timer" id="timer">0:00</div>
    </div>

    <!-- Story progress bar (hidden when no stories) -->
    <div class="story-nav hidden" id="story-nav">
      <button type="button" class="btn-icon" id="story-prev-btn" title="Previous story">&larr;</button>
      <span class="story-progress" id="story-progress">1 of 5</span>
      <button type="button" class="btn-icon" id="story-next-btn" title="Next story">&rarr;</button>
    </div>

    <!-- Story -->
    <div class="story-wrap">
      <label for="story">Story / ticket</label>
      <textarea
        id="story"
        placeholder="Paste a story, ticket URL, or description…"
        rows="3"
        spellcheck="false"
      ></textarea>
    </div>

    <!-- Cards -->
    <div class="cards-section">
      <label>Your vote</label>
      <div class="cards-row" id="cards-row"></div>
    </div>

    <!-- Action buttons -->
    <div class="action-buttons">
      <button type="button" class="btn btn-primary" id="show-votes-btn">Start Round</button>
      <button type="button" class="btn btn-secondary" id="new-round-btn">New Round</button>
    </div>

    <!-- Stats row (hidden until reveal) -->
    <div class="stats-row hidden" id="stats-row">
      <div class="stat-item">
        <span class="stat-value" id="stat-average">–</span>
        <span class="stat-label">Average</span>
      </div>
      <div class="stat-item">
        <span class="stat-value" id="stat-median">–</span>
        <span class="stat-label">Median</span>
      </div>
      <div class="stat-item">
        <span class="stat-value" id="stat-votes">0</span>
        <span class="stat-label">Votes</span>
      </div>
    </div>

    <!-- Players -->
    <div class="players-section">
      <div class="players-header">
        <h2>Players</h2>
        <span class="players-count" id="players-count">(0)</span>
      </div>
      <div class="players-list" id="players-list">
        <!-- Player rows rendered by client.js -->
      </div>
    </div>

  </div>

  <!-- Toast -->
  <div id="toast">Invite link copied!</div>

  <footer class="page-footer">
    <a href="https://github.com/notchrisbutler/pointr" target="_blank" rel="noopener">GitHub</a>
  </footer>

  <script src="/client.js"></script>
</body>
</html>`;
}
