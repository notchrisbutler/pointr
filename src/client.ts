import {
  applyJoinedPayload,
  getOrCreateClientId,
  shouldReconnect,
} from "./client-helpers";

export const CLIENT_JS = `(function() {
  'use strict';

  function showDesktopOnlyMessage() {
    document.documentElement.innerHTML = '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pointr</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#f1f5f9;text-align:center;padding:24px}@media(prefers-color-scheme:light){body{background:#f3f4f6;color:#111827}}.msg{max-width:360px}.msg h1{font-size:2rem;margin-bottom:12px}.msg p{color:#94a3b8;line-height:1.6}@media(prefers-color-scheme:light){.msg p{color:#6b7280}}</style></head><body><div class="msg"><h1>Pointr</h1><p>Pointr is designed for desktop browsers. Please open this link on your computer.</p></div></body>';
  }

  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    showDesktopOnlyMessage();
    return;
  }

  // ── State ──
  var ws = null;
  var selfState = { clientId: '', name: '', amHost: false, isObserver: false };
  var activeSocketGeneration = 0;
  var name = '';
  var isObserver = false;
  var selectedVote = null;
  var votingInterval = null;
  var discussionInterval = null;
  var lastRoundStartTime = null;
  var lastTimerKey = null;
  var localStories = [];
  var hasEnteredSession = false;
  var amHost = false;
  var timedOut = false;

  // ── DOM refs ──
  var lobby = document.getElementById('lobby');
  var session = document.getElementById('session');
  var nameInput = document.getElementById('name-input');
  var joinPlayerBtn = document.getElementById('join-player-btn');
  var joinObserverBtn = document.getElementById('join-observer-btn');
  var sessionIdCopy = document.getElementById('session-id-copy');
  var votingTimerEl = document.getElementById('timer-voting');
  var discussionTimerEl = document.getElementById('timer-discussion');
  var storyEl = document.getElementById('story');
  var cardsRow = document.getElementById('cards-row');
  var showVotesBtn = document.getElementById('show-votes-btn');
  var newRoundBtn = document.getElementById('new-round-btn');
  var resultsRow = document.getElementById('results-row');
  var finalCardsEl = document.getElementById('final-cards');
  var statAverage = document.getElementById('stat-average');
  var statMedian = document.getElementById('stat-median');
  var statVotes = document.getElementById('stat-votes');
  var playersCount = document.getElementById('players-count');
  var playersList = document.getElementById('players-list');
  var toastEl = document.getElementById('toast');
  var storySetup = document.getElementById('story-setup');
  var storyAddInput = document.getElementById('story-add-input');
  var storyAddBtn = document.getElementById('story-add-btn');
  var storyListItems = document.getElementById('story-list-items');
  var storyStartBtn = document.getElementById('story-start-btn');
  var storyNav = document.getElementById('story-nav');
  var storyPrevBtn = document.getElementById('story-prev-btn');
  var storyNextBtn = document.getElementById('story-next-btn');
  var storyProgress = document.getElementById('story-progress');

  var sessionId = document.body.dataset.sessionId;
  var clientId = (${getOrCreateClientId.toString()})(sessionStorage, sessionId, function() { return crypto.randomUUID(); });
  var joinCountEl = document.getElementById('join-count');

  // Fetch player count for lobby
  fetch('/api/' + sessionId + '/info')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.playerCount > 0) {
        joinCountEl.textContent = 'Join ' + data.playerCount + ' other' + (data.playerCount === 1 ? '' : 's') + '!';
        joinCountEl.classList.remove('hidden');
      }
    })
    .catch(function() {});

  // ── Helpers ──

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(function() {
      toastEl.classList.remove('show');
    }, 2000);
  }

  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  function formatTime(totalSeconds) {
    var mins = Math.floor(totalSeconds / 60);
    var secs = totalSeconds % 60;
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
  }

  // ── Connection ──

  function connect() {
    activeSocketGeneration += 1;
    var socketGeneration = activeSocketGeneration;
    var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var url = protocol + '//' + location.host + '/ws/' + sessionId;
    ws = new WebSocket(url);

    ws.onopen = function() {
      send({ type: 'join', clientId: clientId, name: name, isObserver: isObserver });
    };

    ws.onmessage = function(event) {
      var data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        return;
      }
      if (data.type === 'joined') {
        selfState = (${applyJoinedPayload.toString()})(selfState, data);
        clientId = selfState.clientId;
        name = selfState.name;
        amHost = selfState.amHost;
        isObserver = selfState.isObserver;
      } else if (data.type === 'state') {
        handleState(data);
      } else if (data.type === 'timeout') {
        timedOut = true;
        showTimeoutOverlay();
      } else if (data.type === 'error') {
        showToast(data.message);
      }
    };

    ws.onclose = function(event) {
      if (!(${shouldReconnect.toString()})({ timedOut: timedOut, closeCode: event.code, socketGeneration: socketGeneration, activeGeneration: activeSocketGeneration })) {
        if (timedOut || event.code === 4000) {
          timedOut = true;
          showTimeoutOverlay();
        }
        return;
      }
      setTimeout(function() {
        connect();
      }, 1500);
    };
  }

  // ── State handling ──

  function handleState(data) {
    // Timers — only update when timer-relevant state changes
    // Determine if we are the host — match by name, updating local name if server deduplicated it
    var me = data.players.find(function(p) { return p.name === name; });
    if (!me) {
      // Server may have added a suffix for deduplication — find our suffixed name
      me = data.players.find(function(p) { return p.name.indexOf(name) === 0 && p.name !== name; });
      if (me) { name = me.name; }
    }
    amHost = me ? me.isHost : false;

    // Clear local selection when round resets
    if (data.roundStartTime === 0 && !data.revealed) {
      selectedVote = null;
    }
    lastRoundStartTime = data.roundStartTime;
    var timerKey = data.roundStartTime + ':' + data.revealTime + ':' + data.finalVote + ':' + data.discussionPausedTotal;
    if (timerKey !== lastTimerKey) {
      lastTimerKey = timerKey;
      updateTimers(data.roundStartTime, data.revealTime, data.finalVote, data.discussionPausedAt || 0, data.discussionPausedTotal || 0);
    }

    // Render cards from pointValues (skip if observer)
    renderCards(data.pointValues, data.revealed);

    // Render players
    renderPlayers(data.players, data.revealed, data.roundStartTime, data.revealTime);

    // Update story — when stories are loaded, always update (textarea is read-only)
    if (data.stories && data.stories.length > 0) {
      storyEl.value = data.story || '';
      storyEl.readOnly = true;
      storyEl.placeholder = 'Story loaded from list';
    } else {
      if (document.activeElement !== storyEl) {
        storyEl.value = data.story || '';
      }
      storyEl.readOnly = false;
      storyEl.placeholder = 'Paste a story, ticket URL, or description\\u2026';
    }

    // Show/hide results
    if (data.revealed) {
      renderStats(data.players);
      renderFinalCards(data.players, data.finalVote);
      resultsRow.classList.remove('hidden');
    } else {
      resultsRow.classList.add('hidden');
    }

    // Story navigation
    if (data.stories && data.stories.length > 0) {
      storyNav.classList.remove('hidden');
      storyProgress.textContent = (data.currentStoryIndex + 1) + ' of ' + data.stories.length;
      storyPrevBtn.disabled = data.currentStoryIndex === 0;
      storyNextBtn.disabled = data.currentStoryIndex === data.stories.length - 1;
    } else {
      storyNav.classList.add('hidden');
    }

    // Session entry: decide whether to show story setup or go straight to session
    if (!hasEnteredSession) {
      hasEnteredSession = true;
      var target = data.sessionReady ? session : storySetup;
      // Fade out lobby, then fade in target
      lobby.classList.add('view-exit');
      setTimeout(function() {
        lobby.classList.add('hidden');
        lobby.classList.remove('view-exit');
        target.classList.remove('hidden');
        target.classList.add('view-enter');
        // Remove animation class after it completes
        setTimeout(function() {
          target.classList.remove('view-enter');
        }, 250);
      }, 200);
    }

    // Primary action button state:
    // roundStartTime === 0 && !revealed → "Start Round"
    // roundStartTime > 0 && !revealed   → "Show Votes"
    // revealed                          → "Votes Shown" (disabled)
    if (data.revealed) {
      showVotesBtn.textContent = 'Votes Shown';
      showVotesBtn.disabled = true;
    } else if (data.roundStartTime === 0) {
      showVotesBtn.textContent = 'Start Round';
      showVotesBtn.disabled = false;
    } else {
      showVotesBtn.textContent = 'Show Votes';
      showVotesBtn.disabled = false;
    }

    // Host-only controls visibility (story management only)
    if (data.stories && data.stories.length > 0) {
      storyPrevBtn.style.display = amHost ? '' : 'none';
      storyNextBtn.style.display = amHost ? '' : 'none';
    }
    // Story textarea: anyone can edit in generic mode (no pre-loaded stories)
    if (!data.stories || data.stories.length === 0) {
      storyEl.readOnly = false;
    }
  }

  // ── Render cards ──
  // Cards use known safe values from the pointValues array (numbers/strings like "?").
  // We use textContent for display, so no XSS risk.

  function renderCards(pointValues, revealed) {
    if (isObserver) {
      cardsRow.parentElement.classList.add('hidden');
      return;
    }
    cardsRow.parentElement.classList.remove('hidden');

    var roundNotStarted = lastRoundStartTime === 0 || lastRoundStartTime === null;

    // Clear existing cards using safe DOM method
    while (cardsRow.firstChild) {
      cardsRow.removeChild(cardsRow.firstChild);
    }

    pointValues.forEach(function(val) {
      var btn = document.createElement('button');
      btn.className = 'vote-card';
      if (String(selectedVote) === String(val)) {
        btn.classList.add('selected');
      }
      if (revealed || roundNotStarted) {
        btn.classList.add('disabled');
      }
      btn.setAttribute('data-value', String(val));
      // Display label: use coffee emoji for "coffee", ½ for 0.5, otherwise the value
      btn.textContent = val === 'coffee' ? '\\u2615' : val === 0.5 ? '\\u00BD' : String(val);
      cardsRow.appendChild(btn);
    });
  }

  // ── Render players ──
  // All user-supplied data (player names) is set via textContent for XSS safety.

  var slackerMessages = [
    'Clueless', 'AFK', 'Watching Netflix', 'Scrolling TikTok',
    '\\u23F0 Slacker alert!', 'Gone fishing', 'Napping', 'Lost in space',
    'Daydreaming', 'Playing Wordle', 'Reading memes',
    'Forgot how numbers work', 'Still loading\\u2026',
    'Error 404: Vote not found', 'Buffering\\u2026',
    'Went for coffee', 'Distracted by a squirrel',
    'Existential crisis', 'Vibing elsewhere',
    'Touching grass', 'In the metaverse'
  ];

  // Cache random picks per round so they don't change on every re-render
  var slackerCache = {};
  var slackerCacheRound = 0;
  var recentSlackerMessages = [];

  function getSlackerMessage(playerName, roundStart) {
    if (roundStart !== slackerCacheRound) {
      slackerCache = {};
      slackerCacheRound = roundStart;
    }
    if (!slackerCache[playerName]) {
      // Filter out recently used messages to avoid repeats across rounds
      var available = slackerMessages.filter(function(m) {
        return recentSlackerMessages.indexOf(m) === -1;
      });
      if (available.length === 0) available = slackerMessages;
      var pick = available[Math.floor(Math.random() * available.length)];
      slackerCache[playerName] = pick;
      recentSlackerMessages.push(pick);
      // Keep a sliding window — forget after half the pool is used
      if (recentSlackerMessages.length > Math.floor(slackerMessages.length / 2)) {
        recentSlackerMessages.shift();
      }
    }
    return slackerCache[playerName];
  }

  function renderPlayers(players, revealed, roundStartTime, revealTime) {
    playersCount.textContent = '(' + players.length + ')';

    // Check if voting lasted >30s before reveal
    var votingDuration = (roundStartTime > 0 && revealTime > 0)
      ? (revealTime - roundStartTime) / 1000
      : 0;

    // Clear existing player rows using safe DOM method
    while (playersList.firstChild) {
      playersList.removeChild(playersList.firstChild);
    }

    players.forEach(function(p) {
      var row = document.createElement('div');
      row.className = 'player-row';

      var nameSpan = document.createElement('span');
      nameSpan.className = 'player-name';
      nameSpan.textContent = p.name;
      row.appendChild(nameSpan);

      var statusSpan = document.createElement('span');
      statusSpan.className = 'player-status';

      if (p.isObserver) {
        var badge = document.createElement('span');
        badge.className = 'observer-badge';
        badge.textContent = 'Observer';
        statusSpan.appendChild(badge);
      } else if (revealed && p.vote !== null) {
        var voteBadge = document.createElement('span');
        voteBadge.className = 'vote-badge';
        voteBadge.textContent = p.vote === 'coffee' ? '\\u2615' : String(p.vote);
        statusSpan.appendChild(voteBadge);
      } else if (revealed && p.vote === null && !p.isObserver) {
        if (votingDuration > 60) {
          statusSpan.className = 'player-status status-slacker';
          statusSpan.textContent = getSlackerMessage(p.name, roundStartTime);
        } else {
          statusSpan.className = 'player-status status-no-vote';
          statusSpan.textContent = 'No vote';
        }
      } else if (p.voted) {
        statusSpan.className = 'player-status status-voted';
        statusSpan.textContent = ' Voted';
      } else {
        statusSpan.className = 'player-status status-waiting';
        statusSpan.textContent = 'Waiting\\u2026';
      }

      row.appendChild(statusSpan);
      playersList.appendChild(row);
    });
  }

  // ── Stats ──

  function renderStats(players) {
    var numericVotes = [];
    players.forEach(function(p) {
      if (!p.isObserver && p.vote !== null && p.vote !== '?' && p.vote !== 'coffee') {
        var n = Number(p.vote);
        if (!isNaN(n)) {
          numericVotes.push(n);
        }
      }
    });

    if (numericVotes.length === 0) {
      statAverage.textContent = '\\u2013';
      statMedian.textContent = '\\u2013';
      statVotes.textContent = '0';
      return;
    }

    numericVotes.sort(function(a, b) { return a - b; });

    var sum = numericVotes.reduce(function(a, b) { return a + b; }, 0);
    var avg = (sum / numericVotes.length).toFixed(1);

    var mid = Math.floor(numericVotes.length / 2);
    var median;
    if (numericVotes.length % 2 === 0) {
      median = ((numericVotes[mid - 1] + numericVotes[mid]) / 2).toFixed(1);
    } else {
      median = numericVotes[mid].toFixed(1);
    }
    // Remove trailing .0
    statMedian.textContent = median.replace(/\\.0$/, '');
    statAverage.textContent = avg.replace(/\\.0$/, '');

    statVotes.textContent = String(numericVotes.length);
  }

  // ── Final cards ──

  function renderFinalCards(players, finalVote) {
    while (finalCardsEl.firstChild) {
      finalCardsEl.removeChild(finalCardsEl.firstChild);
    }
    // Collect unique voted values (non-null, non-observer)
    var seen = {};
    var uniqueVotes = [];
    players.forEach(function(p) {
      if (!p.isObserver && p.vote !== null) {
        var key = String(p.vote);
        if (!seen[key]) {
          seen[key] = true;
          uniqueVotes.push(p.vote);
        }
      }
    });
    // Sort numeric values, put non-numeric at end
    uniqueVotes.sort(function(a, b) {
      var na = Number(a), nb = Number(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      if (!isNaN(na)) return -1;
      if (!isNaN(nb)) return 1;
      return String(a).localeCompare(String(b));
    });
    uniqueVotes.forEach(function(val) {
      var btn = document.createElement('button');
      btn.className = 'final-card';
      if (String(finalVote) === String(val)) {
        btn.classList.add('selected');
      }
      btn.setAttribute('data-value', String(val));
      btn.textContent = val === 'coffee' ? '\\u2615' : val === 0.5 ? '\\u00BD' : String(val);
      finalCardsEl.appendChild(btn);
    });
  }

  finalCardsEl.addEventListener('click', function(e) {
    var card = e.target.closest('.final-card');
    if (!card) return;
    var value = card.getAttribute('data-value');
    var parsed = isNaN(Number(value)) ? value : Number(value);
    // Toggle: if already selected, deselect
    var currentlySelected = card.classList.contains('selected');
    send({ type: 'final', value: currentlySelected ? null : parsed });
  });

  // ── Timer ──


  function clearTimers() {
    if (votingInterval) { clearInterval(votingInterval); votingInterval = null; }
    if (discussionInterval) { clearInterval(discussionInterval); discussionInterval = null; }
  }

  function updateTimers(roundStartTime, revealTime, finalVote, discussionPausedAt, discussionPausedTotal) {
    clearTimers();

    // Both stopped
    if (roundStartTime === 0) {
      votingTimerEl.textContent = '0:00';
      votingTimerEl.className = 'timer';
      discussionTimerEl.textContent = '0:00';
      discussionTimerEl.className = 'timer timer-dim';
      return;
    }

    // Voting active, discussion waiting
    if (revealTime === 0) {
      discussionTimerEl.textContent = '0:00';
      discussionTimerEl.className = 'timer timer-dim';
      votingTimerEl.className = 'timer';
      function voteTick() {
        var elapsed = Math.max(0, Math.floor((Date.now() - roundStartTime) / 1000));
        votingTimerEl.textContent = formatTime(elapsed);
      }
      voteTick();
      votingInterval = setInterval(voteTick, 1000);
      return;
    }

    // Revealed — voting frozen
    var votingElapsed = Math.max(0, Math.floor((revealTime - roundStartTime) / 1000));
    votingTimerEl.textContent = formatTime(votingElapsed);

    if (finalVote !== null) {
      // Final selected — both frozen, both full white
      votingTimerEl.className = 'timer';
      discussionTimerEl.className = 'timer';
      // Show frozen discussion time (time from reveal to when pause started, minus prior pauses)
      var frozenElapsed = Math.max(0, Math.floor((discussionPausedAt - revealTime - discussionPausedTotal) / 1000));
      discussionTimerEl.textContent = formatTime(frozenElapsed);
      return;
    }

    // No final — voting dimmed, discussion ticking (subtract total paused time)
    votingTimerEl.className = 'timer timer-dim';
    discussionTimerEl.className = 'timer';
    function discTick() {
      var elapsed = Math.max(0, Math.floor((Date.now() - revealTime - discussionPausedTotal) / 1000));
      discussionTimerEl.textContent = formatTime(elapsed);
    }
    discTick();
    discussionInterval = setInterval(discTick, 1000);
  }

  // ── Timeout overlay ──

  function showTimeoutOverlay() {
    // Prevent duplicate overlays
    if (document.getElementById('timeout-overlay')) return;
    clearTimers();
    var overlay = document.createElement('div');
    overlay.id = 'timeout-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
    var card = document.createElement('div');
    card.style.cssText = 'background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:48px;text-align:center;max-width:400px';
    var heading = document.createElement('h2');
    heading.style.cssText = 'color:#fff;margin:0 0 12px 0;font-size:1.4rem';
    heading.textContent = 'Session Ended';
    var msg = document.createElement('p');
    msg.style.cssText = 'color:rgba(255,255,255,0.7);margin:0 0 32px 0;font-size:1rem;line-height:1.5';
    msg.textContent = 'This session has ended due to inactivity. Looks like everyone fell asleep!';
    var btn = document.createElement('a');
    btn.href = '/';
    btn.style.cssText = 'display:inline-block;background:#6c5ce7;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:1rem;transition:background 0.15s';
    btn.textContent = 'Back to Home';
    btn.onmouseenter = function() { btn.style.background = '#7c6cf7'; };
    btn.onmouseleave = function() { btn.style.background = '#6c5ce7'; };
    card.appendChild(heading);
    card.appendChild(msg);
    card.appendChild(btn);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  // ── Join logic ──

  function join(observer) {
    name = nameInput.value.trim();
    isObserver = observer;
    // Disable buttons and show connecting state — don't hide yet
    joinPlayerBtn.disabled = true;
    joinObserverBtn.disabled = true;
    joinPlayerBtn.textContent = 'Connecting\\u2026';
    connect();
  }

  // ── Event listeners ──

  joinPlayerBtn.addEventListener('click', function() {
    join(false);
  });

  joinObserverBtn.addEventListener('click', function() {
    join(true);
  });

  nameInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      join(false);
    }
  });

  // Card click (event delegation)
  cardsRow.addEventListener('click', function(e) {
    var card = e.target.closest('.vote-card');
    if (!card) return;
    var value = card.getAttribute('data-value');
    // Parse numeric values
    var parsed = isNaN(Number(value)) ? value : Number(value);
    if (String(selectedVote) === String(parsed)) {
      // Deselect
      selectedVote = null;
      send({ type: 'vote', value: null });
    } else {
      selectedVote = parsed;
      send({ type: 'vote', value: parsed });
    }
    // Update visual selection
    var cards = cardsRow.querySelectorAll('.vote-card');
    cards.forEach(function(c) {
      c.classList.toggle('selected', String(c.getAttribute('data-value')) === String(selectedVote));
    });
  });

  showVotesBtn.addEventListener('click', function() {
    if (lastRoundStartTime === 0) {
      send({ type: 'start' });
    } else {
      send({ type: 'reveal' });
    }
  });

  newRoundBtn.addEventListener('click', function() {
    selectedVote = null;
    send({ type: 'clear' });
  });

  storyEl.addEventListener('blur', function() {
    send({ type: 'story', text: storyEl.value });
  });

  sessionIdCopy.addEventListener('click', function() {
    navigator.clipboard.writeText(location.href).then(function() {
      showToast('Invite link copied!');
    });
  });

  // ── Story setup ──

  function renderLocalStories() {
    while (storyListItems.firstChild) {
      storyListItems.removeChild(storyListItems.firstChild);
    }
    localStories.forEach(function(text, i) {
      var item = document.createElement('div');
      item.className = 'story-list-item';

      var numSpan = document.createElement('span');
      numSpan.className = 'story-num';
      numSpan.textContent = String(i + 1) + '.';
      item.appendChild(numSpan);

      var textSpan = document.createElement('span');
      textSpan.className = 'story-text';
      textSpan.textContent = text;
      item.appendChild(textSpan);

      var removeBtn = document.createElement('button');
      removeBtn.className = 'story-remove';
      removeBtn.textContent = '\\u00d7';
      removeBtn.setAttribute('data-index', String(i));
      item.appendChild(removeBtn);

      storyListItems.appendChild(item);
    });
  }

  storyAddBtn.addEventListener('click', function() {
    var text = storyAddInput.value.trim();
    if (!text) return;
    localStories.push(text);
    storyAddInput.value = '';
    renderLocalStories();
    storyAddInput.focus();
  });

  storyAddInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      storyAddBtn.click();
    }
  });

  storyListItems.addEventListener('click', function(e) {
    var btn = e.target.closest('.story-remove');
    if (!btn) return;
    var idx = Number(btn.getAttribute('data-index'));
    localStories.splice(idx, 1);
    renderLocalStories();
  });

  storyStartBtn.addEventListener('click', function() {
    if (localStories.length > 0) {
      send({ type: 'set-stories', stories: localStories });
    } else {
      send({ type: 'skip-setup' });
    }
    storySetup.classList.add('view-exit');
    setTimeout(function() {
      storySetup.classList.add('hidden');
      storySetup.classList.remove('view-exit');
      session.classList.remove('hidden');
      session.classList.add('view-enter');
      setTimeout(function() {
        session.classList.remove('view-enter');
      }, 250);
    }, 200);
  });


  // ── Story navigation ──

  storyPrevBtn.addEventListener('click', function() {
    send({ type: 'story-prev' });
  });

  storyNextBtn.addEventListener('click', function() {
    send({ type: 'story-next' });
  });

})();
`;
