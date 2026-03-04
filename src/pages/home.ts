export function homePage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pointr – Planning Poker</title>
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

    .page-main {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      min-height: 0;
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

    .tagline {
      color: var(--text-muted);
      font-size: 0.9375rem;
      margin-top: 0.5rem;
      line-height: 1.4;
    }

    .divider {
      border: none;
      border-top: 1px solid var(--border);
    }

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
    }

    .btn-primary {
      background: var(--accent);
      color: #ffffff;
      width: 100%;
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

    input[type="text"] {
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

    input[type="text"]::placeholder {
      color: var(--text-muted);
    }

    input[type="text"]:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
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
  </style>
</head>
<body>
  <script>
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      document.documentElement.innerHTML = '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pointr</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#f1f5f9;text-align:center;padding:24px}@media(prefers-color-scheme:light){body{background:#f3f4f6;color:#111827}}.msg{max-width:360px}.msg h1{font-size:2rem;margin-bottom:12px}.msg p{color:#94a3b8;line-height:1.6}@media(prefers-color-scheme:light){.msg p{color:#6b7280}}</style></head><body><div class="msg"><h1>Pointr</h1><p>Pointr is designed for desktop browsers. Please open this link on your computer.</p></div></body>';
    }
  </script>
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
        <button
          type="button"
          class="btn btn-secondary"
          onclick="location.href='/'+document.getElementById('sessionId').value"
        >Join</button>
      </div>
    </div>
  </div>
  </div>
  <footer class="page-footer">
    <a href="https://github.com/notchrisbutler/pointr" target="_blank" rel="noopener">GitHub</a>
  </footer>
</body>
</html>`;
}
