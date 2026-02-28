export const CLIENT_JS = `(function() {
  'use strict';

  // ── State ──
  var ws = null;
  var name = '';
  var isObserver = false;
  var selectedVote = null;
  var timerInterval = null;
  var lastRoundStartTime = null;
  var storyDebounceTimer = null;
  var localStories = [];
  var storiesLocked = false;

  // ── DOM refs ──
  var lobby = document.getElementById('lobby');
  var session = document.getElementById('session');
  var nameInput = document.getElementById('name-input');
  var joinPlayerBtn = document.getElementById('join-player-btn');
  var joinObserverBtn = document.getElementById('join-observer-btn');
  var sessionIdCopy = document.getElementById('session-id-copy');
  var timerEl = document.getElementById('timer');
  var storyEl = document.getElementById('story');
  var cardsRow = document.getElementById('cards-row');
  var showVotesBtn = document.getElementById('show-votes-btn');
  var newRoundBtn = document.getElementById('new-round-btn');
  var statsRow = document.getElementById('stats-row');
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
  var storySkipBtn = document.getElementById('story-skip-btn');
  var storyNav = document.getElementById('story-nav');
  var storyPrevBtn = document.getElementById('story-prev-btn');
  var storyNextBtn = document.getElementById('story-next-btn');
  var storyProgress = document.getElementById('story-progress');

  var sessionId = document.body.dataset.sessionId;

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
    // Render cards from pointValues (skip if observer)
    renderCards(data.pointValues, data.revealed);

    // Render players
    renderPlayers(data.players, data.revealed);

    // Update story if not focused
    if (document.activeElement !== storyEl) {
      storyEl.value = data.story || '';
    }

    // Timer
    if (data.roundStartTime !== lastRoundStartTime) {
      lastRoundStartTime = data.roundStartTime;
      startTimer(data.roundStartTime);
    }

    // Show/hide stats
    if (data.revealed) {
      renderStats(data.players);
      statsRow.classList.remove('hidden');
    } else {
      statsRow.classList.add('hidden');
    }

    // Story navigation
    if (data.stories && data.stories.length > 0) {
      storyNav.classList.remove('hidden');
      storyProgress.textContent = (data.currentStoryIndex + 1) + ' of ' + data.stories.length;
      storyPrevBtn.disabled = data.currentStoryIndex === 0;
      storyNextBtn.disabled = data.currentStoryIndex === data.stories.length - 1;
      // If stories were set by another user, skip the setup screen
      if (!storiesLocked) {
        storiesLocked = true;
        storySetup.classList.add('hidden');
        session.classList.remove('hidden');
      }
    } else {
      storyNav.classList.add('hidden');
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
      if (revealed) {
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

  // ── Timer ──

  function startTimer(roundStartTime) {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (roundStartTime === 0) {
      timerEl.textContent = '0:00';
      return;
    }
    function tick() {
      var elapsed = Math.max(0, Math.floor((Date.now() - roundStartTime) / 1000));
      timerEl.textContent = formatTime(elapsed);
    }
    tick();
    timerInterval = setInterval(tick, 1000);
  }

  // ── Join logic ──

  function join(observer) {
    name = nameInput.value.trim();
    isObserver = observer;
    lobby.classList.add('hidden');
    // Show story setup screen instead of going directly to session
    storySetup.classList.remove('hidden');
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

  storyEl.addEventListener('input', function() {
    if (storyDebounceTimer) clearTimeout(storyDebounceTimer);
    storyDebounceTimer = setTimeout(function() {
      send({ type: 'story', text: storyEl.value });
    }, 300);
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
    storiesLocked = true;
    storySetup.classList.add('hidden');
    session.classList.remove('hidden');
    if (localStories.length > 0) {
      send({ type: 'set-stories', stories: localStories });
    }
  });

  storySkipBtn.addEventListener('click', function() {
    storiesLocked = true;
    storySetup.classList.add('hidden');
    session.classList.remove('hidden');
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
