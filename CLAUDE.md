# EuroVelo 1 — Bikepacking France → Irlande

PWA de suivi de voyage en temps réel. Tom journalise, ses proches suivent en live.
Tracé complet : France (Chamonix → Roscoff) + Irlande (Cork → Sligo).

## Stack

- **Frontend** : HTML/CSS/JS vanilla — `index.html` (~720 lignes, shell + styles) + 23 modules JS dans `js/`. Zéro build, zéro framework, chargés via `<script>` dans l'ordre.
- **Carte** : Leaflet 1.9.4 (CDN unpkg, mis en cache par le SW).
- **Backend** : Firebase RTDB `france-irlande-bike`, région `europe-west1`. Lecture publique sauf `expenses` (auth uniquement).
- **Deploy** : GitHub Pages → `https://tomcavaliere.github.io/France-Irlande/`
- **PWA** : service worker `sw.js` (cache `ev1-v25`), `manifest.json`.
- **Tests** : Vitest (`npm test` / `npm run test:watch`). Aucun bundler, aucun jsdom — Node pur.
- **Lint/CI** : ESLint 9 flat config + GitHub Actions (`.github/workflows/ci.yml`) lance `npm run lint` puis `npm test` sur chaque push/PR.

## Structure du repo

```
index.html                  — shell HTML + CSS + bootstrap (~720 lignes)
sw.js                       — service worker (network-first app shell, cache-first libs)
manifest.json               — PWA manifest
campspace-data.js           — dump Campspace (520 KB, 1 liner) — mis en cache SW
eslint.config.js            — ESLint 9 flat config
.github/workflows/ci.yml    — CI : lint + tests sur push/PR main
js/
  # Cœur / bootstrap
  firebase-init.js          — init Firebase app, auth, db, storage (ESM import)
  init.js                   — amorçage DOM, délégation events, listeners globaux
  state.js                  — vars globales partagées (current, stages, journals…)
  events-core.js            — mini event-bus pur (emit / on / off)
  # UI
  ui.js                     — toast, confirm dialog, lightbox, sync dot, délégation
  admin.js                  — login, profil, inactivité, quota photos
  visitor-auth.js           — hash pwd visiteur, gate d'entrée
  # Carte
  map-core.js               — init Leaflet, couches, marqueurs, tracés GPX
  route-data.js             — tracé GPS complet (~50 k points, 255 KB)
  # Contenu
  journal.js                — rendu + save debounce, subscriptions, lazy load, bravos
  stages.js                 — cartes étapes, upload/delete GPX, recap
  photos.js                 — upload base64, lightbox, suppression
  videos.js                 — upload Firebase Storage, progress, cancel
  comments.js               — post, suppression, cache local
  expenses.js               — CRUD dépenses + synthèse
  # Données annexes
  campings.js               — requêtes Overpass campings/eau
  campings-core.js          — filtres POI purs (testé)
  weather.js                — fetch open-meteo + rendu widget
  weather-core.js           — parsing réponse open-meteo (testé)
  # Hors-ligne / utilitaires
  offline.js                — queue writes, flush au retour réseau
  offline-core.js           — logique pure queue/retry (testé)
  gps-core.js               — calculs GPS purs : snap tracé, progression, POI (testé)
  utils.js                  — helpers purs : escaping, formatage, validation, quota (testé)
tests/
  gps-core.test.js          — 46 tests Vitest
  utils.test.js             — 124 tests Vitest
  campings-core.test.js     — 8 tests Vitest
  events-core.test.js       — 10 tests Vitest
  offline-core.test.js      — 11 tests Vitest
  weather-core.test.js      — 6 tests Vitest
  fixtures/route-sample.js  — 50 pts GPS réels sous-échantillonnés (25 FR + 25 IE)
  README.md                 — doc tests, couverture, comment ajouter un test
docs/superpowers/
  specs/                    — design technique détaillé de chaque feature (source de vérité)
  plans/                    — plans d'implémentation step-by-step (checkbox) pour agents
FRANCE-TRACK.gpx            — trace France
IRELANDE-TRACK.gpx          — trace Irlande
firebase.rules.json         — règles RTDB versionnées (source de vérité)
package.json                — scripts test + lint (vitest ^2.1.0, eslint ^9.15.0)
```

## Architecture JS — séparation stricte des responsabilités

Le code de `index.html` est organisé en trois couches. **Ne jamais les croiser.**

| Couche | Fonctions | Règle |
|---|---|---|
| **Rendu DOM** | `render*()` | Ne lit/écrit que le DOM. Ne touche pas Firebase. |
| **Métier / état** | mutations de `current`/`stages`/`journals`, calculs | Pas de DOM, pas d'I/O directe. |
| **I/O** | `flushJournals()`, `flushState()`, listeners RTDB, `offlineQueue` | Ne manipule jamais le DOM directement. |

`index.html` délègue via des wrappers d'une ligne aux modules purs :
```js
function escAttr(s){ return Utils.escAttr(s); }
```
La prod exécute donc exactement le code couvert par les tests.

## Modules purs (testés)

Tous les modules `*-core.js` sont purs : pas de DOM, pas d'I/O. Ils exposent une API globale via `window.XxxCore` et, côté tests Node, via `module.exports` (double export).

### `js/gps-core.js` → `window.GPSCore`

| Fonction | Rôle |
|---|---|
| `snapToRoute(lat, lon, routePts, cumKm)` | Point le plus proche du tracé → `{idx, kmTotal, lat, lon}` |
| `routePointsAhead(fromIdx, distKm, routePts, cumKm)` | Points du tracé dans les N km devant (pour requêtes Overpass) |
| `ptsBbox(pts, margin)` | Bounding box `{s,n,w,e}` avec marge (pour requêtes Overpass) |
| `computeStageInfo(lat, lon, routePts, cumKm, totalKm, franceEndIdx)` | État complet : `{idx, lat, lon, kmTotal, kmRemaining, progressPct, country}` |
| `campingDist(fromIdx, campLat, campLon, routePts, cumKm)` | Distance POI : `{trace, detour}` en km |

`country` = `'FR'` si `idx <= franceEndIdx`, sinon `'IE'`.
`trace` = km sur le tracé (clampé à 0 si POI derrière), `detour` = vol d'oiseau snap→POI.

### `js/utils.js` → `window.Utils`

| Fonction/constante | Rôle |
|---|---|
| `escAttr(s)` / `escHtml(s)` | Escaping HTML — critique sécurité (utilisé dans les `onclick`) |
| `formatTime(ts)` | Timestamp → `"12 avr. à 14:30"` (locale fr-FR) |
| `summarizeExpenses(expenses)` | Agrégation `{total, days, perDay, byCat, byDate}` |
| `validateComment(c)` | `{ok, error?}` — name ≤ 30 car., text ≤ 500 car. |
| `validateExpense(e)` | `{ok, error?}` — amount, cat (liste fermée), date ISO, desc ≤ 100 |
| `validateJournal(text)` | `{ok, error?}` — vide autorisé, max 5000 car. |
| `computeQuotaBytes(photosTree)` | Estime taille base64 photos RTDB → `{count, bytes}` |
| `formatBytes(bytes)` | `bytes → "1.2 MB"` |
| `quotaLevel(bytes, quota)` | `'ok' / 'warn' / 'high' / 'block'` (seuils 70/85/90 %) |
| `safeFetch(url, opts, cfg)` | fetch durci : timeout AbortController + retries backoff expo |
| `computeKmDay(kmTotal, stages, todayISO)` | Km du jour = kmTotal − kmTotal de l'étape précédente |
| `isOfflineable(path)` | `true` si le path peut passer par la queue offline (`current`, `stages/`, `journals/`) |
| `actionLabel(path)` | Label humain pour un path Firebase (pour toasts, queue) |
| `filterVisibleJournalDates(stages, isAdmin)` | Dates visibles dans le carnet (admin : tout sauf deleted ; visiteur : published=true) |
| `EXPENSE_CATEGORIES` | Liste fermée des catégories |
| `LIMITS` | Constantes de taille partagées client/Firebase |

**`safeFetch` est le seul wrapper fetch autorisé** — toujours l'utiliser pour les appels réseau dans `index.html`. Ne jamais appeler `fetch()` directement.

### `js/campings-core.js` → `window.CampingsCore`

Filtres POI Overpass : tri par distance, dedup par coord, bornage à une fenêtre km. Aucun fetch.

### `js/weather-core.js` → `window.WeatherCore`

Parse la réponse open-meteo en `{tempMax, tempMin, precip, wind, iconKey}`. Tolérant aux champs manquants.

### `js/offline-core.js` → `window.OfflineCore`

Logique de file offline : `shouldQueue(path)`, `mergeQueue(existing, newItem)`, filtrage par type. Pas d'accès `localStorage` (celui-ci vit dans `offline.js`).

### `js/events-core.js` → `window.Events`

Mini event-bus : `Events.on(name, fn)`, `Events.off(name, fn)`, `Events.emit(name, payload)`. Utilisé pour propager `state:stages-changed`, `state:journal-changed`, etc.

## Points non-évidents — ne jamais casser

- **Photos** : base64 dans RTDB (pas Firebase Storage — payant). Lazy load via `IntersectionObserver`. Listeners RTDB désabonnés à chaque `renderJournal()` pour éviter les fuites mémoire.
- **Journal** : debounce 60 s **par date** + `flushJournals()` déclenché via `flushState()` sur `beforeunload` ET `visibilitychange:hidden` (iOS Safari ne déclenche pas `beforeunload`).
- **Publication journal** : champ `published: boolean` dans `stages[date]`. Absence du champ = brouillon, invisible pour les visiteurs. `renderJournal()` filtre via `filterVisibleJournalDates(stages, isAdmin)`.
- **Boot visiteur** : charge uniquement `/current` (~100 B). `/stages` chargé à l'ouverture de l'onglet Carnet. Photos, commentaires, bravos et journal chargés lazy par date via `IntersectionObserver` (`loadStageContent`).
- **Hors-ligne** : state dans `localStorage` + `offlineQueue`. Photos, commentaires et dépenses ne sont **pas** disponibles offline — c'est voulu, pas un bug.
- **Service worker** : app shell (index.html, js/) → network-first. Libs externes (Leaflet CDN) → cache-first. Firebase / open-meteo / Overpass → jamais mis en cache.
- **Admin** : déconnexion auto après 3 min d'inactivité.
- **`TOTAL_KM` fixture ≠ prod** : la fixture de test (~2337 km) est sous-échantillonnée, la prod fait ~2978 km. Ne pas confondre dans les assertions.

## Firebase RTDB — règles d'accès

| Nœud | Lecture | Écriture |
|---|---|---|
| `current` | publique | auth + validate structure `lat/lon/kmTotal/date/ts` |
| `stages/$date` | publique | auth + validate `lat/lon/kmTotal` |
| `journals/$date` | publique | auth + validate string ≤ 5000 |
| `photos/$date/$id` | publique | auth + validate < 500 000 chars base64 |
| `comments/$date/$id` | publique | création sans auth, modif/suppr auth — validation name/text |
| `bravos/$date/$visitorId` | publique | write-once, validate `true` |
| `expenses` | auth uniquement | auth uniquement |

Quota gratuit : **1 Go**. Surveillé via `computeQuotaBytes` + `quotaLevel` dans `utils.js`.
`firebase.rules.json` est la **source de vérité** — toujours le mettre à jour avant de déployer de nouvelles règles sur la console Firebase.

## Tests

```bash
npm install          # une seule fois
npm test             # run unique (CI, avant tout commit)
npm run test:watch   # mode TDD
```

**Règles absolues :**
- Lancer les tests avant de considérer une tâche terminée. Ne pas laisser un test cassé.
- Toute modification de `gps-core.js` ou `utils.js` → test ajouté ou mis à jour dans le fichier correspondant.
- Toute nouvelle fonction pure (calcul, validation, formatage) → test obligatoire.
- Code DOM-only → test non requis.
- **Zéro appel réseau réel dans les tests** : mocker Firebase RTDB et toute API tierce. Les tests doivent tourner hors-ligne.

Si le tracé GPX change significativement, régénérer `tests/fixtures/route-sample.js` avec le script Python documenté dans `tests/README.md`.

## Docs / specs / plans

```
docs/superpowers/specs/   — design technique détaillé de chaque feature
docs/superpowers/plans/   — plans d'implémentation step-by-step (checkbox) pour agents
```

Avant d'implémenter une feature documentée ici : **lire le spec en entier** avant d'écrire la moindre ligne de code.

## Qualité du code

**Typage**
- JSDoc (`@param`, `@returns`) sur toute fonction dont le type n'est pas évident.
- Type guard (`typeof`, `Array.isArray`, `instanceof`) avant usage d'une valeur de type inconnu.

**Erreurs**
- Toute fonction `async` / tout `.then()` → `try/catch` ou `.catch()` avec `console.error('[contexte]', err)`.
- Pas de `catch {}` vide.

## Données de référence

**Catégories dépenses** (liste fermée — `EXPENSE_CATEGORIES` dans utils.js) :
`Hébergement` · `Nourriture` · `Transport` · `Équipement` · `Loisirs` · `Autre`

**Tags journal** :
`Beau temps` · `Pluie` · `Vent` · `Dur` · `Génial` · `Pub` · `Camping` · `Bivouac` · `Photos`

**Limites** (`LIMITS` dans utils.js) :

| Champ | Max |
|---|---|
| Nom commentaire | 30 car. |
| Texte commentaire | 500 car. |
| Description dépense | 100 car. |
| Montant dépense | < 10 000 € |
| Texte journal | 5 000 car. |

## Conventions Git

**Commits atomiques** : un commit = une seule modification logique. Jamais de mélange feature/fix/refacto.

**Conventional Commits (en anglais)** :
- `feat:` nouvelle fonctionnalité
- `fix:` correction de bug
- `refactor:` réécriture sans changement de comportement
- `chore:` maintenance (deps, config)
- `docs:` documentation uniquement

**Avant chaque commit** : vérifier l'absence de `console.log()` de debug et de blocs commentés inutiles dans le diff stagé. Ne jamais utiliser `--no-verify` sans demande explicite.

## Faiblesses connues (backlog)

- Photos/commentaires/dépenses indisponibles hors-ligne
