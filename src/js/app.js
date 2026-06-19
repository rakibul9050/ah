(function () {
  'use strict';

  const API_BASE = 'https://streamed.pk';
  const CACHE_TTL = 60000;

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

  let cache = {};

  async function api(url) {
    var cached = cache[url];
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
    var res = await fetch(url);
    if (!res.ok) throw new Error('API ' + res.status);
    var data = await res.json();
    cache[url] = { data: data, ts: Date.now() };
    return data;
  }

  function badgeUrl(id) { return id ? API_BASE + '/api/images/badge/' + id + '.webp' : ''; }
  function posterUrl(p) { return p ? API_BASE + p : ''; }

  var EMOJI = {
    football: '\u26BD', basketball: '\uD83C\uDFC0', tennis: '\uD83C\uDFBE',
    fight: '\uD83E\uDD4A', 'motor-sports': '\uD83C\uDFCE\uFE0F', hockey: '\uD83C\uDFD2',
    baseball: '\u26BE', rugby: '\uD83C\uDFC9', cricket: '\uD83C\uDFCF',
    golf: '\u26F3', 'american-football': '\uD83C\uDFC8', afl: '\uD83C\uDFC9',
    billiards: '\uD83C\uDFB1', darts: '\uD83C\uDFAF', other: '\uD83C\uDFC5'
  };

  function sportEmoji(id) { return EMOJI[id] || '\uD83C\uDFC5'; }

  function isLive(m) {
    var now = Date.now();
    return m.date > 0 && m.date <= now && m.date > now - 7200000;
  }

  function safeMatch(m) {
    if (!m) return {};
    return {
      id: m.id || '',
      title: m.title || '',
      category: m.category || 'other',
      date: typeof m.date === 'number' ? m.date : 0,
      poster: m.poster || '',
      popular: !!m.popular,
      teams: m.teams || null,
      sources: Array.isArray(m.sources) ? m.sources : []
    };
  }

  var DOM = {};

  function initDom() {
    var ids = [
      'navbar', 'navPills', 'liveCountText',
      'liveSection', 'liveGrid', 'liveCount',
      'todaySection', 'todayGrid', 'todayGroups',
      'browseSection', 'browseGrid', 'sportPills',
      'popularSection', 'popularScroll',
      'heroWatchBtn', 'heroScheduleBtn',
      'statLive', 'statEvents', 'statSports',
      'searchToggle', 'searchOverlay', 'searchBackdrop',
      'searchInput', 'searchResults', 'searchClear',
      'playerModal', 'modalIframe', 'modalTitle',
      'modalStreams', 'modalInfo', 'modalClose', 'modalLoading',
      'toastContainer', 'popularToggle', 'browsePopularToggle',
      'liveCounterBtn'
    ];
    ids.forEach(function (id) {
      DOM[id] = $( '#' + id );
      if (!DOM[id]) console.warn('Missing element:', id);
    });
  }

  function skeletonGrid(n) {
    n = n || 6;
    var h = '<div class="skel-grid">';
    for (var i = 0; i < n; i++) h += '<div class="skeleton"></div>';
    return h + '</div>';
  }

  function skeletonHScroll(n) {
    n = n || 5;
    var h = '<div class="skel-row">';
    for (var i = 0; i < n; i++) h += '<div class="skeleton"></div>';
    return h + '</div>';
  }

  function cardHtml(m) {
    m = safeMatch(m);
    var live = isLive(m);
    var ended = m.date > 0 && m.date < Date.now() - 7200000;
    var future = m.date > Date.now();
    var hasTeams = m.teams && m.teams.home && m.teams.away;
    var badgeHtml = '';

    if (hasTeams) {
      var hb = m.teams.home.badge ? badgeUrl(m.teams.home.badge) : '';
      var ab = m.teams.away.badge ? badgeUrl(m.teams.away.badge) : '';
      badgeHtml = '<div class="match-teams">'
        + '<div class="match-team">'
        + '<img class="match-team-badge" src="' + hb + '" alt="' + m.teams.home.name + '" width="44" height="44" loading="lazy" onerror="this.onerror=null;this.src=\'src/img/placeholder-badge.svg\'">'
        + '<span class="match-team-name">' + esc(m.teams.home.name) + '</span></div>'
        + '<span class="match-vs">VS</span>'
        + '<div class="match-team">'
        + '<img class="match-team-badge" src="' + ab + '" alt="' + m.teams.away.name + '" width="44" height="44" loading="lazy" onerror="this.onerror=null;this.src=\'src/img/placeholder-badge.svg\'">'
        + '<span class="match-team-name">' + esc(m.teams.away.name) + '</span></div>'
        + '</div>';
    } else {
      badgeHtml = '<div class="match-title">' + esc(m.title) + '</div>';
    }

    var statusBadge = '';
    if (live) statusBadge = '<span class="match-badge live">LIVE</span>';
    else if (ended) statusBadge = '<span class="match-badge ended">ENDED</span>';
    else if (future) statusBadge = '<span class="match-badge countdown" data-countdown="' + m.date + '">--:--:--</span>';
    else if (m.date === 0) statusBadge = '<span class="match-badge live">ON AIR</span>';

    var sc = m.sources.length;
    var poster = m.poster ? posterUrl(m.poster) : '';

    var cls = 'match-card' + (live ? ' live' : '') + (poster ? ' poster' : '');

    return '<div class="' + cls + '" data-id="' + m.id + '" role="listitem" tabindex="0">'
      + (poster ? '<div class="match-bg" style="background-image:url(\'' + poster + '\')"></div>' : '')
      + '<div class="match-inner">'
      + badgeHtml
      + '<div class="match-meta">'
      + '<span class="match-category">' + sportEmoji(m.category) + ' ' + m.category + '</span>'
      + statusBadge
      + '</div>'
      + '<span class="match-streams">' + sc + ' stream' + (sc !== 1 ? 's' : '') + ' available</span>'
      + '<button class="match-btn">\u25B6 Watch Now</button>'
      + '</div></div>';
  }

  function popularCardHtml(m) {
    m = safeMatch(m);
    var live = isLive(m);
    var poster = m.poster ? posterUrl(m.poster) : '';
    var bg = poster
      ? '<div class="pop-bg" style="background-image:url(\'' + poster + '\')"></div>'
      : '<div class="pop-bg" style="background:var(--bg-surface);display:flex;align-items:center;justify-content:center;font-size:48px">' + sportEmoji(m.category) + '</div>';
    return '<div class="popular-card" data-id="' + m.id + '" tabindex="0" role="listitem">'
      + bg
      + '<div class="pop-overlay"></div>'
      + '<div class="pop-info">'
      + (live ? '<span class="pop-badge">LIVE</span>' : '')
      + '<div class="pop-title">' + esc(m.title) + '</div>'
      + '<div class="pop-category">' + m.category + '</div>'
      + '</div></div>';
  }

  function searchItemHtml(m) {
    m = safeMatch(m);
    var live = isLive(m);
    return '<div class="search-item" data-id="' + m.id + '" tabindex="0">'
      + '<div class="search-item-info">'
      + '<span class="search-item-title">' + esc(m.title) + '</span>'
      + '<span class="search-item-meta">' + sportEmoji(m.category) + ' ' + m.category + (live ? ' \u2022 LIVE' : '') + '</span>'
      + '</div>'
      + '<span class="search-item-action">\u25B6 Watch</span>'
      + '</div>';
  }

  function esc(s) {
    if (typeof s !== 'string') return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // State
  var state = {
    sports: [], liveMatches: [], todayMatches: [],
    popularMatches: [], browseMatches: [],
    currentSport: 'football', allMatches: []
  };

  // Toast
  function toast(msg, type) {
    type = type || 'info';
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    if (DOM.toastContainer) DOM.toastContainer.appendChild(el);
    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transition = 'opacity 300ms';
      setTimeout(function () { el.remove(); }, 300);
    }, 4000);
  }

  // Player
  var currentMatch = null;
  var currentStreams = [];
  var activeStreamIndex = 0;
  var fallbackTimer = null;
  var triedStreams = {};

  async function openPlayer(match) {
    if (!match || !DOM.playerModal || DOM.playerModal.classList.contains('open')) return;
    currentMatch = match;
    triedStreams = {};
    if (DOM.modalTitle) DOM.modalTitle.textContent = match.title;
    DOM.playerModal.classList.add('open');
    if (DOM.modalLoading) DOM.modalLoading.style.display = 'flex';
    if (DOM.modalIframe) DOM.modalIframe.src = '';
    if (DOM.modalStreams) DOM.modalStreams.innerHTML = '';

    if (DOM.modalInfo) {
      if (match.teams && match.teams.home && match.teams.away) {
        var hb = match.teams.home.badge ? badgeUrl(match.teams.home.badge) : '';
        var ab = match.teams.away.badge ? badgeUrl(match.teams.away.badge) : '';
        var d = match.date ? new Date(match.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Ongoing';
        DOM.modalInfo.innerHTML = '<img class="modal-team-badge" src="' + hb + '" alt="" onerror="this.style.display=\'none\'">'
          + '<span>' + esc(match.teams.home.name) + '</span>'
          + '<span style="color:var(--text-secondary)">vs</span>'
          + '<img class="modal-team-badge" src="' + ab + '" alt="" onerror="this.style.display=\'none\'">'
          + '<span>' + esc(match.teams.away.name) + '</span>'
          + '<span>\u00B7</span><span>' + match.category + '</span>'
          + '<span>\u00B7</span><span>' + d + '</span>';
      } else {
        DOM.modalInfo.innerHTML = '<span>' + match.category + '</span>';
      }
    }

    var sources = match.sources || [];
    if (sources.length === 0) {
      if (DOM.modalLoading) DOM.modalLoading.style.display = 'none';
      if (DOM.modalIframe) DOM.modalIframe.style.display = 'none';
      if (DOM.modalStreams) DOM.modalStreams.innerHTML = '<span style="color:var(--text-secondary);font-size:13px;padding:8px 0">No streams available.</span>';
      return;
    }

    var results = await Promise.allSettled(sources.map(function (s) {
      return api(API_BASE + '/api/stream/' + s.source + '/' + s.id + '?_=' + Date.now());
    }));

    currentStreams = [];
    var seen = {};
    results.forEach(function (r) {
      if (r.status !== 'fulfilled' || !r.value) return;
      r.value.forEach(function (s) {
        var key = s.embedUrl || (s.source + '|' + s.language);
        if (!seen[key]) { seen[key] = true; currentStreams.push(s); }
      });
    });

    if (currentStreams.length === 0) {
      if (DOM.modalLoading) DOM.modalLoading.style.display = 'none';
      if (DOM.modalStreams) DOM.modalStreams.innerHTML = '<span style="color:var(--accent-red);font-size:13px;padding:8px 0">No streams available.</span>';
      toast('No streams for this match', 'error');
      return;
    }

    renderStreamPills();
    loadStream(0);
  }

  function renderStreamPills() {
    if (!DOM.modalStreams) return;
    DOM.modalStreams.innerHTML = '';
    currentStreams.forEach(function (s, i) {
      var active = i === activeStreamIndex;
      var btn = document.createElement('button');
      btn.className = 'stream-pill' + (active ? ' active' : '');
      btn.dataset.index = i;
      btn.innerHTML = (active ? '\u25CF' : '\u25CB') + ' ' + (s.source || '') + ' ' + (s.language || '')
        + (s.hd ? ' <span class="hd">HD</span>' : '');
      btn.addEventListener('click', function () {
        var idx = parseInt(this.dataset.index);
        if (idx !== activeStreamIndex) {
          activeStreamIndex = idx;
          triedStreams = {};
          loadStream(idx);
        }
      });
      DOM.modalStreams.appendChild(btn);
    });

    if (currentStreams.length > 1) {
      var skipBtn = document.createElement('button');
      skipBtn.className = 'stream-pill skip-pill';
      skipBtn.textContent = '\u23ED Skip \u2014 Lagging?';
      skipBtn.addEventListener('click', function () {
        var next = (activeStreamIndex + 1) % currentStreams.length;
        if (next !== activeStreamIndex) {
          activeStreamIndex = next;
          triedStreams = {};
          toast('Switching stream...', 'info');
          loadStream(next);
        }
      });
      DOM.modalStreams.appendChild(skipBtn);
    }
  }

  function loadStream(index) {
    var s = currentStreams[index];
    if (!s) return;
    activeStreamIndex = index;
    triedStreams[index] = true;
    if (DOM.modalLoading) DOM.modalLoading.style.display = 'flex';
    if (DOM.modalIframe) DOM.modalIframe.src = s.embedUrl || '';
    renderStreamPills();
    if (fallbackTimer) clearTimeout(fallbackTimer);
    fallbackTimer = setTimeout(function () {
      if (DOM.modalLoading && DOM.modalLoading.style.display !== 'none') {
        var next = (activeStreamIndex + 1) % currentStreams.length;
        if (next !== activeStreamIndex && !triedStreams[next]) {
          toast('Auto-switching to next stream...', 'info');
          loadStream(next);
        } else {
          toast('All streams failed to load.', 'error');
          if (DOM.modalLoading) DOM.modalLoading.style.display = 'none';
        }
      }
    }, 10000);
  }

  function closePlayer() {
    if (DOM.playerModal) DOM.playerModal.classList.remove('open');
    if (DOM.modalIframe) DOM.modalIframe.src = '';
    currentMatch = null;
    currentStreams = [];
    activeStreamIndex = 0;
    triedStreams = {};
    if (DOM.modalLoading) DOM.modalLoading.style.display = 'flex';
    if (fallbackTimer) clearTimeout(fallbackTimer);
  }

  // Search
  function openSearch() {
    if (DOM.searchOverlay) DOM.searchOverlay.classList.add('open');
    if (DOM.searchInput) { DOM.searchInput.value = ''; }
    if (DOM.searchResults) DOM.searchResults.innerHTML = '';
    setTimeout(function () { if (DOM.searchInput) DOM.searchInput.focus(); }, 200);
  }

  function closeSearch() {
    if (DOM.searchOverlay) DOM.searchOverlay.classList.remove('open');
  }

  function findMatch(id) {
    for (var i = 0; i < state.allMatches.length; i++) {
      if (state.allMatches[i].id === id) return state.allMatches[i];
    }
    return null;
  }

  function bindCards(container) {
    if (!container) return;
    var cards = container.querySelectorAll('.match-card');
    cards.forEach(function (el) {
      el.addEventListener('click', function () {
        var m = findMatch(el.dataset.id);
        if (m) openPlayer(m);
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          var m = findMatch(el.dataset.id);
          if (m) openPlayer(m);
        }
      });
    });
  }

  function bindPopularCards(container) {
    if (!container) return;
    var cards = container.querySelectorAll('.popular-card');
    cards.forEach(function (el) {
      el.addEventListener('click', function () {
        var m = findMatch(el.dataset.id);
        if (m) openPlayer(m);
      });
    });
  }

  // Render functions
  function renderLive(matches) {
    if (!DOM.liveGrid) return;
    if (!matches || matches.length === 0) {
      DOM.liveGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-secondary)">'
        + '<div style="font-size:48px;margin-bottom:12px">\uD83D\uDCE1</div>'
        + '<p style="font-size:15px;margin-bottom:4px">Nothing live right now.</p>'
        + '<p style="font-size:13px">Check back soon.</p></div>';
      if (DOM.liveCount) DOM.liveCount.textContent = '0 matches';
      return;
    }
    DOM.liveGrid.innerHTML = matches.map(cardHtml).join('');
    if (DOM.liveCount) DOM.liveCount.textContent = matches.length + ' match' + (matches.length !== 1 ? 'es' : '');
    if (DOM.statLive) DOM.statLive.textContent = matches.length;
    if (DOM.liveCountText) DOM.liveCountText.textContent = matches.length + ' LIVE';
    bindCards(DOM.liveGrid);
  }

  function renderToday(matches) {
    if (!DOM.todayGrid) return;
    if (!matches || matches.length === 0) {
      DOM.todayGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-secondary)">'
        + '<div style="font-size:48px;margin-bottom:12px">\uD83D\uDCC5</div>'
        + '<p style="font-size:15px;margin-bottom:4px">No matches scheduled today.</p>'
        + '<p style="font-size:13px">Check back later.</p></div>';
      return;
    }
    var groups = {};
    matches.forEach(function (m) {
      var cat = m.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(m);
    });
    var html = '';
    var keys = Object.keys(groups);
    for (var g = 0; g < keys.length; g++) {
      var cat = keys[g];
      var catMatches = groups[cat];
      var catName = cat.charAt(0).toUpperCase() + cat.slice(1);
      html += '<h3 style="font-family:var(--font-display);font-size:22px;margin:24px 0 12px;letter-spacing:0.5px">'
        + sportEmoji(cat) + ' ' + catName + '</h3>';
      html += '<div class="match-grid" style="margin-bottom:8px">' + catMatches.map(cardHtml).join('') + '</div>';
    }
    DOM.todayGrid.innerHTML = html;
    bindCards(DOM.todayGrid);
  }

  function renderBrowse(matches) {
    if (!DOM.browseGrid) return;
    if (!matches || matches.length === 0) {
      DOM.browseGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-secondary)">'
        + '<div style="font-size:48px;margin-bottom:12px">\uD83C\uDFC6</div>'
        + '<p style="font-size:15px">No matches for this sport.</p></div>';
      return;
    }
    DOM.browseGrid.innerHTML = matches.map(cardHtml).join('');
    bindCards(DOM.browseGrid);
  }

  function renderPopular(matches) {
    if (!DOM.popularScroll) return;
    if (!matches || matches.length === 0) {
      DOM.popularScroll.innerHTML = '';
      return;
    }
    DOM.popularScroll.innerHTML = matches.map(popularCardHtml).join('');
    bindPopularCards(DOM.popularScroll);
  }

  function renderSportPills(sports) {
    if (!DOM.sportPills) return;
    DOM.sportPills.innerHTML = sports.map(function (s) {
      var active = s.id === state.currentSport;
      return '<button class="sport-pill' + (active ? ' active' : '') + '" data-sport="' + s.id + '" role="tab">'
        + sportEmoji(s.id) + ' ' + s.name + '</button>';
    }).join('');
    DOM.sportPills.querySelectorAll('.sport-pill').forEach(function (el) {
      el.addEventListener('click', async function () {
        var active = DOM.sportPills.querySelector('.active');
        if (active) active.classList.remove('active');
        el.classList.add('active');
        state.currentSport = el.dataset.sport;
        DOM.browseGrid.innerHTML = skeletonGrid();
        try {
          var matches;
          if (state.browseMode === 'popular') {
            matches = await api(API_BASE + '/api/matches/all/popular');
            matches = matches.filter(function (m) { return m.category === state.currentSport; });
          } else {
            matches = await api(API_BASE + '/api/matches/' + state.currentSport);
          }
          state.browseMatches = matches || [];
          mergeMatches(matches);
          renderBrowse(matches);
          animateCards();
        } catch (e) {
          DOM.browseGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px">'
            + '<p style="color:var(--accent-red);margin-bottom:12px">Failed to load.</p>'
            + '<button class="btn btn-ghost" onclick="location.reload()">Retry</button></div>';
        }
      });
    });
  }

  function renderNavPills(sports) {
    if (!DOM.navPills) return;
    var maxPills = Math.min(sports.length, 6);
    DOM.navPills.innerHTML = '';
    for (var i = 0; i < maxPills; i++) {
      var s = sports[i];
      var btn = document.createElement('button');
      btn.className = 'nav-pill' + (s.id === 'football' ? ' active' : '');
      btn.dataset.sport = s.id;
      btn.textContent = s.name;
      btn.addEventListener('click', function () {
        var act = DOM.navPills.querySelector('.active');
        if (act) act.classList.remove('active');
        this.classList.add('active');
        var sportId = this.dataset.sport;
        var section = $('#browseSection');
        if (section) section.scrollIntoView({ behavior: 'smooth' });
        var pill = DOM.sportPills ? DOM.sportPills.querySelector('[data-sport="' + sportId + '"]') : null;
        if (pill) pill.click();
      });
      DOM.navPills.appendChild(btn);
    }
    if (sports.length > 6) {
      var more = document.createElement('button');
      more.className = 'nav-pill more-pill';
      more.textContent = 'More \u25BE';
      more.addEventListener('click', function () {
        var section = $('#browseSection');
        if (section) section.scrollIntoView({ behavior: 'smooth' });
      });
      DOM.navPills.appendChild(more);
    }
  }

  function mergeMatches(incoming) {
    if (!incoming) return;
    var map = {};
    state.allMatches.forEach(function (m) { map[m.id] = m; });
    incoming.forEach(function (m) { if (m && m.id) map[m.id] = m; });
    state.allMatches = Object.values(map);
  }

  // Countdown
  var countdownInterval = null;

  function updateCountdowns() {
    var els = document.querySelectorAll('[data-countdown]');
    els.forEach(function (el) {
      var ts = parseInt(el.dataset.countdown);
      var diff = ts - Date.now();
      if (diff <= 0) {
        el.textContent = 'STARTING';
        el.className = 'match-badge live';
        return;
      }
      var h = Math.floor(diff / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);
      el.textContent = pad(h) + ':' + pad(m) + ':' + pad(s);
    });
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function startCountdowns() {
    if (countdownInterval) clearInterval(countdownInterval);
    updateCountdowns();
    countdownInterval = setInterval(updateCountdowns, 1000);
  }

  // Card animation via direct class toggle
  function animateCards() {
    var containers = document.querySelectorAll('.match-grid, .popular-scroll');
    containers.forEach(function (container) {
      var cards = container.querySelectorAll('.match-card, .popular-card');
      cards.forEach(function (card, i) {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 400ms ease-out ' + (i * 40) + 'ms, transform 400ms ease-out ' + (i * 40) + 'ms';
        requestAnimationFrame(function () {
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        });
      });
    });
  }

  // Toggle handlers
  function setupToggles() {
    if (DOM.popularToggle) {
      DOM.popularToggle.addEventListener('click', async function () {
        var isPopular = DOM.popularToggle.classList.toggle('active');
        DOM.popularToggle.textContent = isPopular ? 'Popular' : 'All';
        DOM.todayGrid.innerHTML = skeletonGrid();
        try {
          var matches;
          if (isPopular) matches = await api(API_BASE + '/api/matches/all/popular');
          else matches = await api(API_BASE + '/api/matches/all-today');
          state.todayMatches = matches || [];
          mergeMatches(matches);
          renderToday(matches);
          animateCards();
        } catch (e) {
          DOM.todayGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px">'
            + '<p style="color:var(--accent-red);margin-bottom:12px">Failed to load.</p>'
            + '<button class="btn btn-ghost" style="margin:0 auto" onclick="location.reload()">Retry</button></div>';
        }
      });
    }

    if (DOM.browsePopularToggle) {
      DOM.browsePopularToggle.addEventListener('click', async function () {
        var isPopular = DOM.browsePopularToggle.classList.toggle('active');
        DOM.browsePopularToggle.textContent = isPopular ? 'Popular' : 'All';
        DOM.browseGrid.innerHTML = skeletonGrid();
        try {
          var matches;
          if (isPopular) {
            matches = await api(API_BASE + '/api/matches/all/popular');
            matches = matches.filter(function (m) { return m.category === state.currentSport; });
          } else {
            matches = await api(API_BASE + '/api/matches/' + state.currentSport);
          }
          state.browseMatches = matches || [];
          mergeMatches(matches);
          renderBrowse(matches);
          animateCards();
        } catch (e) {
          DOM.browseGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px">'
            + '<p style="color:var(--accent-red);margin-bottom:12px">Failed to load.</p>'
            + '<button class="btn btn-ghost" style="margin:0 auto" onclick="location.reload()">Retry</button></div>';
        }
      });
    }
  }

  // Counter animation
  function animateCounter(el, target) {
    if (!el) return;
    var start = parseInt(el.textContent) || 0;
    var diff = target - start;
    var startTime = performance.now();

    function tick(now) {
      var elapsed = now - startTime;
      var progress = Math.min(elapsed / 800, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(start + diff * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    setTimeout(function () { requestAnimationFrame(tick); }, 500);
  }

  // Search handler
  function setupSearch() {
    if (!DOM.searchInput || !DOM.searchResults) return;
    DOM.searchInput.addEventListener('input', function () {
      var q = DOM.searchInput.value.toLowerCase().trim();
      if (!q) { DOM.searchResults.innerHTML = ''; return; }
      var matches = [];
      for (var i = 0; i < state.allMatches.length; i++) {
        var m = state.allMatches[i];
        if (m.title && m.title.toLowerCase().indexOf(q) !== -1) matches.push(m);
        else if (m.category && m.category.toLowerCase().indexOf(q) !== -1) matches.push(m);
        if (matches.length >= 20) break;
      }
      if (matches.length === 0) {
        DOM.searchResults.innerHTML = '<div class="search-empty">No matches found</div>';
        return;
      }
      DOM.searchResults.innerHTML = matches.map(searchItemHtml).join('');
      DOM.searchResults.querySelectorAll('.search-item').forEach(function (el) {
        el.addEventListener('click', function () {
          var m = findMatch(el.dataset.id);
          if (m) { closeSearch(); openPlayer(m); }
        });
      });
    });
  }

  // Init
  async function init() {
    try {
      initDom();

      DOM.liveGrid.innerHTML = skeletonGrid();
      DOM.todayGrid.innerHTML = skeletonGrid();
      DOM.browseGrid.innerHTML = skeletonGrid();
      DOM.popularScroll.innerHTML = skeletonHScroll();

      var results = await Promise.all([
        api(API_BASE + '/api/sports').catch(function () { return []; }),
        api(API_BASE + '/api/matches/live').catch(function () { return []; }),
        api(API_BASE + '/api/matches/all-today').catch(function () { return []; }),
        api(API_BASE + '/api/matches/all/popular').catch(function () { return []; }),
        api(API_BASE + '/api/matches/football').catch(function () { return []; })
      ]);

      var sports = results[0] || [];
      var liveMatches = results[1] || [];
      var todayMatches = results[2] || [];
      var popularMatches = results[3] || [];
      var footballMatches = results[4] || [];

      state.sports = sports;
      state.liveMatches = liveMatches;
      state.todayMatches = todayMatches;
      state.popularMatches = popularMatches;
      state.browseMatches = footballMatches;

      var all = [].concat(liveMatches, todayMatches, popularMatches, footballMatches);
      mergeMatches(all);

      renderNavPills(sports);
      renderSportPills(sports);
      renderLive(liveMatches);
      renderToday(todayMatches);
      renderBrowse(footballMatches);
      renderPopular(popularMatches);

      if (DOM.statEvents) DOM.statEvents.textContent = todayMatches.length;
      if (DOM.statSports) DOM.statSports.textContent = sports.length;

      animateCounter(DOM.statLive, liveMatches.length);
      animateCounter(DOM.statEvents, todayMatches.length);
      animateCounter(DOM.statSports, sports.length);

      startCountdowns();
      animateCards();

      // Modal events
      if (DOM.modalClose) DOM.modalClose.addEventListener('click', closePlayer);
      if (DOM.playerModal) {
        DOM.playerModal.addEventListener('click', function (e) {
          if (e.target === DOM.playerModal) closePlayer();
        });
      }
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          if (DOM.playerModal && DOM.playerModal.classList.contains('open')) closePlayer();
          else if (DOM.searchOverlay && DOM.searchOverlay.classList.contains('open')) closeSearch();
        }
      });
      if (DOM.modalIframe) {
        DOM.modalIframe.addEventListener('load', function () {
          if (DOM.modalLoading) DOM.modalLoading.style.display = 'none';
          if (fallbackTimer) clearTimeout(fallbackTimer);
        });
      }

      // Search events
      if (DOM.searchToggle) DOM.searchToggle.addEventListener('click', openSearch);
      if (DOM.searchBackdrop) DOM.searchBackdrop.addEventListener('click', closeSearch);
      if (DOM.searchClear) {
        DOM.searchClear.addEventListener('click', function () {
          if (DOM.searchInput) DOM.searchInput.value = '';
          if (DOM.searchResults) DOM.searchResults.innerHTML = '';
          if (DOM.searchInput) DOM.searchInput.focus();
        });
      }
      setupSearch();

      // Scroll triggers
      if (DOM.heroWatchBtn) {
        DOM.heroWatchBtn.addEventListener('click', function () {
          var el = $('#liveSection');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        });
      }
      if (DOM.heroScheduleBtn) {
        DOM.heroScheduleBtn.addEventListener('click', function () {
          var el = $('#todaySection');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        });
      }
      if (DOM.liveCounterBtn) {
        DOM.liveCounterBtn.addEventListener('click', function () {
          var el = $('#liveSection');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        });
      }

      // Toggle controls
      setupToggles();

    } catch (e) {
      console.error('Init error:', e);
      var errHtml = '<div style="grid-column:1/-1;text-align:center;padding:80px 20px">'
        + '<div style="font-size:48px;margin-bottom:16px">\u26A0\uFE0F</div>'
        + '<h2 style="font-size:20px;margin-bottom:8px">Connection Error</h2>'
        + '<p style="color:var(--text-secondary);margin-bottom:8px">Could not reach the streaming service.</p>'
        + '<p style="color:var(--text-secondary);margin-bottom:20px;font-size:13px">Make sure you are running from a local server (not file://) and have internet access.</p>'
        + '<button class="btn btn-primary" onclick="location.reload()">Retry</button></div>';
      if (DOM.liveGrid) DOM.liveGrid.innerHTML = errHtml;
      if (DOM.todayGrid) DOM.todayGrid.innerHTML = errHtml;
      if (DOM.browseGrid) DOM.browseGrid.innerHTML = errHtml;
      if (DOM.liveCount) DOM.liveCount.textContent = '0 matches';
      if (DOM.liveCountText) DOM.liveCountText.textContent = '0 LIVE';
      toast('Failed to connect. Serve via HTTP server.', 'error');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
