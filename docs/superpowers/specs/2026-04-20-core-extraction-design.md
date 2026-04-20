# Extraction métier — `journal-core`, `stages-core`, `visitor-auth-core`

**Date :** 2026-04-20
**Contexte :** Item #4 du rapport d'audit (`/Users/tomcavaliere/.claude/plans/analyse-les-faiblesses-de-curried-gem.md`).
Les modules `journal.js`, `stages.js` et `visitor-auth.js` contiennent des bouts de métier pur (validations, calculs, formatage) noyés dans le code DOM/Firebase. Ce spec extrait ces helpers vers trois nouveaux modules purs `-core.js` testés, dans la lignée des 6 modules purs existants (`gps-core`, `utils`, `campings-core`, `weather-core`, `offline-core`, `events-core`).

## Objectif

- Couverture tests : 205 → ~241 tests (+36, +15 % relatif)
- Rendre la validation de mot de passe visiteur, le comptage de bravos, les libellés de km/date et les stats de recap **testables sans DOM ni Firebase**
- Préserver le comportement : aucune modification fonctionnelle attendue, zéro changement UI

## Architecture

Même pattern que les modules purs existants :

```js
// js/<name>-core.js
(function(){
  function fnA(...) { ... }
  function fnB(...) { ... }
  var API = { fnA: fnA, fnB: fnB };
  if (typeof window !== 'undefined') window.XxxCore = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
```

- Chargé via `<script>` dans `index.html` **avant** les modules consommateurs
- `sourceType: 'script'` (couvert par la flat config ESLint existante)
- Zéro dépendance DOM, zéro accès `window._fbDb`, zéro `localStorage`
- Tolérance aux entrées `null`/`undefined` (valeur par défaut, pas de throw)

## Modules

### 1. `js/journal-core.js` → `window.JournalCore`

| Fonction | Signature | Rôle |
|---|---|---|
| `countBravos(bravosData)` | `(obj\|null) → number` | `Object.keys(data\|\|{}).length` |
| `hasVoted(bravosData, visitorId)` | `(obj\|null, string) → bool` | `!!(data && data[vid])` |
| `buildKmInfoLabel(stage)` | `({kmDay, elevGain}) → string` | `"🚴 42 km · ⛰️ D+ 300 m"` ; `""` si `kmDay` falsy ; `elevGain` clampé à `Math.max(0, round(x))` ; omission de la partie `· ⛰️ D+` si clamp donne 0 |
| `formatJournalDateLabel(dateISO, locale?)` | `(string, string?) → string` | `"2026-04-20"` → `"lundi 20 avril"` (fr-FR par défaut). Convention `T12:00:00` pour éviter les dérives timezone |

**Consommateurs mis à jour :**
- [journal.js:111](../../js/journal.js#L111) — `patchBravos` : `count = JournalCore.countBravos(bravosData)`
- [journal.js:112](../../js/journal.js#L112) — `voted = JournalCore.hasVoted(bravosData, getVisitorId())`
- [journal.js:202-206](../../js/journal.js#L202-L206) — `renderJournal` : `dateLabel`/`kmInfo` utilisent les helpers

### 2. `js/stages-core.js` → `window.StagesCore`

| Fonction | Signature | Rôle |
|---|---|---|
| `countryFlag(idx, franceEndIdx)` | `(number, number) → '🇫🇷'\|'🇮🇪'\|''` | `idx <= franceEndIdx` → 🇫🇷 ; sinon 🇮🇪 ; `idx` non-fini ou négatif → `''` |
| `formatStageDateLabel(dateISO)` | `(string) → string` | `"2026-04-20"` → `"lun. 20 avr."` (fr-FR). Convention `T12:00:00` |
| `computeRecapTotals(kmDone, kmLeft, nbDays, totalKm)` | `(number×4) → {pct, avgKmPerDay}` | `pct = clamp(round(kmDone/totalKm*100), 0, 100)` ; `avgKmPerDay = nbDays > 0 ? round(kmDone/nbDays) : 0` |

**Consommateurs :**
- [stages.js:22](../../js/stages.js#L22) — `seg` utilise `countryFlag` au lieu du ternaire inline
- [stages.js:23](../../js/stages.js#L23) — `dateLabel = StagesCore.formatStageDateLabel(date)`
- [stages.js:146-148](../../js/stages.js#L146-L148) — `updateRecap` utilise `computeRecapTotals` pour `pct`/`avg`

### 3. `js/visitor-auth-core.js` → `window.VisitorAuthCore`

| Fonction | Signature | Rôle |
|---|---|---|
| `normalizeHash(v)` | `(any) → string` | `trim().toLowerCase()` + regex `/^[a-f0-9]{64}$/`, sinon `''` |
| `extractPasswordHash(cfg)` | `(any) → string` | `cfg` string → `normalizeHash(cfg)` ; `cfg` objet → `normalizeHash(cfg.passwordHash)` ; autre → `''` |
| `validatePasswordChange(password, confirm, opts)` | `(string, string, {min, max}) → {ok, error?}` | Retourne `{ok: false, error}` si `password.length < min`, `> max`, ou `password !== confirm` ; sinon `{ok: true}`. Les messages d'erreur reprennent textuellement ceux de l'actuel `updateVisitorPassword` |

**Consommateurs :**
- [visitor-auth.js:35-38](../../js/visitor-auth.js#L35-L38) — `_normalizeHash` remplacé par `VisitorAuthCore.normalizeHash`
- [visitor-auth.js:40-45](../../js/visitor-auth.js#L40-L45) — `_extractVisitorPasswordHash` remplacé par `VisitorAuthCore.extractPasswordHash`
- [visitor-auth.js:173-196](../../js/visitor-auth.js#L173-L196) — les 3 branches de validation (`< min`, `> max`, mismatch) remplacées par un seul appel `VisitorAuthCore.validatePasswordChange(password, passwordConfirm, {min: MIN_VISITOR_PASSWORD_LENGTH, max: MAX_VISITOR_PASSWORD_LENGTH})` ; rendu de l'erreur inchangé (pipe vers `errEl.textContent`)

## Tests

Convention : fichier `tests/<name>-core.test.js`, double import compatible (`import` en tête — Vitest, le module expose `module.exports`).

### `tests/journal-core.test.js` (~12 tests)

- `countBravos` : `null` / `undefined` / `{}` → 0 ; `{a:true, b:true}` → 2
- `hasVoted` : `null` / `{}` / `{"other":true}` → `false` ; `{"me":true}` → `true`
- `buildKmInfoLabel` : `{kmDay: 0}` → `""` ; `{kmDay: 42}` → `"🚴 42 km"` ; `{kmDay: 42, elevGain: 300}` → `"🚴 42 km · ⛰️ D+ 300 m"` ; `{kmDay: 42, elevGain: -5}` → `"🚴 42 km"` (clamp + omission) ; arrondi `{kmDay: 42.7}` → `"🚴 43 km"`
- `formatJournalDateLabel` : `"2026-04-20"` contient `"lundi"` et `"avril"` (fr-FR)

### `tests/stages-core.test.js` (~10 tests)

- `countryFlag` : `(0, 1000)` → 🇫🇷 ; `(1000, 1000)` → 🇫🇷 (frontière incluse) ; `(1001, 1000)` → 🇮🇪 ; `(-1, 1000)` / `(NaN, 1000)` → `""`
- `formatStageDateLabel` : `"2026-04-20"` contient `"lun."` et `"avr."`
- `computeRecapTotals` : `(0, 100, 0, 1000)` → `{pct: 0, avgKmPerDay: 0}` ; `(500, 500, 10, 1000)` → `{pct: 50, avgKmPerDay: 50}` ; `(1200, 0, 5, 1000)` → `{pct: 100, avgKmPerDay: 240}` (clamp) ; arrondis 49.4 → 49 ; `nbDays=0` protégé contre division

### `tests/visitor-auth-core.test.js` (~14 tests)

- `normalizeHash` : 64-hex lower → renvoyé ; 64-hex MAJ → lowercased ; avec espaces → trim + lower ; 63 chars → `""` ; 65 chars → `""` ; contient `"g"` → `""` ; `null` / `undefined` / `42` / `{}` → `""`
- `extractPasswordHash` : `null` / `undefined` → `""` ; string hash valide → renvoyé normalisé ; `{passwordHash: "VALID_HASH"}` → renvoyé normalisé ; `{passwordHash: "bad"}` → `""` ; `{}` → `""`
- `validatePasswordChange` : `("abcdef", "abcdef", {min:6, max:128})` → `{ok: true}` ; `("abc", "abc", {min:6, max:128})` → `{ok: false, error: /trop court/}` ; `("a".repeat(129), "a".repeat(129), {min:6, max:128})` → `{ok: false, error: /trop long/}` ; `("abcdef", "abcdeg", {min:6, max:128})` → `{ok: false, error: /ne correspondent pas/}`

**Cible globale :** 205 → ~241 tests. `npm test` doit rester vert après chaque commit.

## Ordre des commits (atomiques, Conventional Commits anglais)

1. **`refactor(journal): extract pure helpers to journal-core.js`**
   - Crée `js/journal-core.js` + `tests/journal-core.test.js`
   - Ajoute `<script src="js/journal-core.js">` dans `index.html` **avant** `journal.js`
   - Met à jour `journal.js` pour appeler `JournalCore.*`
   - `npm test` + `npm run lint` verts

2. **`refactor(stages): extract pure helpers to stages-core.js`**
   - Idem pour stages

3. **`refactor(visitor-auth): extract validation to visitor-auth-core.js`**
   - Idem pour visitor-auth
   - Bonus : réduit 3 blocs de 8 lignes à 1 appel dans `updateVisitorPassword`

4. **`docs: document new core modules in CLAUDE.md`**
   - Ajoute les 3 sections sous "Modules purs (testés)"
   - Met à jour le listing des tests (6 → 9 fichiers, ~205 → ~241 tests)

## Edge cases / error handling

- Toutes les fonctions tolèrent `null` / `undefined` en entrée (valeur par défaut, pas de throw)
- Dates : convention `dateISO + 'T12:00:00'` avant `new Date()` pour éviter les dérives timezone (pattern déjà présent dans le code)
- `computeRecapTotals` : division par 0 protégée ; pct clampé via `Math.max(0, Math.min(100, ...))`
- `normalizeHash` : strict regex `/^[a-f0-9]{64}$/` après `trim().toLowerCase()`
- `validatePasswordChange` : vérifie `min`/`max`/`match` dans cet ordre (cohérent avec l'ordre actuel dans `visitor-auth.js`)

## Non-objectifs (YAGNI)

- **Pas d'extraction de builders HTML** (décision : tests string-matching trop fragiles ; le vrai métier se limite aux labels/données)
- **Pas d'extraction de `getVisitorId`** : mêle `localStorage` + `crypto.randomUUID`, 3 lignes, faible gain
- **Pas de refonte des wrappers `index.html`** : `journal.js`/`stages.js`/`visitor-auth.js` sont déjà des fichiers standalone qui appellent `Utils.xxx` directement — ce pattern est conservé
- **Pas de modification fonctionnelle** : zéro changement de comportement UI ou de contrat Firebase

## Vérification

Après chaque commit :
- `npm test` passe (205 → 217 → 227 → 241)
- `npm run lint` : 0 erreurs
- Chargement `index.html` : aucune erreur console
- Test manuel léger : soumission mauvais mot de passe visiteur affiche toujours le bon message ; carte étape affiche toujours flag + date + km ; compteur bravos toujours correct
