import { renderPage } from "./layout";
import { renderLobby, renderSessionBoard } from "./session-sections";
import { SHARED_PAGE_STYLES } from "./styles";

export const SESSION_PAGE_STYLES = `
  .view-exit {
    opacity: 0;
    transform: translateY(-8px);
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  .view-enter {
    animation: view-fade-in 0.25s ease both;
  }

  @keyframes view-fade-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* ── Lobby ── */

  #lobby {
    min-height: 0;
  }

  .session-label {
    color: var(--text-muted);
    font-size: 0.875rem;
    margin-top: 0.375rem;
    font-family: 'SF Mono', 'Fira Code', 'Fira Mono', monospace;
    letter-spacing: 0.05em;
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

  .join-count {
    text-align: center;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--accent);
  }

  .join-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .join-buttons .btn-primary {
    flex: 1;
  }

  /* ── Session layout ── */

  #session {
    padding-left: 1rem;
    padding-right: 1rem;
    overflow: hidden;
  }

  .session-shell {
    width: 100%;
    max-width: var(--session-panel-max-width);
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding-bottom: 1rem;
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

  .timers-wrap {
    display: flex;
    gap: 1.25rem;
    align-items: flex-end;
  }

  .timer-block {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.125rem;
  }

  .timer-label {
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
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

  .timer-dim {
    opacity: 0.35;
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
    gap: 0.5rem;
  }

  .vote-card {
    flex: 1;
    min-width: 0;
    height: 72px;
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

  .timeout-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(15, 23, 42, 0.68);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .timeout-card {
    max-width: 420px;
    text-align: center;
  }

  .timeout-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text);
  }

  .timeout-message {
    color: var(--text-muted);
    line-height: 1.5;
  }

  .timeout-actions {
    display: flex;
    justify-content: center;
    gap: 0.75rem;
  }

  .timeout-actions form {
    display: flex;
  }

  @media (max-width: 480px) {
    .timeout-actions {
      flex-direction: column;
    }

    .timeout-actions form,
    .timeout-actions .btn {
      width: 100%;
    }
  }

  /* ── Results row ── */

  .results-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.75rem 1.25rem;
    gap: 1rem;
  }

  .stats-side {
    display: flex;
    gap: 1.25rem;
    flex-shrink: 0;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--accent);
  }

  .stat-label {
    font-size: 0.625rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 600;
  }

  .final-side {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .final-label {
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .final-cards {
    display: flex;
    gap: 0.375rem;
  }

  .final-card {
    width: 40px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg);
    color: var(--text);
    font-size: 0.875rem;
    font-weight: 700;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, color 0.15s, transform 0.15s;
    user-select: none;
  }

  .final-card:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
  }

  .final-card.selected {
    background: #16a34a;
    border-color: #16a34a;
    color: #ffffff;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3);
  }

  .final-card.disabled {
    opacity: 0.6;
    cursor: default;
    pointer-events: none;
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

  .status-no-vote {
    color: var(--text-muted);
    font-style: italic;
  }

  .status-slacker {
    color: #ef4444;
    font-weight: 600;
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
      flex-wrap: wrap;
      gap: 0.375rem;
    }

    .vote-card {
      flex: 0 0 calc((100% - 5 * 0.375rem) / 6);
      height: 56px;
      font-size: 1rem;
    }

    .results-row {
      flex-direction: column;
      gap: 0.75rem;
    }

    .final-side {
      width: 100%;
      justify-content: center;
    }

    .action-buttons {
      flex-direction: column;
    }
  }
`;

export function sessionPage(sessionId: string): string {
  return renderPage({
    title: `Pointr – ${sessionId}`,
    bodyAttributes: `data-session-id="${sessionId}"`,
    styles: `${SHARED_PAGE_STYLES}${SESSION_PAGE_STYLES}`,
    content: `${renderLobby(sessionId)}
${renderSessionBoard(sessionId)}`,
    scriptPath: "/client.js",
  });
}
