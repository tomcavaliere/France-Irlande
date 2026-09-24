# biketrip — Bikepacking France → Irlande

PWA de suivi de voyage en temps réel. Tom journalise, ses proches suivent en live.
Tracé complet : France (Annecy → Roscoff) + Irlande (Cork → Sligo).
**Voyage terminé (2026)** : la vraie version est un carnet archivé en lecture seule ; le projet sert de vitrine CV via le mode démo (`…/#demo`).

## Stack

- **Frontend** : HTML/CSS/JS vanilla — `index.html` (~350 lignes, shell + bootstrap) + `css/styles.css` (~690 lignes) + ~35 scripts dans `js/`, rangés par couche. Zéro build, zéro framework, chargés via `<script>` dans l'ordre.
- **Carte** : Leaflet 1.9.4 **auto-hébergé** dans `vendor/leaflet/` (hash identique à la release officielle ; aucun CDN tiers hors Firebase).
- **Backend** : Firebase RTDB `france-irlande-bike`, région `europe-west1`. Lecture publique sauf `expenses`, `activity`, `visitorProfiles` (auth uniquement). Écriture : auth uniquement partout (mode archive).
- **Deploy** : GitHub Pages → `https://tomcavaliere.github.io/France-Irlande/` (site servi sous le sous-chemin `/France-Irlande/`).
- **PWA** : service worker `sw.js` (cache `ev1-v46`), `manifest.json`, icônes PNG dans `icons/`.
- **Mode démo** : lien CV public (`…/#demo` ou bouton du gate) — backend Firebase remplacé par des stubs en mémoire, données 100 % fictives (voir section « Mode démo »).
- **Tests** : Vitest (`npm test`) pour la logique pure — Node pur, aucun jsdom. Playwright (`npm run test:e2e`) pour les parcours de la démo + audit d'accessibilité axe-core.
- **Lint/CI** : ESLint 9 flat config + GitHub Actions (`.github/workflows/ci.yml`) : job `test` (`lint`, `test`, `security:test`) et job `e2e` (Playwright Chromium) sur chaque push/PR.

## Structure du repo

```
index.html                  — shell HTML + bootstrap (~350 lignes) — racine obligatoire (GitHub Pages)
sw.js                       — service worker — racine obligatoire (son scope doit couvrir tout le site)
confidentialite.html        — page statique Confidentialité et mentions légales (précachée, sans JS)
manifest.json               — PWA manifest
css/styles.css              — styles globaux (~690 lignes, tokens de couleur dans :root)
icons/                      — icône SVG originale + PNG 192/512/maskable/apple-touch
vendor/leaflet/             — Leaflet 1.9.4 auto-hébergé (js, css, images, licence)
js/
  core/                     — logique PURE, double export, testée (tests/unit/)
    utils.js                — helpers : escaping, formatage, validation, quota, safeFetch
    gps-core.js             — calculs GPS : snap tracé, progression, POI
    events-core.js          — mini event-bus (emit / on / off)
    offline-core.js         — logique queue/retry
    journal-core.js         — bravos, labels km/date, fusion brouillons/temps réel
    stages-core.js          — flag pays, dates, totaux recap, étape manuelle, compteur de jours
    visitor-auth-core.js    — normalisation hash, extraction config, validation mot de passe
    activity-core.js        — stats du tableau de bord d'activité
    comments-core.js        — nom d'auteur et normalisation des réponses admin
    campings-core.js        — filtres POI
    weather-core.js         — parsing réponse open-meteo
    demo-core.js            — arbre par chemin (pathGet/Set/Remove), snapshots, flag démo
  services/                 — I/O, jamais de DOM
    firebase-init.js        — init Firebase app, auth, db, storage (ESM import)
    db.js                   — façade RTDB : Db.ready/get/set/remove/on (double export, testé)
    offline.js              — queue writes localStorage, flush au retour réseau
  app/                      — socle partagé par les fonctionnalités
    state.js                — vars globales partagées (current, stages, journals…), ARCHIVED
    ui.js                   — toast, confirm dialog, lightbox, sync dot, délégation (clic/clavier/Échap), brouillons
    init.js                 — amorçage DOM, délégation events, listeners globaux (chargé en dernier)
  features/                 — une fonctionnalité par fichier : rendu + orchestration, logique déléguée à core/
    map.js                  — init Leaflet, couches, marqueurs, tracés GPX
    journal.js              — rendu, sauvegarde immédiate, subscriptions, lazy load, bravos
    stages.js               — cartes étapes, upload/delete GPX, recap, suppression complète d'étape
    photos.js               — compression + upload Firebase Storage, suppression
    videos.js               — upload Firebase Storage, progress, cancel
    comments.js             — post, suppression, cache local
    expenses.js             — CRUD dépenses + synthèse
    activity.js             — tableau de bord des connexions + tracking (admin)
    campings.js             — requêtes OpenCampingMap/Overpass campings/eau, Campspace (lazy)
    weather.js              — fetch open-meteo + rendu widget
    admin.js                — login, profil, inactivité, quota photos, position GPS
    visitor-auth.js         — hash pwd visiteur, gate d'entrée
  demo/                     — bascule démo (voir « Mode démo »)
    demo-flag.js            — pose window.DEMO_MODE au parse (non-defer — la CSP interdit l'inline)
    demo-mode.js            — stubs window._fb* (RTDB/Auth/Storage), bandeau démo, entrée/sortie
    demo-data.js            — données 100 % fictives : 6 étapes irlandaises sur le vrai tracé (généré)
  data/                     — données statiques volumineuses (non lintées)
    route-data.js           — tracé GPS complet (5 058 points, 255 KB)
    campspace-data.js       — dump Campspace (520 KB) — chargé à la demande (admin), pas précaché
tests/
  unit/                     — Vitest : un fichier par module de js/core/ (+ db.test.js)
  static/                   — garde-fous sur les fichiers livrés
    sw-precache.test.js     — PRECACHE ⊇ assets d'index.html, chemins relatifs (Vitest)
    index-html.test.js      — viewport zoomable, manifest + icônes (Vitest)
    security-check.js       — règles Firebase, CSP, motifs JS interdits (npm run security:test)
  e2e/                      — Playwright : demo.e2e.js (parcours démo, archive, SW hors-ligne), a11y.e2e.js (axe)
  fixtures/route-sample.js  — 50 pts GPS réels sous-échantillonnés (25 FR + 25 IE)
  README.md                 — doc tests, nombre de tests par fichier, comment ajouter un test
firebase/
  database.rules.json       — règles RTDB versionnées (source de vérité)
  storage.rules             — règles Firebase Storage versionnées (vidéos < 200 MB)
gpx/                        — traces sources FRANCE-TRACK.gpx et IRELANDE-TRACK.gpx (non chargées par l'app)
scripts/
  serve.mjs                 — serveur statique local sous /France-Irlande/ (comme GitHub Pages)
  migrate-photos.js         — migration one-shot photos base64 RTDB → Storage
docs/
  superpowers/specs/        — design technique détaillé de chaque feature (source de vérité)
  superpowers/plans/        — plans d'implémentation step-by-step (checkbox) pour agents
  media/                    — captures d'écran du README
  rgpd.md                   — registre des traitements RGPD
eslint.config.js            — ESLint 9 flat config (globales de l'app générées au lint)
playwright.config.js        — config E2E (Chromium, viewport Pixel 7, serveur scripts/serve.mjs)
.github/workflows/ci.yml    — CI : job test (lint + unit + sécurité) + job e2e
package.json                — scripts npm : test, test:e2e, lint, security:test, serve
```

Total : 357 tests Vitest (15 fichiers) + 18 tests E2E Playwright (2 fichiers).

## Architecture JS — séparation stricte des responsabilités

Le code des modules `js/` est organisé en trois couches. **Ne jamais les croiser.** Les sous-dossiers de `js/` les matérialisent (voir « Où placer un fichier »).

| Couche | Fonctions | Règle |
|---|---|---|
| **Rendu DOM** | `render*()` | Ne lit/écrit que le DOM. Ne touche pas Firebase. |
| **Métier / état** | mutations de `current`/`stages`/`journals`, calculs | Pas de DOM, pas d'I/O directe. |
| **I/O** | `Db.*`, `flushJournals()`, `flushState()`, listeners RTDB, `offlineQueue` | Ne manipule jamais le DOM directement. |

Les modules feature délèguent via des wrappers d'une ligne aux modules purs `*-core.js` :
```js
function escAttr(s){ return Utils.escAttr(s); }
```
La prod exécute donc exactement le code couvert par les tests.

**Où placer un fichier**

| Dossier | Contient | Règle |
|---|---|---|
| `js/core/` | logique pure (calcul, validation, normalisation, formatage) | Ni DOM ni I/O. Double export `window.XxxCore` + `module.exports`. Test obligatoire dans `tests/unit/<module>.test.js`. |
| `js/services/` | I/O : Firebase, façade `Db`, file hors-ligne | Jamais de DOM. |
| `js/app/` | état partagé, helpers UI communs, amorçage | `init.js` reste le dernier script chargé. |
| `js/features/` | une fonctionnalité par fichier (`render*`, handlers, orchestration) | Délègue sa logique à `core/` et ses écritures à `services/`. |
| `js/demo/` | tout ce qui n'existe qu'en mode démo | La vraie version doit fonctionner comme si ce dossier n'était pas là. |
| `js/data/` | données statiques volumineuses ou générées | Pas de logique ; ignoré par ESLint. |

Les scripts sont des `<script defer>` classiques : **l'ordre des balises dans `index.html` est l'ordre d'exécution**, indépendant des dossiers. Un nouveau fichier s'ajoute à `index.html` **et** à `PRECACHE` dans `sw.js` (`tests/static/sw-precache.test.js` le vérifie).

**Accès RTDB : toujours via `Db` (`js/services/db.js`)** — `Db.get(path)`, `Db.set(path, v)`, `Db.remove(path)`, `Db.on(path, cb, errCb)`, `Db.ready()`. Ne jamais écrire `window._fbSet(window._fbRef(window._fbDb, …))` à la main : la façade gère l'absence de Firebase (rejet propre au lieu d'un TypeError) et reste identique en démo. Storage et Auth passent encore directement par `window._fbStorage*` / `window._fbAuth`.

**Globales partagées** : les scripts ne sont pas des modules. `eslint.config.js` scanne `js/**/*.js` à chaque lint (fonctions et `var` de premier niveau, `window.Xxx =`) et `no-undef` est actif : une nouvelle fonction est reconnue d'office, une faute de frappe casse le lint.

## Modules purs (testés)

Tous les modules `*-core.js` sont purs : pas de DOM, pas d'I/O. Ils exposent une API globale via `window.XxxCore` et, côté tests Node, via `module.exports` (double export).

### `js/core/gps-core.js` → `window.GPSCore`

| Fonction | Rôle |
|---|---|
| `snapToRoute(lat, lon, routePts, cumKm)` | Point le plus proche du tracé → `{idx, kmTotal, lat, lon}` |
| `routePointsAhead(fromIdx, distKm, routePts, cumKm)` | Points du tracé dans les N km devant (pour requêtes Overpass) |
| `ptsBbox(pts, margin)` | Bounding box `{s,n,w,e}` avec marge (pour requêtes Overpass) |
| `computeStageInfo(lat, lon, routePts, cumKm, totalKm, franceEndIdx)` | État complet : `{idx, lat, lon, kmTotal, kmRemaining, progressPct, country}` |
| `campingDist(fromIdx, campLat, campLon, routePts, cumKm)` | Distance POI : `{trace, detour}` en km |

`country` = `'FR'` si `idx <= franceEndIdx`, sinon `'IE'`.
`trace` = km sur le tracé (clampé à 0 si POI derrière), `detour` = vol d'oiseau snap→POI.

### `js/core/utils.js` → `window.Utils`

| Fonction/constante | Rôle |
|---|---|
| `escAttr(s)` / `escHtml(s)` | Escaping HTML — critique sécurité (utilisé dans les `onclick`) |
| `formatTime(ts)` | Timestamp → `"12 avr. à 14:30"` (locale fr-FR) |
| `summarizeExpenses(expenses)` | Agrégation `{total, days, perDay, byCat, byDate}` |
| `validateComment(c)` | `{ok, error?}` — name ≤ 30 car., text ≤ 500 car. |
| `validateExpense(e)` | `{ok, error?}` — amount, cat (liste fermée), date ISO, desc ≤ 100 |
| `validateJournal(text)` | `{ok, error?}` — vide autorisé, max 5000 car. |
| `localISODate(d?)` | Date calendaire **locale** `YYYY-MM-DD` (ne jamais utiliser `toISOString().slice(0,10)` : c'est la date UTC) |
| `computeQuotaBytes(photosTree)` | Estime taille des anciennes photos base64 RTDB → `{count, bytes}` (les meta Storage ne pèsent pas) |
| `countPhotos(photosTree)` | Nombre de photos tous formats (meta Storage + base64) |
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

### `js/core/campings-core.js` → `window.CampingsCore`

Filtres POI Overpass : tri par distance, dedup par coord, bornage à une fenêtre km. Aucun fetch.

### `js/core/weather-core.js` → `window.WeatherCore`

Parse la réponse open-meteo en `{tempMax, tempMin, precip, wind, iconKey}`. Tolérant aux champs manquants.

### `js/core/offline-core.js` → `window.OfflineCore`

Logique de file offline : `shouldQueue(path)`, `mergeQueue(existing, newItem)`, filtrage par type. Pas d'accès `localStorage` (celui-ci vit dans `offline.js`).

### `js/core/events-core.js` → `window.Events`

Mini event-bus : `Events.on(name, fn)`, `Events.off(name, fn)`, `Events.emit(name, payload)`. Utilisé pour propager `state:stages-changed`, `state:journal-changed`, etc.

### `js/core/journal-core.js` → `window.JournalCore`

| Fonction | Rôle |
|---|---|
| `countBravos(bravosData)` | Nombre de bravos pour une date (`Object.keys(data\|\|{}).length`) |
| `hasVoted(bravosData, visitorId)` | `true` si l'identifiant visiteur figure dans les bravos |
| `buildKmInfoLabel(stage)` | `"🚴 42 km · ⛰️ D+ 300 m"` ou `""` si `kmDay` falsy ; `elevGain` clampé à 0 |
| `formatJournalDateLabel(dateISO, locale?)` | `"2026-04-20"` → `"lundi 20 avril"` (fr-FR par défaut, convention `T12:00:00`) |
| `mergeRemoteWithDrafts(remote, drafts, local)` | Snapshot `journals/` fusionné avec les brouillons admin en attente (le brouillon gagne toujours) |

### `js/core/stages-core.js` → `window.StagesCore`

| Fonction | Rôle |
|---|---|
| `countryFlag(idx, franceEndIdx)` | `idx <= franceEndIdx` → 🇫🇷 ; sinon 🇮🇪 ; idx non-fini ou négatif → `''` |
| `formatStageDateLabel(dateISO)` | `"2026-04-20"` → `"lun. 20 avr."` (fr-FR, convention `T12:00:00`) |
| `computeRecapTotals(kmDone, kmLeft, nbDays, totalKm)` | `{pct, avgKmPerDay}` — pct clampé 0–100, division par zéro protégée |
| `isValidStageDate(dateISO)` / `buildManualStage(dateISO, stages, current, nowTs)` | Création d'étape manuelle (date locale, pas de futur, ancrage sur l'étape précédente) |
| `collectStageStoragePaths(dateISO, photosTree, videosTree)` | Paths Storage à supprimer avec une étape |
| `dayCount(stages, tracks)` | Compteur « J » : nb d'étapes, sinon nb de jours avec tracé GPX (visiteur avant chargement de `/stages`) |

### `js/core/visitor-auth-core.js` → `window.VisitorAuthCore`

| Fonction | Rôle |
|---|---|
| `normalizeHash(v)` | `trim().toLowerCase()` + regex `/^[a-f0-9]{64}$/` ; sinon `''` |
| `extractPasswordHash(cfg)` | string → `normalizeHash(cfg)` ; objet → `normalizeHash(cfg.passwordHash)` ; autre → `''` |
| `validatePasswordChange(password, confirm, opts)` | `{ok:true}` ou `{ok:false, error}` — vérifie min/max/match dans cet ordre |

### `js/core/activity-core.js` → `window.ActivityCore`

`normalizeEntry`, `shouldIgnoreEntry` (connexions admin et de Tom/Chloé, sans accents ni casse), `prepareEntries(tree)`, `summarize(entries)`, `lastDaysSeries(entries, n, toDayISO, nowTs?)` (fonction de jour injectée : `Utils.localISODate`), `topUsers(entries, max)`, `typeLabel`. `VALID_TYPES` doit rester aligné avec `firebase/database.rules.json`.

### `js/core/comments-core.js` → `window.CommentsCore`

`normalizeAdminReplyAuthorName(value)` (displayName/email → « Tom », « Chloé » ou nom lisible) et `normalizeCommentReply(raw)`.

## Points non-évidents — ne jamais casser

- **Photos** : fichiers sur Firebase Storage, meta `{url, path, ts}` dans RTDB (les anciennes entrées base64 restent valides — voir la règle `photos`). Lazy load via `IntersectionObserver`. Listeners RTDB désabonnés à chaque `renderJournal()` pour éviter les fuites mémoire.
- **Journal** : sauvegarde RTDB **immédiate** à chaque saisie (une écriture en vol par date, la dernière valeur enchaîne) ; les brouillons en attente priment sur le temps réel (`mergeRemoteWithDrafts`). Cache localStorage en debounce 500 ms (`scheduleLocalCacheSave`). `flushState()` (sauvegarde locale + `flushJournals()`) sur `beforeunload` ET `visibilitychange:hidden` (iOS Safari ne déclenche pas `beforeunload`).
- **Brouillons de saisie** : tout re-rendu `innerHTML` d'une zone contenant des `<textarea>` (carnet, commentaires) doit passer par `captureTextareaDrafts` / `restoreTextareaDrafts` (`ui.js`), sinon le texte en cours est effacé (arrivée lazy des commentaires, callback d'auth au démarrage). Vider le champ **avant** le re-rendu après un envoi.
- **Publication journal** : champ `published: boolean` dans `stages[date]`. Absence du champ = brouillon, invisible pour les visiteurs. `renderJournal()` filtre via `filterVisibleJournalDates(stages, isAdmin)`.
- **Boot visiteur** : charge `/current` et `/tracks`. `/stages` chargé à l'ouverture de l'onglet Carnet (d'où `StagesCore.dayCount`). Photos, commentaires, bravos et journal chargés lazy par date via `IntersectionObserver` (`loadStageContent`) : les squelettes restent sur les entrées hors écran.
- **Hors-ligne** : state dans `localStorage` + `offlineQueue`. `tryWrite` met en file commentaires, likes/réponses, dépenses ; le journal passe par `queueWrite`. Position (`updatePosition`), étapes et GPX écrivent directement (file mémoire du SDK seulement). Photos/vidéos indisponibles hors-ligne.
- **Service worker** : chemins PRECACHE **relatifs** (`'./js/…'`) — le site est sous `/France-Irlande/`, un chemin absolu vise la racine du domaine (404) et `cache.addAll` échoue : le SW ne s'installerait pas (gardé par `tests/static/sw-precache.test.js`). App shell (HTML, JS) → network-first ; CSS, images, vendor → cache-first. Firebase / open-meteo / Overpass → jamais mis en cache. **Bumper `CACHE`** à chaque changement d'asset précaché ; tout script ajouté à `index.html` doit être ajouté à `PRECACHE`.
- **Admin** : déconnexion auto après 3 min d'inactivité.
- **`TOTAL_KM` fixture ≠ prod** : la fixture de test (~2337 km) est sous-échantillonnée, la prod fait ~2978 km. Ne pas confondre dans les assertions.

## Mode archive (vraie version)

- `ARCHIVED = !window.DEMO_MODE` (`state.js`) ; `visitorWritesDisabled()` = archivé et non admin.
- Visiteurs : pas de formulaire de commentaire/réponse, bravos en compteur seul, aucun tracking d'`activity` (admin compris) ni de `visitorProfiles`. Gate : mot de passe seul, sans prénom. Note « Voyage terminé » en tête du carnet. L'admin garde tous ses droits (modération).
- `firebase/database.rules.json` : **toutes** les règles `.write` sont `auth != null` ; `tests/static/security-check.js` échoue sur toute écriture anonyme. ⚠️ Les règles se publient **à la main** dans la console Firebase.
- Le gate visiteur (mot de passe partagé, hash SHA-256 lisible dans `/visitorAuth`) est **cosmétique** : les données sont en lecture publique via l'API RTDB. Assumé pour un carnet familial.

## Mode démo

Version publique pour lien CV : mêmes fonctionnalités, données 100 % fictives, zéro contact Firebase.

- **Activation** : bouton « Découvrir la version démo » sur le gate visiteur (flag `localStorage['ev1-demo']='1'` + reload) ou lien direct `…/#demo`. `js/demo/demo-flag.js` (chargé **sans defer**, la CSP interdit l'inline) pose `window.DEMO_MODE` au parse, avant tout script différé.
- **Bascule unique** : en démo, `firebase-init.js` n'importe pas Firebase ; `js/demo/demo-mode.js` installe des stubs `window._fb*` (RTDB, Auth, Storage) alimentés par un arbre en mémoire cloné depuis `DEMO_DATA`. Les ~30 sites d'appel sont inchangés. Écritures fonctionnelles mais volatiles : recharger réinitialise la démo.
- **Admin démo** : bouton « Tester le mode admin » du bandeau — faux `signIn` sans mot de passe, tout le flux admin existant fonctionne (auto-déconnexion 3 min comprise).
- **Uploads démo** : photos/vidéos passent par un faux uploadTask, l'URL retournée est un `URL.createObjectURL(blob)` (d'où la directive CSP `media-src blob:`).
- **Isolation stricte** : en démo, ne jamais lire/écrire les caches `ev1-*`, `offlineQueue`, `ev1_visitor_id` ni la session visiteur (`isVisitorAuthenticated()` retourne `true` et `peekVisitorId()` un identifiant constant, sans toucher localStorage). Guards dans `offline.js`, `state.js`, `visitor-auth.js`. Ne pas les retirer : un visiteur démo pourrait sinon déverrouiller la vraie version ou corrompre/vider la vraie queue offline.
- La vraie version reste strictement inchangée quand `DEMO_MODE` est falsy.

## RGPD — ne jamais casser

Registre des traitements : `docs/rgpd.md`. Page publique : `confidentialite.html`.

- **Aucune donnée personnelle dans un nœud en lecture publique** (email, auteur, `updatedBy`…) : `tests/static/security-check.js` échoue sur toute clé `mail`/`updatedBy` sous un nœud `.read: true`.
- **Identifiant visiteur** : `getVisitorId()` (crée `ev1_visitor_id`) uniquement dans une action d'écriture (bravo, like, réponse) ; tout rendu passe par `peekVisitorId()`. Retiré au démarrage en archive (`purgeArchivedVisitorId`, `purgeArchivedVisitorName`).
- **Tiers** : pas d'appel tiers superflu pour les visiteurs (la météo n'est chargée qu'à l'ouverture de l'onglet Étapes, admin).
- **Tout nouveau tiers, nouvelle donnée ou nouvelle clé `localStorage`** → mettre à jour `confidentialite.html` et `docs/rgpd.md`.
- **Tracé** : le départ réel (adresse privée) est masqué dans un rayon de 1,5 km dans `gpx/` et `js/data/route-data.js` ; ne jamais réintroduire les points d'origine.

## Firebase RTDB — règles d'accès

| Nœud | Lecture | Écriture |
|---|---|---|
| `current` | publique | auth + validate structure `lat/lon/kmTotal/date/ts` |
| `stages/$date` | publique | auth + validate `lat/lon/kmTotal` |
| `journals/$date` | publique | auth + validate string ≤ 5000 |
| `photos/$date/$id` | publique | auth + validate meta `{url, path, ts}` (ou legacy string base64 < 500 000 chars) |
| `videos/$date/$id` | publique | auth + validate URL Firebase Storage ≤ 500 chars |
| `tracks/$date` | publique | auth + validate `coords/kmDay/ts` |
| `comments/$date/$id` | publique | auth (archive) — validation name/text, étape existante |
| `bravos/$date/$visitorId` | publique | auth (archive) — validate `true` |
| `commentLikes/$date/$id` | publique | auth |
| `commentReplies/$date/$id` | publique | auth — réponse admin `{text, ts, authorName?, likes?, replies?}` |
| `visitorAuth` | publique | auth + validate hash SHA-256 + `updatedAt` |
| `visitorProfiles/$visitorId` | auth uniquement | auth (archive) — `{name, ts}` |
| `activity/$id` | auth uniquement | auth (archive) — `{type, name, ts}`, type ∈ `ACTIVITY_VALID_TYPES` |
| `expenses` | auth uniquement | auth uniquement |

Quota gratuit : **1 Go**. Surveillé via `computeQuotaBytes` + `quotaLevel` dans `utils.js`.
`firebase/database.rules.json` est la **source de vérité** — toujours le mettre à jour avant de déployer de nouvelles règles sur la console Firebase. Les vidéos sont hébergées sur Firebase Storage (règles dans `firebase/storage.rules`, taille max 200 MB).

## Tests

```bash
npm ci                          # une seule fois
npm test                        # Vitest, run unique (CI, avant tout commit)
npm run test:watch              # mode TDD
npx playwright install chromium # une seule fois
npm run test:e2e                # Playwright sur la démo (lance scripts/serve.mjs)
npm run lint
npm run security:test
npm run serve                   # http://localhost:4173/France-Irlande/#demo
```

**Règles absolues :**
- Lancer les tests avant de considérer une tâche terminée. Ne pas laisser un test cassé.
- Toute modification de `gps-core.js` ou `utils.js` → test ajouté ou mis à jour dans le fichier correspondant.
- Toute nouvelle fonction pure (calcul, validation, formatage) → test obligatoire.
- Code DOM-only → test non requis.
- **Zéro appel réseau réel dans les tests** : mocker Firebase RTDB et toute API tierce. Les tests doivent tourner hors-ligne. En E2E : uniquement le mode démo (aucun Firebase) ; tuiles OSM et open-meteo interceptées (`page.route`).
- Parcours démo modifié ou nouvelle vue → test E2E, et la vue doit passer l'audit axe (`tests/e2e/a11y.e2e.js`).
- Dates : tests construits en heure locale (`new Date(2026, 4, 20, 12)`), jamais `Date.UTC` pour un « aujourd'hui » ; la suite doit passer quel que soit `TZ`.

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
- Pas de `catch {}` vide. Pas d'`alert()` : `showToast(msg, 'warn'|'error')`.

**Accessibilité** (vérifiée par axe en CI)
- Bouton sans texte visible → `aria-label`. Image → `alt`. Overlay → `role="dialog"` + `aria-modal` + nom ; Échap le ferme (`_ESCAPE_OVERLAYS` dans `ui.js`).
- Élément cliquable non-`<button>` → `role="button" tabindex="0"` + `data-action` : la délégation gère Entrée/Espace.
- Couleurs de texte via tokens contrastés : `--text-light`, `--orange-text` (pas `--orange`), `--danger`. Ne pas rebloquer le zoom dans le viewport.
- Marqueurs Leaflet : toujours une option `title`.

## Données de référence

**Catégories dépenses** (liste fermée — `EXPENSE_CATEGORIES` dans utils.js) :
`Hébergement` · `Nourriture` · `Transport` · `Équipement` · `Loisirs` · `Autre`

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

- Photos et vidéos indisponibles hors-ligne ; position/étapes non persistées dans `offlineQueue` (file mémoire du SDK uniquement).
- Quota RTDB legacy (`computeQuotaBytes`, blocage upload à 90 %) : à retirer une fois confirmé que `scripts/migrate-photos.js` a tourné en prod.
- Gate visiteur cosmétique (lecture RTDB publique).
