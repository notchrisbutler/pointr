export const HOME_CLIENT_JS = `(function() {
  'use strict';

  function showDesktopOnlyMessage() {
    document.documentElement.innerHTML = '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pointr</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#f1f5f9;text-align:center;padding:24px}@media(prefers-color-scheme:light){body{background:#f3f4f6;color:#111827}}.msg{max-width:360px}.msg h1{font-size:2rem;margin-bottom:12px}.msg p{color:#94a3b8;line-height:1.6}@media(prefers-color-scheme:light){.msg p{color:#6b7280}}</style></head><body><div class="msg"><h1>Pointr</h1><p>Pointr is designed for desktop browsers. Please open this link on your computer.</p></div></body>';
  }

  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    showDesktopOnlyMessage();
    return;
  }

  var sessionInput = document.getElementById('sessionId');
  var joinButton = document.getElementById('join-session-btn');

  if (!sessionInput || !joinButton) {
    return;
  }

  function joinSession() {
    var sessionId = sessionInput.value.trim().toLowerCase();
    if (!sessionId) {
      sessionInput.focus();
      return;
    }
    location.href = '/' + sessionId;
  }

  joinButton.addEventListener('click', joinSession);
  sessionInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      joinSession();
    }
  });
})();`;
