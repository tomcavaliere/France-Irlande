// warmshowers.js
// WarmShowers hosts POI layer — admin only.
// Auth: session cookie via credentials:'include' so the browser manages the session cookie.
// Firebase config/warmshowersToken stores the session_name=sessid flag so the app knows a login
// has occurred; the browser holds the actual cookie.

var _wsLoading = false;

function toggleWarmshowers() {
  warmshowersVisible = !warmshowersVisible;
  var btn = document.getElementById('wsToggle');
  btn.classList.toggle('on-ws', warmshowersVisible);
  if (!warmshowersVisible) {
    if (warmshowersLayer) { map.removeLayer(warmshowersLayer); warmshowersLayer = null; }
    btn.textContent = '\u{1F3E0} WarmShowers';
    return;
  }
  loadWarmshowers();
}

function loadWarmshowers() {
  if (_wsLoading) return;
  var btn = document.getElementById('wsToggle');
  if (!window._fbGet || !window._fbRef || !window._fbDb) {
    console.error('[WarmShowers] Firebase non initialisé');
    return;
  }
  window._fbGet(window._fbRef(window._fbDb, 'config/warmshowersToken'))
    .then(function(snap) {
      if (!snap.val()) {
        _renewWarmshowersToken();
      } else {
        _fetchWarmshowersHosts();
      }
    })
    .catch(function(e) {
      console.error('[WarmShowers] Lecture token Firebase:', e);
      warmshowersVisible = false;
      btn.classList.remove('on-ws');
      btn.textContent = '\u{1F3E0} WarmShowers';
    });
}

function _renewWarmshowersToken() {
  var btn = document.getElementById('wsToggle');
  var username = window.prompt('WarmShowers \u2014 identifiant (email)\u00a0:');
  if (!username) { warmshowersVisible = false; btn.classList.remove('on-ws'); btn.textContent = '\u{1F3E0} WarmShowers'; return; }
  var password = window.prompt('WarmShowers \u2014 mot de passe\u00a0:');
  if (!password) { warmshowersVisible = false; btn.classList.remove('on-ws'); btn.textContent = '\u{1F3E0} WarmShowers'; return; }

  btn.textContent = '\u{1F3E0} connexion\u2026';
  _wsLoading = true;

  Utils.safeFetch('https://www.warmshowers.org/services/rest/user/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: 'name=' + encodeURIComponent(username) + '&pass=' + encodeURIComponent(password) + '&format=json',
    credentials: 'include'
  }, { retries: 0, timeout: 10000 })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (!d.sessid || !d.session_name) throw new Error('R\u00e9ponse auth invalide \u2014 sessid/session_name manquants');
      var flag = d.session_name + '=' + d.sessid;
      return window._fbSet(window._fbRef(window._fbDb, 'config/warmshowersToken'), flag);
    })
    .then(function() {
      _wsLoading = false;
      _fetchWarmshowersHosts();
    })
    .catch(function(e) {
      _wsLoading = false;
      console.error('[WarmShowers] Auth \u00e9chou\u00e9e:', e);
      warmshowersVisible = false;
      btn.classList.remove('on-ws');
      btn.textContent = '\u{1F3E0} WarmShowers';
      showToast('Connexion WarmShowers \u00e9chou\u00e9e \u2014 v\u00e9rifiez vos identifiants', 'warn');
    });
}

function _fetchWarmshowersHosts() {
  var btn = document.getElementById('wsToggle');
  var pos = getCurrentPos();
  var rangeKm = parseInt(document.getElementById('campRange').value) || 150;
  var aheadPts = routePointsAhead(pos ? pos.idx : 0, rangeKm);
  if (!aheadPts.length) { console.warn('[WarmShowers] Aucun point ahead'); return; }

  var bbox = ptsBbox(aheadPts, 0.1);
  var centerLat = ((bbox.s + bbox.n) / 2).toFixed(5);
  var centerLon = ((bbox.w + bbox.e) / 2).toFixed(5);
  var distMiles = Math.ceil(rangeKm * 0.621371);

  btn.textContent = '\u{1F3E0} chargement\u2026';
  _wsLoading = true;

  var body = 'latitude=' + centerLat +
    '&longitude=' + centerLon +
    '&distance=' + distMiles +
    '&limit=100' +
    '&minlat=' + bbox.s.toFixed(5) +
    '&maxlat=' + bbox.n.toFixed(5) +
    '&minlon=' + bbox.w.toFixed(5) +
    '&maxlon=' + bbox.e.toFixed(5) +
    '&format=json';

  Utils.safeFetch('https://www.warmshowers.org/services/rest/hosts/by_location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: body,
    credentials: 'include'
  }, { retries: 1, timeout: 15000 })
    .then(function(r) {
      if (r.status === 401) { var e = new Error('Unauthorized'); e.status = 401; throw e; }
      return r.json();
    })
    .then(function(d) {
      _wsLoading = false;
      renderWarmshowers(d.accounts || [], aheadPts);
    })
    .catch(function(e) {
      _wsLoading = false;
      console.error('[WarmShowers] Fetch h\u00f4tes:', e);
      if (e.status === 401) {
        window._fbRemove(window._fbRef(window._fbDb, 'config/warmshowersToken'));
        warmshowersVisible = false;
        btn.classList.remove('on-ws');
        btn.textContent = '\u{1F3E0} WarmShowers';
        showToast('Session WarmShowers expir\u00e9e \u2014 recliquez pour vous reconnecter', 'warn');
      } else {
        btn.textContent = '\u{1F3E0} erreur (r\u00e9essayer)';
      }
    });
}

function renderWarmshowers(accounts, aheadPts) {
  if (warmshowersLayer) { map.removeLayer(warmshowersLayer); warmshowersLayer = null; }

  var wsIcon = L.divIcon({
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    html: '<div class="poi-icon poi-icon-ws">&#x1f3e0;</div>'
  });

  var markers = [];
  accounts.forEach(function(a) {
    var lat = parseFloat(a.latitude);
    var lon = parseFloat(a.longitude);
    if (!lat || !lon) return;
    if (!window.CampingsCore) return;
    if (!CampingsCore.nearTrace(lat, lon, aheadPts, 10)) return;

    var name = escHtml(a.fullname || a.name || 'H\u00f4te WarmShowers');
    var available = a.currently_available === '1' || a.currently_available === true;
    var badge = available
      ? '<span class="camp-tag camp-tag-ws-ok">Disponible</span>'
      : '<span class="camp-tag camp-tag-ws-off">Indisponible</span>';
    var capacity = a.maxcyclists
      ? '<span class="camp-popup-muted">Max ' + escHtml(String(a.maxcyclists)) + ' cyclistes</span><br>'
      : '';
    var profileUrl = 'https://www.warmshowers.org/users/' + encodeURIComponent(a.uid || a.name || '');
    var dist = campingDistHtml(lat, lon);

    var popup = '<div class="camp-popup">' +
      '<b class="camp-popup-title-ws">' + name + '</b>' +
      '<div class="camp-tags">' + badge + '</div>' +
      capacity +
      dist +
      '<a href="' + escAttr(profileUrl) + '" target="_blank" class="camp-link camp-link-ws">Voir profil</a>' +
      '</div>';

    markers.push(L.marker([lat, lon], { icon: wsIcon }).bindPopup(popup));
  });

  warmshowersLayer = L.layerGroup(markers).addTo(map);
  document.getElementById('wsToggle').textContent = '\u{1F3E0} ' + markers.length + ' h\u00f4tes';
}
