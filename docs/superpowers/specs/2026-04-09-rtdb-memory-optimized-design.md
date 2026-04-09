# RTDB — Restructuration mémoire-optimisée

**Date** : 2026-04-09
**Statut** : Design validé, prêt pour plan d'implémentation
**Contexte** : Fait suite au commit `c2264d5 refactor(rtdb): restructure database to flat /days/{date}/ organization` qui a introduit trois régressions majeures (bande passante, intégrité des données, race conditions).

## Problème

Le refactor `c2264d5` a consolidé toutes les données par jour sous `/days/{date}/` — métadonnées, journal, photos base64, commentaires, bravos. Le listener principal souscrit à `/days` dans son ensemble :

```js
_unsubDays = _fbOnValue(_fbRef(_fbDb, 'days'), function(snapshot) {
  var data = snapshot.val() || {};
  state.days = data;
  ...
});
```

Trois problèmes en découlent :

### 1. Bande passante & mémoire (inquiétude initiale utilisateur)
- **Chaque visiteur télécharge toutes les photos au premier load**, même s'il ne scrolle jamais jusqu'à un jour donné. La lazy-load par `IntersectionObserver` devient redondante — les photos sont déjà là via le listener global.
- **`state.days` en heap JS contient l'arbre base64 complet**. Sur un voyage de plusieurs mois, potentiellement plusieurs centaines de Mo.
- **`saveLocalCache()` essaie de `JSON.stringify` cet arbre dans localStorage** (quota ~5 Mo). **Crash garanti dès quelques photos uploadées.**

### 2. Intégrité des données — CRITIQUE
`updatePosition` reconstruit `state.days[todayISO]` en ne préservant que `note` et `journal` depuis l'existant. Puis `saveNow` appelle `set('/days', state.days)`, qui remplace intégralement l'arbre. Conséquence : à chaque tick GPS, tout ce qui est sous `/days/{aujourd'hui}/` autre que `lat/lon/km/note/journal/ts` est **effacé sur Firebase** — photos uploadées, commentaires reçus, bravos cliqués pendant la journée.

### 3. Race conditions writes visiteur ↔ admin
Même si le bug #2 était fixé, faire `set('/days', state.days)` écrase tout commentaire/bravo écrit par un visiteur entre le moment où le listener a snapshotté et le moment où l'admin push.

## Objectif

Restructurer la RTDB pour que **le chargement initial côté visiteur soit minimal** (< 1 KB), en lazy-loadant toutes les données lourdes (photos, journal, commentaires, bravos) à la demande.

Contraintes acceptées lors du brainstorming :
- Base Firebase vide (tests seulement) → pas de migration nécessaire, wipe manuel des anciens nœuds `/days` et `/meta`.
- Au boot, le visiteur ne doit voir que **la carte + la position actuelle + le total km**. Tout le reste (liste d'étapes, journal, photos, commentaires, bravos) est chargé à la demande.

## Architecture RTDB

### Arborescence complète

```
/current                              — pointeur "position live" (admin only write)
  { lat, lon, kmTotal, kmDay, date, ts }

/stages/{date}                        — métadonnées par jour (admin only write)
  { lat, lon, kmTotal, kmDay, note, ts, published, journalDeleted }

/journals/{date}                      — texte journal (admin only write)
  "string jusqu'à 5000 caractères"

/photos/{date}/{id}                   — photos base64 (admin only write)
  "data:image/jpeg;base64,..." (< 500 000 chars)

/comments/{date}/{id}                 — commentaires visiteurs (public create, auth edit/delete)
  { name, text, ts }

/bravos/{date}/{visitorId}            — bravos visiteurs (public write-once)
  true

/expenses/{id}                        — dépenses (auth only read+write)
  { amount, cat, date, desc, ts }
```

### Notes de shape

- `date` est toujours au format `YYYY-MM-DD`. Aucun index numérique de stage (`/i`) — on supprime cette ambiguïté qui traînait depuis les premières versions.
- `/stages/{date}` contient `lat/lon` en plus des km : nécessaire pour les jours passés (recalcul de country, affichage sur la carte au clic d'un marker).
- `journalDeleted: true` marque une entrée journal explicitement supprimée (évite qu'elle réapparaisse via la trace GPS).
- `published: true` → visible par les visiteurs. Absent ou `false` → brouillon admin.
- Les `ts` sont des timestamps `Date.now()` en millisecondes.
- `/meta/completed` est supprimé (dead data — déclaré mais jamais utilisé dans le code).

### `firebase.rules.json`

```json
{
  "rules": {
    "current": {
      ".read": true,
      ".write": "auth != null",
      ".validate": "newData.hasChildren(['lat','lon','kmTotal','date','ts'])"
    },
    "stages": {
      ".read": true,
      "$date": {
        ".write": "auth != null",
        ".validate": "newData.hasChildren(['lat','lon','kmTotal'])"
      }
    },
    "journals": {
      ".read": true,
      "$date": {
        ".write": "auth != null",
        ".validate": "!newData.exists() || (newData.isString() && newData.val().length <= 5000)"
      }
    },
    "photos": {
      ".read": true,
      "$date": {
        "$id": {
          ".write": "auth != null",
          ".validate": "newData.isString() && newData.val().length < 500000"
        }
      }
    },
    "comments": {
      ".read": true,
      "$date": {
        "$id": {
          ".write": "!data.exists() || auth != null",
          ".validate": "newData.child('text').val().length < 500 && newData.child('name').val().length < 30"
        }
      }
    },
    "bravos": {
      ".read": true,
      "$date": {
        "$visitorId": {
          ".write": "!data.exists()",
          ".validate": "newData.val() === true"
        }
      }
    },
    "expenses": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

### Points notables

- **Aucun `set()` n'est jamais fait sur une racine (`/stages`, `/journals`, `/photos`, etc.).** Toujours `set('/stages/{date}', ...)`, `set('/journals/{date}', ...)`. Élimine la classe de bugs `c2264d5`.
- `/journals/{date}` accepte `null` (suppression) via `!newData.exists() || ...`.
- `/current` a une validation de structure minimale pour éviter les writes corrompus.

## État client & listeners

### Variables globales

Les variables `state`, `meta`, et les anciennes caches tombent entièrement :

```js
// Position live — remplace getCurrentPos() qui fouillait state.days
var current = null;          // { lat, lon, kmTotal, kmDay, date, ts } ou null

// Cache des métadonnées d'étapes — chargé à l'ouverture de Carnet
var stages = {};             // { [date]: { lat, lon, kmTotal, kmDay, note, ts, published, journalDeleted } }

// Caches lazy par date (peuplés à la demande)
var journals = {};           // { [date]: "texte" }
var photos = {};             // { [date]: { [id]: base64 } }
var comments = {};           // { [date]: { [id]: {name,text,ts} } }

// Dépenses (auth only)
var expenses = {};           // { [id]: {...} }
```

### Listeners

```js
var _unsubCurrent = null;    // toujours actif (boot → forever)
var _unsubStages = null;     // actif seulement quand Carnet est ouvert
var _unsubExpenses = null;   // actif seulement quand admin connecté

// Maps de listeners lazy par date
var journalsUnsub = {};      // { [date]: fn }
var photosUnsub = {};        // { [date]: fn }
var commentsUnsub = {};      // { [date]: fn }
var bravosUnsub = {};        // { [date]: fn }
```

### Cycle de vie

**Au boot (tous les users, admin et visiteur) :**

```js
function initFirebase() {
  _unsubCurrent = _fbOnValue(_fbRef(_fbDb, 'current'), function(snap) {
    current = snap.val();
    updateMap();
    updatePositionBadge();
    saveLocalCache();
  });
}
```

→ **un seul listener persistant, ~100 octets transférés**.

**Quand l'utilisateur ouvre l'onglet Carnet** (déclenché dans la fonction de navigation) :

```js
function openCarnetTab() {
  if (_unsubStages) return;  // déjà chargé
  _unsubStages = _fbOnValue(_fbRef(_fbDb, 'stages'), function(snap) {
    stages = snap.val() || {};
    renderStages();
    renderJournal();
  });
}
```

→ chargement unique (~15 KB pour 100 jours), puis deltas.

**Quand une étape devient visible** (IntersectionObserver dans `observeJournalEntries`) :

```js
function loadStageContent(date) {
  if (journalsUnsub[date]) return;

  journalsUnsub[date] = _fbOnValue(_fbRef(_fbDb, 'journals/' + date), function(snap) {
    journals[date] = snap.val() || '';
    patchJournalText(date);
  });

  photosUnsub[date] = _fbOnValue(_fbRef(_fbDb, 'photos/' + date), function(snap) {
    photos[date] = snap.val() || {};
    patchPhotos(date);
  });

  commentsUnsub[date] = _fbOnValue(_fbRef(_fbDb, 'comments/' + date), function(snap) {
    comments[date] = snap.val() || {};
    patchStageComments(date);
  });

  bravosUnsub[date] = _fbOnValue(_fbRef(_fbDb, 'bravos/' + date), function(snap) {
    patchBravos(date, snap.val() || {});
  });
}
```

**Teardown des lazy listeners** (appelé au début de `renderJournal()` comme l'existant le fait déjà pour les photos) :

```js
function teardownLazyListeners() {
  [journalsUnsub, photosUnsub, commentsUnsub, bravosUnsub].forEach(function(map) {
    Object.values(map).forEach(function(unsub) {
      if (typeof unsub === 'function') unsub();
    });
  });
  journalsUnsub = {}; photosUnsub = {}; commentsUnsub = {}; bravosUnsub = {};
  journals = {}; photos = {}; comments = {};
}
```

### Points notables

- **Aucun listener global sur `/photos` ni sur `/comments`.** `initComments()` disparaît.
- `getCurrentPos()` devient `return current` (plus besoin de fouiller `state.days`).
- `updateMap()` utilise `current` directement.
- Le compteur de commentaires dans `openProfileModal()` devient un `get('/comments')` one-shot au moment de l'ouverture (pas un listener permanent).
- Idem pour `refreshQuotaState()` : `get('/photos')` one-shot.
- `/stages` n'est chargé que si l'utilisateur ouvre Carnet. Un visiteur qui reste sur la carte ne paie jamais le coût des métadonnées des jours passés.

## Chemins d'écriture admin

### Principe directeur

**Chaque write touche une seule path granulaire.** Jamais de `set('/stages', ...)` ou `set('/journals', ...)` sur une racine. Les fonctions génériques `save()` et `saveNow()` disparaissent — remplacées par des helpers spécifiques par type de donnée.

### `updatePosition()` — GPS tick

```js
function updatePosition() {
  navigator.geolocation.getCurrentPosition(function(pos) {
    var lat = pos.coords.latitude, lon = pos.coords.longitude;
    var todayISO = new Date().toISOString().slice(0, 10);
    var snapped = snapToRoute(lat, lon);
    var kmTotal = Math.round(snapped.kmTotal);
    var kmDay = Utils.computeKmDay(kmTotal, stages, todayISO);

    // Écriture 1 : /current (pointeur live)
    var currentData = { lat: lat, lon: lon, kmTotal: kmTotal, kmDay: kmDay, date: todayISO, ts: Date.now() };
    _fbSet(_fbRef(_fbDb, 'current'), currentData);

    // Écriture 2 : /stages/{today} — préserve les champs existants (note, published)
    var existingStage = stages[todayISO] || {};
    var stageData = {
      lat: lat, lon: lon, kmTotal: kmTotal, kmDay: kmDay,
      note: existingStage.note || '',
      published: existingStage.published || false,
      ts: Date.now()
    };
    _fbSet(_fbRef(_fbDb, 'stages/' + todayISO), stageData);
  });
}
```

Deux `set()` granulaires. `journalDeleted` n'est pas écrit ici → si l'admin avait supprimé l'entrée journal, le GPS tick ne la ressuscite pas. `/journals/{today}`, `/photos/{today}`, `/comments/{today}`, `/bravos/{today}` ne sont jamais touchés par `updatePosition`.

### Journal textarea — debounce 60 s par date

```js
var _journalSaveTimers = {}; // { [date]: timeoutId }

function onJournalInput(date, text) {
  if (!isAdmin) return;
  journals[date] = text;
  clearTimeout(_journalSaveTimers[date]);
  _journalSaveTimers[date] = setTimeout(function() {
    _fbSet(_fbRef(_fbDb, 'journals/' + date), text);
  }, 60000);
}

function flushJournals() {
  Object.keys(_journalSaveTimers).forEach(function(date) {
    clearTimeout(_journalSaveTimers[date]);
    if (isOnline && _fbDb) {
      _fbSet(_fbRef(_fbDb, 'journals/' + date), journals[date] || '');
    } else {
      queueWrite('journals/' + date, journals[date] || '');
    }
  });
  _journalSaveTimers = {};
}
```

Debounce **par date**, pas global — permet d'éditer plusieurs jours sans s'écraser. `flushJournals()` est appelé sur `beforeunload` ET `visibilitychange:hidden` (iOS Safari ne déclenche pas `beforeunload`).

### Photos, commentaires, bravos, expenses

Inchangés dans leur logique, juste les chemins mis à jour :

```js
// Upload photo
_fbSet(_fbRef(_fbDb, 'photos/' + date + '/' + id), b64);

// Delete photo
_fbRemove(_fbRef(_fbDb, 'photos/' + date + '/' + id));

// Post comment (visitor)
tryWrite('set', 'comments/' + date + '/' + id, data);

// Delete comment (admin)
tryWrite('remove', 'comments/' + date + '/' + id);

// Add bravo (visitor)
_fbSet(_fbRef(_fbDb, 'bravos/' + date + '/' + getVisitorId()), true);
```

### Publish / unpublish — toggles granulaires

```js
function publishDay(date) {
  if (!isAdmin) return;
  _fbSet(_fbRef(_fbDb, 'stages/' + date + '/published'), true);
}

function unpublishDay(date) {
  if (!isAdmin) return;
  _fbSet(_fbRef(_fbDb, 'stages/' + date + '/published'), false);
}
```

### Édition de note

```js
function editNote(date, text) {
  if (!isAdmin) return;
  _fbSet(_fbRef(_fbDb, 'stages/' + date + '/note'), text);
}
```

### `deleteStage` — suppression d'un jour entier

```js
function deleteStage(date) {
  if (!isAdmin) return;
  Promise.all([
    _fbRemove(_fbRef(_fbDb, 'stages/' + date)),
    _fbRemove(_fbRef(_fbDb, 'journals/' + date)),
    _fbRemove(_fbRef(_fbDb, 'photos/' + date)),
    _fbRemove(_fbRef(_fbDb, 'comments/' + date)),
    _fbRemove(_fbRef(_fbDb, 'bravos/' + date))
  ])
    .then(renderStages)
    .catch(function(err) { console.error('[deleteStage]', err); });
}
```

### `deleteJournalEntry` — supprime juste le journal, pas l'étape

```js
function deleteJournalEntry(date) {
  if (!isAdmin) return;
  _fbRemove(_fbRef(_fbDb, 'journals/' + date));
  _fbSet(_fbRef(_fbDb, 'stages/' + date + '/journalDeleted'), true);
}
```

### `openJournalEntry` — admin recrée une entrée précédemment supprimée

```js
function openJournalEntry(date) {
  if (!isAdmin) return;
  // Si l'entrée avait été supprimée, on lève le flag pour qu'elle réapparaisse
  if (stages[date] && stages[date].journalDeleted) {
    _fbRemove(_fbRef(_fbDb, 'stages/' + date + '/journalDeleted'));
  }
  // Puis ouvre l'éditeur (logique UI inchangée)
}
```

Write granulaire sur `stages/{date}/journalDeleted` uniquement — ne touche pas aux autres champs de l'étape.

### Garanties obtenues

| Garantie | Comment |
|---|---|
| Aucun write admin n'écrase jamais un commentaire ou bravo visiteur | Arbres disjoints, aucun `set()` de racine |
| Aucun write admin n'efface une photo uploadée | `updatePosition` ne touche qu'à `/current` et `/stages/{today}` (champs explicites) |
| Une race condition entre deux writes journal débouncés n'efface pas d'autres données | Debounce par date, chaque timer écrit seulement sa propre path |
| Un visiteur qui poste un commentaire ne déclenche aucun re-download de photos | `/photos` et `/comments` sont des arbres distincts, listeners indépendants |

## Cache localStorage + queue hors-ligne

### Règle de caching

| Donnée | Cache localStorage ? | Rationale |
|---|---|---|
| `/current` | ✅ oui | ~100 B, essentiel pour afficher la carte au boot hors-ligne |
| `/stages` | ✅ oui | ~15 KB, nécessaire pour la liste d'étapes hors-ligne |
| `/journals/{date}` | ✅ oui | ~500 KB worst case, admin doit continuer à écrire hors-ligne |
| `/photos/{date}` | ❌ non | Trop lourd, hors-ligne = pas de photos (voulu) |
| `/comments/{date}` | ❌ non | Hors-ligne = pas de commentaires (voulu) |
| `/bravos/{date}` | ❌ non | Idem |
| `/expenses` | ❌ non | Auth only, pas pertinent hors-ligne |

### Clés localStorage

```
ev1-current-cache     — JSON.stringify(current)
ev1-stages-cache      — JSON.stringify(stages)
ev1-journals-cache    — JSON.stringify(journals)
ev1-queue             — JSON.stringify(offlineQueue)   (nom inchangé)
```

Les anciennes clés (`ev1-state-cache`, `ev1-comments-cache`, `ev1-photos-cache`) ne sont pas nettoyées automatiquement — elles deviennent résidentes mortes (quelques Ko), sans impact.

### `saveLocalCache` / `loadLocalCache`

```js
function saveLocalCache() {
  try { localStorage.setItem('ev1-current-cache', JSON.stringify(current)); } catch(e) {}
  try { localStorage.setItem('ev1-stages-cache', JSON.stringify(stages)); } catch(e) {}
  try { localStorage.setItem('ev1-journals-cache', JSON.stringify(journals)); }
  catch(e) { console.warn('localStorage plein, journals cache non sauvegardé'); }
}

function loadLocalCache() {
  try { var c = localStorage.getItem('ev1-current-cache'); if (c) current = JSON.parse(c); } catch(e) {}
  try { var s = localStorage.getItem('ev1-stages-cache'); if (s) stages = JSON.parse(s) || {}; } catch(e) {}
  try { var j = localStorage.getItem('ev1-journals-cache'); if (j) journals = JSON.parse(j) || {}; } catch(e) {}
}
```

`saveLocalCache` est appelé depuis les listeners `/current`, `/stages`, et chaque listener `/journals/{date}`. `loadLocalCache` est appelé au boot avant `initFirebase()`.

### Queue hors-ligne — filtrage par path

```js
function queueWrite(path, data) {
  if (!Utils.isOfflineable(path)) {
    // Fail visible — photos/commentaires/bravos/expenses ne sont pas offline
    showToast('Hors-ligne : action non disponible', 'warn');
    return false;
  }
  offlineQueue.push({ path: path, data: data, op: data === null ? 'remove' : 'set' });
  try { localStorage.setItem('ev1-queue', JSON.stringify(offlineQueue)); } catch(e) {}
  return true;
}
```

`flushQueue()` est inchangé dans sa mécanique (boucle sur la queue, replay via `_fbSet` / `_fbRemove`, vide la queue).

## Modules purs — nouvelles fonctions dans `js/utils.js`

Le refactor RTDB ne touche pas `js/gps-core.js` (logique GPS inchangée). Les 19 tests existants restent valides.

Quatre fonctions pures sont extraites du refactor et ajoutées à `js/utils.js`, avec tests obligatoires conformes à la règle du projet.

### `computeKmDay(kmTotal, stages, todayISO)`

```js
/**
 * Calcule les km parcourus aujourd'hui vs la veille.
 * @param {number} kmTotal - km total snappé à la trace aujourd'hui
 * @param {Object} stages - map {date: {kmTotal,...}} des étapes connues
 * @param {string} todayISO - date du jour au format YYYY-MM-DD
 * @returns {number} km du jour, >= 0
 */
function computeKmDay(kmTotal, stages, todayISO) {
  var dates = Object.keys(stages || {}).filter(function(d) { return d < todayISO; }).sort();
  if (!dates.length) return Math.max(0, Math.round(kmTotal));
  var prev = stages[dates[dates.length - 1]];
  var prevKm = (prev && prev.kmTotal) || 0;
  return Math.max(0, Math.round(kmTotal - prevKm));
}
```

**Tests :**
- Pas d'étapes antérieures → retourne `kmTotal` arrondi
- Une étape la veille avec `kmTotal = 100`, aujourd'hui `kmTotal = 180` → retourne 80
- Étapes passées mais pas d'étape la veille → prend la plus récente < today
- `kmTotal < prev.kmTotal` (reset GPS foireux) → retourne 0 (clamp)
- `stages` vide / null / undefined → retourne `kmTotal` arrondi
- Plusieurs étapes dans l'ordre chronologique → prend la bonne

### `isOfflineable(path)`

```js
/**
 * Indique si un write est autorisé à passer par la queue offline.
 */
function isOfflineable(path) {
  if (typeof path !== 'string') return false;
  if (path === 'current') return true;
  if (path.indexOf('stages/') === 0) return true;
  if (path.indexOf('journals/') === 0) return true;
  return false;
}
```

**Tests :**
- `'current'` → true
- `'stages/2026-05-01'`, `'stages/2026-05-01/note'`, `'stages/2026-05-01/published'` → true
- `'journals/2026-05-01'` → true
- `'photos/2026-05-01/abc'`, `'comments/2026-05-01/xyz'`, `'bravos/2026-05-01/vid'`, `'expenses/abc'` → false
- `''`, `null`, `undefined`, nombre → false

### `actionLabel(path)`

```js
/**
 * Retourne un label humain-lisible pour une path Firebase donnée.
 */
function actionLabel(path) {
  if (typeof path !== 'string') return 'élément';
  if (path === 'current') return 'position';
  if (path.indexOf('stages/') === 0) {
    if (path.indexOf('/note') >= 0) return 'note';
    if (path.indexOf('/published') >= 0) return 'publication';
    if (path.indexOf('/journalDeleted') >= 0) return 'suppression';
    return 'étape';
  }
  if (path.indexOf('journals/') === 0) return 'journal';
  if (path.indexOf('photos/') === 0) return 'photo';
  if (path.indexOf('comments/') === 0) return 'commentaire';
  if (path.indexOf('bravos/') === 0) return 'bravo';
  if (path.indexOf('expenses') === 0) return 'dépense';
  return 'élément';
}
```

**Tests :** un test par branche (~9 assertions).

### `filterVisibleJournalDates(stages, isAdmin)`

```js
/**
 * Retourne les dates à afficher dans le carnet visible, triées décroissant.
 * Visiteur : seulement published=true et pas journalDeleted.
 * Admin : tout sauf journalDeleted.
 */
function filterVisibleJournalDates(stages, isAdmin) {
  if (!stages || typeof stages !== 'object') return [];
  return Object.keys(stages)
    .filter(function(d) {
      var s = stages[d];
      if (!s || s.journalDeleted) return false;
      if (isAdmin) return true;
      return s.published === true;
    })
    .sort()
    .reverse();
}
```

**Tests :**
- Stages vide → tableau vide
- Admin voit les brouillons ET publiés
- Visiteur ne voit que les publiés
- Ni admin ni visiteur ne voit les `journalDeleted`
- Tri décroissant (dernier jour en premier)
- `stages` null / non-objet → tableau vide

### Wrappers dans `index.html`

Comme pour l'existant (`escAttr`, `validateComment`, etc.), `index.html` délègue via des wrappers one-liner :

```js
function computeKmDay(kmTotal, stages, todayISO) { return Utils.computeKmDay(kmTotal, stages, todayISO); }
function isOfflineable(path) { return Utils.isOfflineable(path); }
function actionLabel(path) { return Utils.actionLabel(path); }
function filterVisibleJournalDates(stages, isAdmin) { return Utils.filterVisibleJournalDates(stages, isAdmin); }
```

### Fonctions inchangées

`computeQuotaBytes(photosTree)` prend toujours `{[date]:{[id]:base64}}`, même shape qu'avant le refactor. Il sera appelé via `get('/photos')` one-shot au lieu d'un listener permanent. Les tests existants restent valides.

`summarizeExpenses`, `validateComment`, `validateExpense`, `validateJournal`, `escAttr`, `escHtml`, `formatTime`, `formatBytes`, `quotaLevel`, `safeFetch` : aucun changement.

### Récap tests

| Fonction | Nombre de tests |
|---|---|
| `computeKmDay` | 6 |
| `isOfflineable` | ~10 |
| `actionLabel` | ~9 |
| `filterVisibleJournalDates` | 6 |
| **Total nouveau** | **~31 tests** |

Plus les 19 + 15 existants, on passe à ~65 tests unitaires.

## Ordre de déploiement

1. **Modules purs + tests d'abord** (TDD, respecte la règle du projet)
   - Ajouter les 4 fonctions dans `js/utils.js`
   - Écrire les ~31 tests dans `tests/utils.test.js`
   - `npm test` doit passer

2. **Refactor `firebase.rules.json`** (fichier seul, pas encore pushé)
   - Remplacer l'arborescence actuelle par la nouvelle
   - Commit séparé du refactor code

3. **Refactor `index.html`** en un commit atomique `refactor(rtdb): ...`
   - Remplacer `state`, `meta` par `current`, `stages`, `journals`, `photos`, `comments` globaux
   - Remplacer `_unsubDays`/`_unsubMeta` par `_unsubCurrent`, `_unsubStages` et les maps lazy
   - Remplacer `save()`/`saveNow()` génériques par les helpers granulaires
   - Adapter `renderStages`, `renderJournal`, `getCurrentPos`, `updateMap`, `exportJournal`, `openProfileModal`, `refreshQuotaState`
   - Adapter `saveLocalCache`/`loadLocalCache` aux nouvelles clés
   - Adapter `queueWrite`/`flushQueue`/`flushPendingWrites` aux nouveaux paths
   - Ouvrir `/stages` seulement quand l'onglet Carnet est affiché

4. **Bump du cache service worker** (`sw.js`) : `ev1-v12` → `ev1-v13` pour invalider l'app shell chez les visiteurs déjà venus.

5. **Mise à jour `CLAUDE.md`** : nouvelle section "Firebase RTDB — règles d'accès", nouvelles fonctions de `js/utils.js`.

6. **Test manuel local** contre Firebase prod (base vide) :
   - Admin se connecte, GPS tick → `/current` + `/stages/{today}` créés
   - Écrire un texte journal → `/journals/{today}` débouncé après 60 s
   - Uploader une photo → `/photos/{today}/{id}`
   - Publier le jour → `stages/{today}/published = true`
   - Visiteur (navigation privée) : voit la carte au boot sans charger `/stages` (vérifier Network tab)
   - Visiteur clique Carnet → `/stages` chargé, liste affichée
   - Visiteur scrolle sur une étape → `/journals/{date}`, `/photos/{date}`, `/comments/{date}`, `/bravos/{date}` chargés lazy
   - Visiteur poste un commentaire → `/comments/{date}/{id}` OK, n'affecte rien d'autre
   - Visiteur clique bravo → `/bravos/{date}/{vid}` OK
   - Admin hors-ligne, écrit un journal → queue + toast "hors-ligne, sync en attente"
   - Admin hors-ligne, tente d'uploader une photo → échec visible (non-offlineable)
   - Admin repasse en ligne → queue flushée

7. **Push des rules sur la console Firebase** (manuel, AVANT deploy code)
   - ⚠️ Ordre critique : les rules doivent être publiées avant que le code soit live, sinon permission-denied.

8. **Nettoyage manuel des anciens nœuds morts** (console Firebase) : supprimer `/days` et `/meta`.

9. **Deploy code** via `git push` (GitHub Pages auto-deploy).

10. **Vérification en prod** (refaire le test manuel du point 6 sur l'URL live).

## Checklist finale de complétion

- [ ] `npm test` vert avec les ~65 tests
- [ ] Grep `state\.days`, `state\.journal`, `meta\.completed` dans `index.html` → 0 match
- [ ] Grep `_fbSet\(_fbRef\(.+,'days'\)` → 0 match (plus de listener/set sur l'ancienne racine)
- [ ] Grep `_fbOnValue\(.+,'days'\)` → 0 match
- [ ] DevTools Network au boot visiteur : une seule requête RTDB `/current`, taille < 1 KB
- [ ] `firebase.rules.json` committé et déployé sur la console
- [ ] `sw.js` bumped à `v13`
- [ ] `CLAUDE.md` à jour
- [ ] `/days` et `/meta` supprimés en prod

## Bénéfices mesurables

| Métrique | Actuel (c2264d5) | Après refactor |
|---|---|---|
| Boot visiteur (bytes transférés) | Toute la base `/days` incluant photos | ~100 B (`/current`) |
| Heap JS au boot | `state.days` full tree avec base64 | `current` seul (~100 B) |
| localStorage footprint | Crash dès quelques photos (> 5 MB) | ~500 KB worst case |
| Bugs data integrity | GPS tick efface photos/commentaires/bravos | Aucun (writes granulaires) |
| Listeners au boot | 3 (`/days`, `/meta`, `/expenses`) | 1 (`/current`) |
| Race conditions admin ↔ visiteur | Possibles (set racine) | Aucune (arbres disjoints) |

## Hors-scope

- Migration de données existantes (base vide, non nécessaire).
- Compression base64 → binaire via Firebase Storage (payant, voir backlog CLAUDE.md).
- Monitoring du quota RTDB en UI (la logique est déjà dans `utils.js`, le branchement UI est dans le backlog).
- Tests d'intégration contre Firebase (volontairement exclu — "zéro appel réseau réel dans les tests").
- Refactor des modules purs existants (`gps-core.js` inchangé).
