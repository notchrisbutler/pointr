export const CLIENT_JS = `(function() {
  'use strict';

  // ── State ──
  var ws = null;
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
    var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var url = protocol + '//' + location.host + '/ws/' + sessionId;
    ws = new WebSocket(url);

    ws.onopen = function() {
      send({ type: 'join', name: name, isObserver: isObserver });
    };

    ws.onmessage = function(event) {
      var data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        return;
      }
      if (data.type === 'state') {
        handleState(data);
      } else if (data.type === 'error') {
        showToast(data.message);
      }
    };

    ws.onclose = function() {
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

    lastRoundStartTime = data.roundStartTime;
    var timerKey = data.roundStartTime + ':' + data.revealTime + ':' + data.finalVote + ':' + data.discussionPausedTotal;
    if (timerKey !== lastTimerKey) {
      lastTimerKey = timerKey;
      updateTimers(data.roundStartTime, data.revealTime, data.finalVote, data.discussionPausedAt || 0, data.discussionPausedTotal || 0);
    }

    // Render cards from pointValues (skip if observer)
    renderCards(data.pointValues, data.revealed);

    // Render players
    renderPlayers(data.players, data.revealed);

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
    // Story textarea: only host can edit in generic mode
    if (!data.stories || data.stories.length === 0) {
      storyEl.readOnly = !amHost;
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

  function renderPlayers(players, revealed) {
    playersCount.textContent = '(' + players.length + ')';

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
      function voteTick() {
        var elapsed = Math.max(0, Math.floor((Date.now() - roundStartTime) / 1000));
        votingTimerEl.textContent = formatTime(elapsed);
        votingTimerEl.className = 'timer';
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
    function discTick() {
      var elapsed = Math.max(0, Math.floor((Date.now() - revealTime - discussionPausedTotal) / 1000));
      discussionTimerEl.textContent = formatTime(elapsed);
      discussionTimerEl.className = 'timer';
    }
    discTick();
    discussionInterval = setInterval(discTick, 1000);
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
