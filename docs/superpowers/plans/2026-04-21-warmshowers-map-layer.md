# WarmShowers Map Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a WarmShowers hosts POI layer to the admin map, following the exact same pattern as the existing Campings/Campspace/Eau layers.

**Architecture:** New `js/warmshowers.js` module (toggle → load → render). Auth uses WarmShowers Drupal REST API with `credentials: 'include'` so the browser manages the session cookie. A string flag `config/warmshowersToken` in Firebase RTDB (auth-only) records the session name+id so the app knows a login has occurred. On 401, the flag is cleared and the user re-authenticates. CORS availability is validated at Task 7; a static-file fallback is provided at Task 8 if CORS is blocked.

**Tech Stack:** Leaflet 1.9.4, Firebase RTDB Modular SDK v10 (via `window._fbGet/Set/Remove/Ref/Db` globals), WarmShowers Drupal REST API (`warmshowers.org/services/rest/`), `Utils.safeFetch`.

---

## Files

| File | Action | Purpose |
|---|---|---|
| `firebase.rules.json` | Modify | Add `config/warmshowersToken` auth-only node |
| `js/state.js` | Modify | Add `warmshowersLayer`, `warmshowersVisible` vars |
| `styles.css` | Modify | Toggle button + POI icon + popup styles |
| `index.html` | Modify | Add `#wsToggle` button + `<script src="js/warmshowers.js">` |
| `js/campings.js` | Modify | Add `warmshowersVisible` check to `onCampRangeChange` |
| `js/warmshowers.js` | Create | Full module: toggle, load, render, token management |

No new `*-core.js`, no new tests — all code is DOM/IO layer (CLAUDE.md: "Code DOM-only → test non requis").

---

### Task 1: Firebase rules — add `config/warmshowersToken`

**Files:**
- Modify: `firebase.rules.json`

- [ ] Open `firebase.rules.json`. Insert the `config` block after the `"visitorAuth"` closing brace and before `"expenses"` (between lines 97 and 98):

```json
    "config": {
      "warmshowersToken": {
        ".read": "auth != null",
        ".write": "auth != null",
        ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 2000"
      }
    },
```

The resulting structure around that area should look like:

```json
    "visitorAuth": {
      ...
      "$other": { ".validate": false }
    },
    "config": {
      "warmshowersToken": {
        ".read": "auth != null",
        ".write": "auth != null",
        ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 2000"
      }
    },
    "expenses": {
```

- [ ] Run the tests to confirm nothing broke:

```bash
npm test
```

Expected: all 240 tests pass.

- [ ] Commit:

```bash
git add firebase.rules.json
git commit -m "feat: add config/warmshowersToken auth-only node to Firebase rules"
```

---

### Task 2: State variables

**Files:**
- Modify: `js/state.js:40-41`

- [ ] Open `js/state.js`. Find these two lines (around line 40):

```js
var map, completedLayer, posMarker, campingLayer = null, campspaceLayer = null, waterLayer = null;
var campingsVisible = false, campspaceVisible = false, waterVisible = false;
```

Replace with:

```js
var map, completedLayer, posMarker, campingLayer = null, campspaceLayer = null, waterLayer = null, warmshowersLayer = null;
var campingsVisible = false, campspaceVisible = false, waterVisible = false, warmshowersVisible = false;
```

- [ ] Run the tests:

```bash
npm test
```

Expected: all 240 tests pass.

- [ ] Commit:

```bash
git add js/state.js
git commit -m "feat: add warmshowersLayer and warmshowersVisible state vars"
```

---

### Task 3: CSS styles

**Files:**
- Modify: `styles.css`

- [ ] Open `styles.css`. Find the `.camp-toggle-water` rule (around line 488):

```css
.camp-toggle-water{background:#e3f2fd;color:#1565c0;border-color:#90caf9}
```

Append immediately after it:

```css
.camp-toggle-ws{background:#fdf2f0;color:#c0392b;border-color:#e8a89c}
.camp-toggle.on-ws{border-color:#c0392b;color:#c0392b;background:#fdf2f0}
.poi-icon-ws{background:#c0392b;width:20px;height:20px;font-size:11px}
.camp-popup-title-ws{color:#c0392b!important}
.camp-tag-ws-ok{background:#e8f5e9;color:#2e7d32}
.camp-tag-ws-off{background:#f5f5f5;color:#757575}
.camp-link-ws{color:#c0392b}
```

- [ ] Commit:

```bash
git add styles.css
git commit -m "feat: add WarmShowers POI icon and toggle CSS styles"
```

---

### Task 4: HTML — button + script tag

**Files:**
- Modify: `index.html`

- [ ] Open `index.html`. Find the waterToggle button (line ~169):

```html
        <button class="camp-toggle camp-toggle-water" id="waterToggle" data-action="toggleWater">&#x1f4a7; Eau</button>
```

Add the WarmShowers button immediately after (same indentation):

```html
        <button class="camp-toggle camp-toggle-ws" id="wsToggle" data-action="toggleWarmshowers">&#x1f3e0; WarmShowers</button>
```

- [ ] Find the campings.js script tag (line ~33):

```html
<script defer src="js/campings.js"></script>
```

Add the warmshowers.js script tag immediately after:

```html
<script defer src="js/warmshowers.js"></script>
```

- [ ] Commit:

```bash
git add index.html
git commit -m "feat: add WarmShowers toggle button and script tag to index.html"
```

---

### Task 5: Create `js/warmshowers.js`

**Files:**
- Create: `js/warmshowers.js`

- [ ] Create `js/warmshowers.js` with the following content:

```js
// warmshowers.js
// WarmShowers hosts POI layer — admin only.
// Auth: session cookie via credentials:'include'. Firebase config/warmshowersToken stores the
// session_name=sessid flag so we know a login has occurred; the browser holds the actual cookie.

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
```

- [ ] Run the tests:

```bash
npm test
```

Expected: all 240 tests pass.

- [ ] Commit:

```bash
git add js/warmshowers.js
git commit -m "feat: add WarmShowers POI layer module (toggle/load/render/auth)"
```

---

### Task 6: Wire up `onCampRangeChange`

**Files:**
- Modify: `js/campings.js:32-36`

- [ ] Open `js/campings.js`. Find `onCampRangeChange`:

```js
function onCampRangeChange(){
  if(campingsVisible)loadCampings();
  if(campspaceVisible)loadCampspace();
  if(waterVisible)loadWater();
}
```

Replace with:

```js
function onCampRangeChange(){
  if(campingsVisible)loadCampings();
  if(campspaceVisible)loadCampspace();
  if(waterVisible)loadWater();
  if(warmshowersVisible)loadWarmshowers();
}
```

- [ ] Run tests:

```bash
npm test
```

Expected: all 240 tests pass.

- [ ] Commit:

```bash
git add js/campings.js
git commit -m "feat: reload WarmShowers layer on campRange change"
```

---

### Task 7: CORS validation (manual test)

This task verifies whether the WarmShowers API accepts cross-origin requests from the deployed GitHub Pages origin.

- [ ] Push the current branch and open the live app at `https://tomcavaliere.github.io/France-Irlande/` (or serve locally with `python3 -m http.server 8080` and open `http://localhost:8080`).

- [ ] Log in as admin (Firebase auth).

- [ ] Open browser DevTools → **Network** tab → check **"Preserve log"**.

- [ ] Click **🏠 WarmShowers** → enter your WarmShowers credentials when prompted.

- [ ] Observe the request to `warmshowers.org/services/rest/user/login`:

**Case A — request succeeds (HTTP 200):**
CORS is fine. Verify hosts appear on the map. The feature is complete — skip Task 8.

**Case B — request blocked by CORS:**
DevTools shows: `Access to fetch at 'https://www.warmshowers.org/...' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present`.
→ Proceed to Task 8 (static fallback).

---

### Task 8 (fallback — only if Task 7 shows CORS blocked): Static data file

Replace the live API with a pre-fetched static file, matching the `campspace-data.js` pattern.

**Files:**
- Create: `warmshowers-data.js`
- Modify: `js/warmshowers.js` — remove auth + Firebase token logic, load from `WARMSHOWERS_DATA` global
- Modify: `index.html` — add `warmshowers-data.js` script tag
- Modify: `firebase.rules.json` — remove `config` block (no longer needed)

- [ ] Fetch hosts along the route using `curl` (run from your terminal with your credentials):

```bash
# Step 1 — login, save session cookie
curl -c /tmp/ws_cookies.txt \
  -X POST "https://www.warmshowers.org/services/rest/user/login" \
  -H "Accept: application/json" \
  -d "name=tomcavaliere%40outlook.fr&pass=YOUR_PASSWORD&format=json"

# Step 2 — fetch hosts for France segment (adjust bbox as needed)
curl -b /tmp/ws_cookies.txt \
  -X POST "https://www.warmshowers.org/services/rest/hosts/by_location" \
  -H "Accept: application/json" \
  -d "latitude=46.5&longitude=1.5&distance=400&limit=500&minlat=43.0&maxlat=51.0&minlon=-5.0&maxlon=8.0&format=json" \
  > /tmp/ws_france.json

# Step 3 — fetch hosts for Ireland segment
curl -b /tmp/ws_cookies.txt \
  -X POST "https://www.warmshowers.org/services/rest/hosts/by_location" \
  -H "Accept: application/json" \
  -d "latitude=53.0&longitude=-8.0&distance=200&limit=500&minlat=51.5&maxlat=54.5&minlon=-10.5&maxlon=-6.0&format=json" \
  > /tmp/ws_ireland.json
```

- [ ] Merge and convert to the static format. Run this Node.js snippet (save as `scripts/build-warmshowers-data.js` and execute with `node scripts/build-warmshowers-data.js`):

```js
const fs = require('fs');
const fr = JSON.parse(fs.readFileSync('/tmp/ws_france.json', 'utf8'));
const ie = JSON.parse(fs.readFileSync('/tmp/ws_ireland.json', 'utf8'));
const all = [...(fr.accounts || []), ...(ie.accounts || [])];
// Deduplicate by uid
const seen = new Set();
const unique = all.filter(a => { if (seen.has(a.uid)) return false; seen.add(a.uid); return true; });
const lines = unique.map(a =>
  `  [${parseFloat(a.latitude).toFixed(5)},${parseFloat(a.longitude).toFixed(5)},` +
  `${JSON.stringify(a.fullname||a.name||'')},${JSON.stringify(String(a.uid||''))},` +
  `${a.currently_available==='1'||a.currently_available===true},` +
  `${parseInt(a.maxcyclists)||0}]`
);
const content = `// warmshowers-data.js — pre-fetched WarmShowers hosts along the France→Ireland route.\n// Regenerate before departure with: node scripts/build-warmshowers-data.js\nvar WARMSHOWERS_DATA = [\n${lines.join(',\n')}\n];\n`;
fs.writeFileSync('warmshowers-data.js', content);
console.log('Written', unique.length, 'hosts to warmshowers-data.js');
```

- [ ] In `index.html`, after `<script defer src="campspace-data.js">`, add:

```html
<script defer src="warmshowers-data.js"></script>
```

- [ ] Replace the **entire content** of `js/warmshowers.js` with the static version:

```js
// warmshowers.js
// WarmShowers hosts POI layer — admin only. Uses pre-fetched WARMSHOWERS_DATA static file.

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
  if (typeof WARMSHOWERS_DATA === 'undefined' || !WARMSHOWERS_DATA.length) {
    showToast('Donn\u00e9es WarmShowers non charg\u00e9es', 'warn');
    return;
  }
  var pos = getCurrentPos();
  var rangeKm = parseInt(document.getElementById('campRange').value) || 150;
  var aheadPts = routePointsAhead(pos ? pos.idx : 0, rangeKm);
  if (!aheadPts.length) return;
  var accounts = WARMSHOWERS_DATA.map(function(d) {
    return { latitude: d[0], longitude: d[1], fullname: d[2], uid: d[3], currently_available: d[4], maxcyclists: d[5] };
  });
  renderWarmshowers(accounts, aheadPts);
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
```

- [ ] Remove the `config` block from `firebase.rules.json` (revert Task 1 changes).

- [ ] Run tests:

```bash
npm test
```

Expected: all 240 tests pass.

- [ ] Commit:

```bash
git add warmshowers-data.js js/warmshowers.js index.html firebase.rules.json
git commit -m "feat: WarmShowers POI layer via static pre-fetched data (CORS fallback)"
```
