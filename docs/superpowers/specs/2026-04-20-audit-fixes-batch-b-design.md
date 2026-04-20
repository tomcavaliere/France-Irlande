# Audit fixes — Batch B (Quick wins + fiabilité)

## Contexte

Traitement du scope **B** issu de l'audit [`analyse-les-faiblesses-de-curried-gem.md`](/Users/tomcavaliere/.claude/plans/analyse-les-faiblesses-de-curried-gem.md) :
items 1, 2, 3, 6, 7 de la table de priorisation. L'objectif est de poser des garde-fous CI,
recaler la doc sur la réalité du code modularisé, et combler les trous de fiabilité
visibles par l'utilisateur (sauvegardes silencieuses, absence de feedback lazy-load).

Périmètre volontairement resserré : on ne touche pas à la couverture de tests
(item 4), ni au throttle serveur Firebase (item 8), ni aux plans en cours (item 5).

---

## Objectifs

1. **CI** : toute PR passe par `npm test` + ESLint avant merge.
2. **Doc** : `CLAUDE.md` reflète l'architecture modulaire réelle (22 modules, cache v25).
3. **Fiabilité perçue** : l'utilisateur sait quand une écriture journal échoue et reste informé en continu quand il est hors-ligne.
4. **UX lazy-load** : plus d'écran blanc lors du chargement d'une entrée journal.
5. **Hygiène** : supprimer les sources de vérité mortes (`copilot-instructions.md`).

---

## Bloc 1 — GitHub Actions CI + ESLint

### Fichiers à créer
- `.github/workflows/ci.yml` — workflow GitHub Actions
- `eslint.config.js` — flat config ESLint 9

### Fichiers à modifier
- `package.json` — ajouter `lint` + devDeps ESLint

### Détails techniques

**Workflow CI** (`.github/workflows/ci.yml`) :
- Trigger : `push` sur `main` + `pull_request`
- Node 20 LTS
- Étapes : `npm ci` → `npm run lint` → `npm test`
- Pas de matrice de versions (app vanilla, pas de compat à prouver)

**ESLint flat config** (`eslint.config.js`) :
- Règles minimales non-intrusives (pas de reformatage massif) :
  - `no-console` en `warn` avec `allow: ['warn', 'error']` (ne casse pas les `console.error` existants)
  - `no-unused-vars` en `warn` (avec `argsIgnorePattern: '^_'` pour `_arg2` etc.)
  - `no-undef` en `error` — nécessite de déclarer les globals (voir ci-dessous)
  - `eqeqeq` en `warn`
  - `semi` en `error` (cohérent avec le style actuel)
- **Globals** déclarés : `window`, `document`, `console`, `localStorage`, `fetch`, `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`, `Promise`, `crypto`, `IntersectionObserver`, `FileReader`, `Event`, `CustomEvent`, `AbortController`, `URL`, ainsi que les globals de l'app : `map`, `stages`, `journals`, `photos`, `videos`, `comments`, `tracks`, `current`, `isAdmin`, `isOnline`, `offlineQueue`, `Events`, `Utils`, `GPSCore`, `ALL_ROUTE_PTS`, `CUM_KM`, `TOTAL_KM`, `FRANCE_END_IDX`, `snapToRoute`, `escAttr`, `escHtml`, `showToast`, `confirmDialog`, etc.
- **Exclusions** (`ignores`) : `route-data.js` (255 KB), `campspace-data.js` (520 KB), `node_modules/`, `coverage/`, `sw.js` (ServiceWorker globals spécifiques — sera traité à part si besoin)
- Override `tests/**/*.js` : ajouter `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach` aux globals

**`package.json`** :
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "lint": "eslint js/ tests/"
},
"devDependencies": {
  "vitest": "^2.1.0",
  "eslint": "^9.15.0",
  "globals": "^15.12.0"
}
```

### Critères de succès
- `npm run lint` sort en 0 (après ajustement éventuel des globals si des warnings remontent)
- Le workflow CI tourne vert sur une PR factice
- Aucun fichier de prod n'est modifié par l'ajout du linter (pas d'auto-fix massif)

---

## Bloc 2 — MAJ `CLAUDE.md`

### Fichier à modifier
- `CLAUDE.md`

### Changements précis

| Section | Avant | Après |
|---|---|---|
| Stack | `index.html (~1700 lignes)` | `index.html (~720 lignes) + ~20 modules JS dans js/` |
| Stack | `cache ev1-v13` | `cache ev1-v25` |
| Structure du repo | liste réduite à `gps-core.js` + `utils.js` | lister les 22 modules (voir ci-dessous) |
| Modules purs | seuls `gps-core` + `utils` documentés | ajouter `campings-core`, `events-core`, `offline-core`, `weather-core` avec une ligne par rôle principal |
| Faiblesses connues | "copilot-instructions.md obsolète" | supprimer cette ligne (fichier supprimé en Bloc 3) |

**Liste des 22 modules** à intégrer dans la section structure (groupés par rôle) :
- Cœur / bootstrap : `firebase-init`, `init`, `state`, `events-core`
- UI : `ui`, `admin`, `visitor-auth`
- Carte : `map-core`, `route-data`
- Contenu : `journal`, `stages`, `photos`, `videos`, `comments`, `expenses`
- Données annexes : `campings`, `campings-core`, `weather`, `weather-core`
- Hors-ligne / utilitaires : `offline`, `offline-core`, `gps-core`, `utils`

### Critères de succès
- Relecture manuelle : aucune référence à `~1700 lignes`, `ev1-v13`, ou « tout dans index.html » ne subsiste
- Section tests intacte (inchangée)

---

## Bloc 3 — Suppression `copilot-instructions.md`

### Action
```bash
git rm .github/copilot-instructions.md
```

Commit séparé pour traçabilité.

### Critères de succès
- Le fichier n'existe plus
- La ligne correspondante dans `CLAUDE.md` (backlog) est retirée (fait en Bloc 2)

---

## Bloc 4 — `.catch()` manquants + bannière offline persistante

### Fichiers à modifier
- `js/journal.js`
- `js/ui.js`
- `index.html` (ajout du DOM `#offlineBanner`)

### Détails techniques

**4.a — `.catch()` sur `journal.js`**

Ligne 15 (`onJournalInput` → setTimeout) : wrapper le `_fbSet` avec gestion d'erreur :
```js
window._fbSet(window._fbRef(window._fbDb,'journals/'+date),text)
  .catch(function(err){
    console.error('[onJournalInput]', err);
    showToast('Journal non sauvé — nouvelle tentative au prochain retour réseau', 'error', 6000);
    queueWrite('journals/'+date, text);
  });
```
La mise en queue offline garantit que la donnée n'est pas perdue (pattern déjà utilisé ailleurs).

Ligne 26 (`flushJournals`) : idem, ajouter `.catch()` avec `console.error` + `queueWrite`. Pas de toast ici (flushJournals tourne sur `beforeunload` / `visibilitychange:hidden` — afficher un toast est inutile car l'utilisateur quitte la page).

**Audit complémentaire** : vérifier via grep qu'aucun autre `_fbSet` / `_fbPush` / `_fbUpdate` n'est sans `.catch()`. Si détecté, corriger dans le même commit.

**4.b — Bannière offline persistante**

Ajouter dans `index.html`, juste après l'ouverture de `<body>` (avant le header) :
```html
<div id="offlineBanner" role="alert" aria-live="polite" hidden>
  🔴 Hors-ligne — tes modifications seront synchronisées au retour du réseau.
</div>
```

Style (à ajouter dans le bloc `<style>` existant) :
```css
#offlineBanner{position:sticky;top:0;z-index:1000;background:#c62828;color:#fff;
  padding:8px 12px;text-align:center;font-size:13px;font-weight:500;
  padding-top:calc(8px + env(safe-area-inset-top))}
#offlineBanner[hidden]{display:none}
```

Piloter depuis `ui.js` — modifier `setSyncDot(mode)` pour afficher/masquer la bannière :
```js
function setSyncDot(mode){
  var dot=document.getElementById('syncDot');
  if(!dot)return;
  dot.style.display='inline-block';
  dot.classList.toggle('offline', mode==='offline');
  dot.classList.toggle('syncing', mode==='syncing');
  dot.classList.toggle('queued', mode==='queued');
  var banner=document.getElementById('offlineBanner');
  if(banner)banner.hidden = (mode!=='offline');
}
```

### Critères de succès
- Couper le réseau → bannière rouge visible en haut, `role="alert"` annoncé par lecteurs d'écran
- Remettre le réseau → bannière disparaît automatiquement (driven par `setSyncDot('online')`)
- Écrire dans un journal offline : toast « Journal non sauvé » + mise en queue → réapparition après reconnexion
- `grep -rn "_fb\(Set\|Push\|Update\)" js/ | grep -v catch` ne retourne plus de match problématique

---

## Bloc 5 — Skeleton lazy-load journal

### Fichier à modifier
- `js/journal.js`
- `index.html` (CSS pour `.j-skeleton`)

### Détails techniques

Dans `renderJournal()` ([`journal.js:162`](/Users/tomcavaliere/Documents/VOYAGE/BIKEPACKING/France-Irlande/js/journal.js#L162)), lors de la création de chaque `.journal-entry`, ajouter un bloc skeleton **avant** le `renderMediaHtml(date)` :

```js
var skeletonHtml='<div class="j-skeleton" data-skeleton-for="'+edate+'">'+
  '<div class="j-skeleton-row"></div>'+
  '<div class="j-skeleton-row"></div>'+
  '<div class="j-skeleton-media"></div>'+
'</div>';
```

Dans `loadStageContent()`, au premier snapshot reçu (photos OU journals — le plus rapide), retirer le skeleton :
```js
function _removeSkeleton(date){
  var sk=document.querySelector('.j-skeleton[data-skeleton-for="'+date+'"]');
  if(sk&&sk.parentNode)sk.parentNode.removeChild(sk);
}
```
Appeler `_removeSkeleton(date)` dans chacun des 5 callbacks `_fbOnValue` (guard idempotent — si déjà retiré, le `querySelector` renvoie `null` et on sort).

**CSS** (dans `index.html`) :
```css
.j-skeleton{padding:8px 0}
.j-skeleton-row{height:14px;border-radius:4px;margin:6px 0;
  background:linear-gradient(90deg,#eee 25%,#f5f5f5 50%,#eee 75%);
  background-size:200% 100%;animation:skeleton 1.2s infinite}
.j-skeleton-row:nth-child(2){width:70%}
.j-skeleton-media{height:80px;border-radius:6px;margin-top:8px;
  background:linear-gradient(90deg,#eee 25%,#f5f5f5 50%,#eee 75%);
  background-size:200% 100%;animation:skeleton 1.2s infinite}
@keyframes skeleton{0%{background-position:200% 0}100%{background-position:-200% 0}}
```

### Critères de succès
- Scroll rapide dans le journal → chaque carte affiche brièvement un skeleton pulsant avant l'apparition du texte/media
- Skeleton disparait dès le premier snapshot reçu (typiquement < 500 ms en conditions normales)
- Pas de flash blanc / pas de double rendu

---

## Ordre de livraison et commits

Un commit Conventional Commits par bloc (atomique) :

1. `chore: add GitHub Actions CI + ESLint flat config`
2. `docs: sync CLAUDE.md with modular architecture and cache v25`
3. `chore: remove obsolete copilot-instructions.md`
4. `fix: catch journal save errors and add persistent offline banner`
5. `feat: add skeleton placeholders for journal lazy-load`

Après chaque commit, `npm test` doit passer. À la fin, `npm run lint` doit passer.

---

## Tests & vérification

- **Bloc 1** : CI tourne vert sur une branche de test (ou localement `npm run lint && npm test`)
- **Bloc 2** : relecture manuelle de `CLAUDE.md`
- **Bloc 3** : `ls .github/copilot-instructions.md` → `No such file`
- **Bloc 4** :
  - Test manuel : DevTools → Network → Offline → modifier un journal → observer toast + bannière
  - `grep -rn "_fbSet\|_fbPush\|_fbUpdate" js/ | grep -v catch` → aucune remontée pertinente
- **Bloc 5** : Test manuel : Network throttling "Slow 3G" → ouvrir l'onglet Journal → observer skeletons
- **Suite Vitest** : `npm test` (aucun nouveau test requis — modules purs inchangés)

---

## Hors scope (reporté)

- Item 4 (couverture tests +30 % via extraction `*-core`) — trop lourd pour ce batch
- Item 5 (finalisation d'un plan actif) — décision produit
- Item 8 (throttle serveur commentaires) — requiert revue sécurité Firebase Rules
- Items 9, 10, 11, 12 (fuites mémoire, cache Leaflet, validation visiteur, role=status toasts) — issues ponctuelles à traiter séparément

---

## Risques identifiés

- **ESLint peut remonter 50+ warnings sur la première passe** : prévoir un commit de cleanup annexe si nécessaire, mais NE PAS laisser le linter casser la CI sur un warning. Les règles choisies sont en `warn` (sauf `no-undef` / `semi`) pour éviter ce piège.
- **Bannière offline au-dessus du header** : peut masquer le logo en mode offline. Acceptable (l'utilisateur comprend que c'est temporaire), mais vérifier visuellement sur iPhone notch.
- **Skeleton trop court pour être vu** : en conditions rapides, le skeleton peut flasher < 50 ms. C'est OK — mieux vaut un flash qu'un écran blanc de 1-3 s en 3G.
