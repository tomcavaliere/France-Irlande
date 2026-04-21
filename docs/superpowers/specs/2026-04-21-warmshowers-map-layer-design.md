# WarmShowers Map Layer — Design Spec

**Date:** 2026-04-21  
**Scope:** Admin-only POI layer on the Leaflet map showing WarmShowers hosts near the route.

---

## 1. Overview

Add a WarmShowers toggle button to the admin map controls bar, following the exact same pattern as the existing Campings / Campspace / Eau layers. When enabled, it fetches nearby WarmShowers hosts via the WarmShowers REST API and displays them as markers on the map.

Visible only in `#mapAdminBar` (admin-authenticated session). No impact on visitor experience.

---

## 2. Architecture

### New file: `js/warmshowers.js`

Four functions, mirroring `campings.js`:

| Function | Role |
|---|---|
| `toggleWarmshowers()` | Toggle `warmshowersVisible`, show/hide layer |
| `loadWarmshowers()` | Read token from Firebase → call WarmShowers API → call `renderWarmshowers()` |
| `renderWarmshowers(hosts, aheadPts)` | Build Leaflet markers filtered by `nearTrace`, add to map |
| `renewWarmshowersToken()` | Prompt credentials → POST auth endpoint → store token in Firebase |

No new `*-core.js` — no new pure logic. Proximity filtering reuses `CampingsCore.nearTrace`.

### Modified files

| File | Change |
|---|---|
| `js/state.js` | Add `warmshowersLayer = null`, `warmshowersVisible = false` |
| `index.html` | Add `#wsToggle` button in `map-admin-controls` |
| `styles.css` | Add `.camp-toggle-ws`, `.poi-icon-ws` (color `#c0392b`) |
| `firebase.rules.json` | Add `config/warmshowersToken` node (auth-only) |

---

## 3. Authentication Flow (Option A — token in Firebase)

```
Toggle clicked
  └─ Read config/warmshowersToken from Firebase (auth-only)
       ├─ Token exists → call WarmShowers API
       │    ├─ 200 OK → renderWarmshowers()
       │    └─ 401 Unauthorized → toast "Token expiré" + renewWarmshowersToken()
       └─ Token absent → renewWarmshowersToken()
            └─ window.prompt() username + window.prompt() password
                 └─ POST WarmShowers auth endpoint
                      ├─ Success → store token in config/warmshowersToken → call API
                      └─ Failure → toast "Identifiants WarmShowers invalides"
```

**Token storage:** Firebase RTDB `config/warmshowersToken` (string, auth-only read+write). The password is **never stored** — only the access token.

---

## 4. WarmShowers API

**Auth endpoint (token exchange):**
```
POST https://www.warmshowers.org/services/rest/user/login
Content-Type: application/x-www-form-urlencoded
Body: name=<username>&pass=<password>&format=json
```
Response: JSON with `{sessid, session_name, user: {uid, ...}}`. The session cookie or `sessid` is used as the token.

**Hosts near location:**
```
POST https://www.warmshowers.org/services/rest/hosts/by_location
Cookie: <session_name>=<sessid>  (or Authorization header)
Body: latitude=<lat>&longitude=<lon>&distance=<km>&limit=100&minlat=<bbox.s>&maxlat=<bbox.n>&minlon=<bbox.w>&maxlon=<bbox.e>&format=json
```

**⚠️ CORS risk:** The WarmShowers API may block cross-origin requests from `tomcavaliere.github.io`. This must be validated at implementation time by testing with `Utils.safeFetch`.

**Fallback if CORS is blocked:** Pre-fetch hosts along the full route with a one-shot Node.js script and save as `warmshowers-data.js` (static file, like `campspace-data.js`). Data would be refreshed manually before/during the trip.

---

## 5. Firebase Rules

New `config` node added to `firebase.rules.json`:

```json
"config": {
  "warmshowersToken": {
    ".read": "auth != null",
    ".write": "auth != null",
    ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 2000"
  }
}
```

---

## 6. UI

### Button

```html
<button class="camp-toggle camp-toggle-ws" id="wsToggle" data-action="toggleWarmshowers">🏠 WarmShowers</button>
```

States:
- Default: `🏠 WarmShowers`
- Active: `🏠 N hôtes` (class `on-ws`)
- Loading: `🏠 chargement…`
- Token expired: `🏠 Reconnecter`

### Marker

```css
.poi-icon-ws { background: #c0392b; width: 20px; height: 20px; font-size: 11px; }
.camp-toggle-ws { background: #fdf2f0; color: #c0392b; border-color: #e8a89c; }
.camp-toggle.on-ws { border-color: #c0392b; color: #c0392b; background: #fdf2f0; }
```

### Popup content

```
[Nom hôte]
[badge: Disponible / Indisponible]
Max X personnes  (si disponible dans l'API)
[distance trace]
[Voir profil → warmshowers.org/users/{uid}]
```

### Radius

`nearTrace` radius = **10 km** (vs 5 km pour campings — les hôtes sont souvent un peu en dehors de la trace directe).

---

## 7. Tests

No new `*-core.js` → no new unit tests required. All new code is DOM/I/O layer.

---

## 8. Out of Scope

- Visibility for visitors (admin-only, intentional)
- Offline availability (tokens and API calls require network, intentional)
- Displaying host reviews or photos
