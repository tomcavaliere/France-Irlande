# Core Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract pure business logic from `journal.js`, `stages.js`, and `visitor-auth.js` into three new tested `-core.js` modules, raising test coverage from 205 to ~241 tests.

**Architecture:** Three new IIFE-wrapped pure modules (`journal-core.js`, `stages-core.js`, `visitor-auth-core.js`) following the existing pattern: `window.XxxCore` + `module.exports` double export, zero DOM, zero Firebase. Each module is loaded via `<script defer>` in `index.html` before its consumer, and covered by a Vitest test file.

**Tech Stack:** Vanilla JS (IIFE pattern), Vitest 2.x, ESLint 9 flat config, Node pure (no jsdom).

**Spec:** `docs/superpowers/specs/2026-04-20-core-extraction-design.md`

---

## File Map

| Action | Path |
|---|---|
| Create | `js/journal-core.js` |
| Create | `tests/journal-core.test.js` |
| Create | `js/stages-core.js` |
| Create | `tests/stages-core.test.js` |
| Create | `js/visitor-auth-core.js` |
| Create | `tests/visitor-auth-core.test.js` |
| Modify | `index.html` (3 new `<script defer>` tags after line 22) |
| Modify | `js/journal.js` (lines 111–112, 202–206) |
| Modify | `js/stages.js` (lines 22–23, 146–155) |
| Modify | `js/visitor-auth.js` (lines 35–38, 40–45, 173–196) |
| Modify | `CLAUDE.md` (3 new module sections, test count 6→9 files, 205→241) |

---

## Task 1 — `journal-core.js`

**Files:**
- Create: `js/journal-core.js`
- Create: `tests/journal-core.test.js`
- Modify: `index.html:22`
- Modify: `js/journal.js:111-112,202-206`

- [ ] **Step 1: Write the failing tests**

Create `tests/journal-core.test.js`:

```js
import { describe, it, expect } from 'vitest';
import JournalCore from '../js/journal-core.js';

const { countBravos, hasVoted, buildKmInfoLabel, formatJournalDateLabel } = JournalCore;

describe('countBravos', () => {
  it('retourne 0 pour null/undefined/objet vide', () => {
    expect(countBravos(null)).toBe(0);
    expect(countBravos(undefined)).toBe(0);
    expect(countBravos({})).toBe(0);
  });
  it('compte les clés', () => {
    expect(countBravos({ a: true, b: true })).toBe(2);
  });
});

describe('hasVoted', () => {
  it('retourne false si bravosData null/undefined', () => {
    expect(hasVoted(null, 'me')).toBe(false);
    expect(hasVoted(undefined, 'me')).toBe(false);
  });
  it('retourne false si visitorId absent', () => {
    expect(hasVoted({}, 'me')).toBe(false);
    expect(hasVoted({ other: true }, 'me')).toBe(false);
  });
  it('retourne true si visitorId présent', () => {
    expect(hasVoted({ me: true }, 'me')).toBe(true);
  });
});

describe('buildKmInfoLabel', () => {
  it('retourne "" si kmDay falsy ou stage null', () => {
    expect(buildKmInfoLabel({ kmDay: 0 })).toBe('');
    expect(buildKmInfoLabel({})).toBe('');
    expect(buildKmInfoLabel(null)).toBe('');
  });
  it('retourne le label km sans élévation', () => {
    expect(buildKmInfoLabel({ kmDay: 42 })).toBe('🚴 42 km');
  });
  it('inclut D+ si elevGain > 0 après clamp', () => {
    expect(buildKmInfoLabel({ kmDay: 42, elevGain: 300 })).toBe('🚴 42 km · ⛰️ D+ 300 m');
  });
  it('omet D+ si elevGain négatif (clamp → 0)', () => {
    expect(buildKmInfoLabel({ kmDay: 42, elevGain: -5 })).toBe('🚴 42 km');
  });
  it('arrondit kmDay', () => {
    expect(buildKmInfoLabel({ kmDay: 42.7 })).toBe('🚴 43 km');
  });
});

describe('formatJournalDateLabel', () => {
  it('contient le jour long et le mois long en fr-FR', () => {
    const label = formatJournalDateLabel('2026-04-20');
    expect(label).toContain('lundi');
    expect(label).toContain('avril');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- tests/journal-core.test.js
```

Expected: FAIL with `Cannot find module '../js/journal-core.js'`

- [ ] **Step 3: Create `js/journal-core.js`**

```js
(function(){
  function countBravos(bravosData){
    return Object.keys(bravosData||{}).length;
  }
  function hasVoted(bravosData,visitorId){
    return !!(bravosData&&bravosData[visitorId]);
  }
  function buildKmInfoLabel(stage){
    if(!stage||!stage.kmDay)return '';
    var elevGain=Math.max(0,Math.round(Number(stage.elevGain)||0));
    return '\uD83D\uDEB4 '+Math.round(stage.kmDay)+' km'+(elevGain?' \u00b7 \u26f0\ufe0f D+ '+elevGain+' m':'');
  }
  function formatJournalDateLabel(dateISO,locale){
    return new Date(dateISO+'T12:00:00').toLocaleDateString(locale||'fr-FR',{weekday:'long',day:'numeric',month:'long'});
  }
  var api={countBravos:countBravos,hasVoted:hasVoted,buildKmInfoLabel:buildKmInfoLabel,formatJournalDateLabel:formatJournalDateLabel};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.JournalCore=api;
})();
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- tests/journal-core.test.js
```

Expected: 12 tests PASS.

- [ ] **Step 5: Add `<script defer>` in `index.html` after line 22**

In `index.html`, after `<script defer src="js/events-core.js"></script>` (currently line 22), insert:

```html
<script defer src="js/journal-core.js"></script>
<script defer src="js/stages-core.js"></script>
<script defer src="js/visitor-auth-core.js"></script>
```

(All three new core scripts can be added at once here since none depends on the others.)

- [ ] **Step 6: Update `js/journal.js` — `patchBravos` (lines 111–112)**

Replace:
```js
  var count=Object.keys(bravosData).length;
  var voted=!!bravosData[getVisitorId()];
```
With:
```js
  var count=JournalCore.countBravos(bravosData);
  var voted=JournalCore.hasVoted(bravosData,getVisitorId());
```

- [ ] **Step 7: Update `js/journal.js` — `renderJournal` (lines 202–206)**

Replace:
```js
    var dateLabel=new Date(date+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
    var elevGain=Math.max(0,Math.round(Number(d.elevGain)||0));
    var kmInfo=d.kmDay
      ?'\uD83D\uDEB4 '+Math.round(d.kmDay)+' km'+(elevGain?' \u00b7 \u26f0\ufe0f D+ '+elevGain+' m':'')
      :'';
```
With:
```js
    var dateLabel=JournalCore.formatJournalDateLabel(date);
    var kmInfo=JournalCore.buildKmInfoLabel(d);
```

- [ ] **Step 8: Run full test suite + lint**

```bash
npm test && npm run lint
```

Expected: 217 tests PASS, 0 lint errors.

- [ ] **Step 9: Commit**

```bash
git add js/journal-core.js tests/journal-core.test.js index.html js/journal.js
git commit -m "refactor(journal): extract pure helpers to journal-core.js"
```

---

## Task 2 — `stages-core.js`

**Files:**
- Create: `js/stages-core.js`
- Create: `tests/stages-core.test.js`
- Modify: `js/stages.js:22-23,146-155`

(`index.html` already has the `<script defer src="js/stages-core.js">` tag added in Task 1.)

- [ ] **Step 1: Write the failing tests**

Create `tests/stages-core.test.js`:

```js
import { describe, it, expect } from 'vitest';
import StagesCore from '../js/stages-core.js';

const { countryFlag, formatStageDateLabel, computeRecapTotals } = StagesCore;

describe('countryFlag', () => {
  it('retourne 🇫🇷 si idx = 0 (bien en deçà de la frontière)', () => {
    expect(countryFlag(0, 1000)).toBe('🇫🇷');
  });
  it('retourne 🇫🇷 si idx === franceEndIdx (frontière incluse)', () => {
    expect(countryFlag(1000, 1000)).toBe('🇫🇷');
  });
  it('retourne 🇮🇪 si idx > franceEndIdx', () => {
    expect(countryFlag(1001, 1000)).toBe('🇮🇪');
  });
  it('retourne "" si idx négatif ou NaN', () => {
    expect(countryFlag(-1, 1000)).toBe('');
    expect(countryFlag(NaN, 1000)).toBe('');
  });
});

describe('formatStageDateLabel', () => {
  it('contient le jour abrégé et le mois abrégé en fr-FR', () => {
    const label = formatStageDateLabel('2026-04-20');
    expect(label).toContain('lun.');
    expect(label).toContain('avr.');
  });
});

describe('computeRecapTotals', () => {
  it('retourne pct=0 et avg=0 si kmDone=0 et nbDays=0', () => {
    expect(computeRecapTotals(0, 100, 0, 1000)).toEqual({ pct: 0, avgKmPerDay: 0 });
  });
  it('calcule pct et avgKmPerDay corrects', () => {
    expect(computeRecapTotals(500, 500, 10, 1000)).toEqual({ pct: 50, avgKmPerDay: 50 });
  });
  it('clamp pct à 100 si kmDone > totalKm', () => {
    expect(computeRecapTotals(1200, 0, 5, 1000)).toEqual({ pct: 100, avgKmPerDay: 240 });
  });
  it('arrondit pct (49.4 → 49)', () => {
    const r = computeRecapTotals(494, 0, 1, 1000);
    expect(r.pct).toBe(49);
  });
  it('protège la division par zéro (nbDays=0)', () => {
    const r = computeRecapTotals(500, 500, 0, 1000);
    expect(r.avgKmPerDay).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- tests/stages-core.test.js
```

Expected: FAIL with `Cannot find module '../js/stages-core.js'`

- [ ] **Step 3: Create `js/stages-core.js`**

```js
(function(){
  function countryFlag(idx,franceEndIdx){
    if(!isFinite(idx)||idx<0)return '';
    return idx<=franceEndIdx?'\uD83C\uDDEB\uD83C\uDDF7':'\uD83C\uDDEE\uD83C\uDDEA';
  }
  function formatStageDateLabel(dateISO){
    return new Date(dateISO+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
  }
  function computeRecapTotals(kmDone,kmLeft,nbDays,totalKm){
    var pct=Math.max(0,Math.min(100,Math.round((kmDone/totalKm)*100)));
    var avgKmPerDay=nbDays>0?Math.round(kmDone/nbDays):0;
    return {pct:pct,avgKmPerDay:avgKmPerDay};
  }
  var api={countryFlag:countryFlag,formatStageDateLabel:formatStageDateLabel,computeRecapTotals:computeRecapTotals};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.StagesCore=api;
})();
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- tests/stages-core.test.js
```

Expected: 10 tests PASS.

- [ ] **Step 5: Update `js/stages.js` — `renderStages` (lines 22–23)**

Replace:
```js
    var seg=d.lat&&d.lon?(snapToRoute(d.lat,d.lon).idx<=FRANCE_END_IDX?'🇫🇷':'🇮🇪'):'';
    var dateLabel=new Date(date+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
```
With:
```js
    var seg=d.lat&&d.lon?StagesCore.countryFlag(snapToRoute(d.lat,d.lon).idx,FRANCE_END_IDX):'';
    var dateLabel=StagesCore.formatStageDateLabel(date);
```

- [ ] **Step 6: Update `js/stages.js` — `updateRecap` (lines 142–154)**

Replace:
```js
  var kmD=GPSCore.sumTrackKm(tracks);
  var kmL=current?GPSCore.haversineKm(current.lat,current.lon,GPSCore.SLIGO_COORDS.lat,GPSCore.SLIGO_COORDS.lon):TOTAL_KM;
  var pct=Math.round((kmD/TOTAL_KM)*100);
  var nbDays=dates.length;
  var avg=nbDays>0?Math.round(kmD/nbDays):0;
  document.getElementById('rKmD').textContent=Math.round(kmD);
  document.getElementById('rKmL').textContent=Math.round(kmL);
  document.getElementById('rDays').textContent=nbDays;
  document.getElementById('rAvg').textContent=avg||'—';
  document.getElementById('rBar').style.width=Math.max(0,Math.min(100,pct))+'%';
```
With:
```js
  var kmD=GPSCore.sumTrackKm(tracks);
  var kmL=current?GPSCore.haversineKm(current.lat,current.lon,GPSCore.SLIGO_COORDS.lat,GPSCore.SLIGO_COORDS.lon):TOTAL_KM;
  var nbDays=dates.length;
  var totals=StagesCore.computeRecapTotals(kmD,kmL,nbDays,TOTAL_KM);
  document.getElementById('rKmD').textContent=Math.round(kmD);
  document.getElementById('rKmL').textContent=Math.round(kmL);
  document.getElementById('rDays').textContent=nbDays;
  document.getElementById('rAvg').textContent=totals.avgKmPerDay||'—';
  document.getElementById('rBar').style.width=totals.pct+'%';
```

- [ ] **Step 7: Run full test suite + lint**

```bash
npm test && npm run lint
```

Expected: 227 tests PASS, 0 lint errors.

- [ ] **Step 8: Commit**

```bash
git add js/stages-core.js tests/stages-core.test.js js/stages.js
git commit -m "refactor(stages): extract pure helpers to stages-core.js"
```

---

## Task 3 — `visitor-auth-core.js`

**Files:**
- Create: `js/visitor-auth-core.js`
- Create: `tests/visitor-auth-core.test.js`
- Modify: `js/visitor-auth.js:35-38,40-45,173-196`

(`index.html` already has the `<script defer src="js/visitor-auth-core.js">` tag added in Task 1, placed before `visitor-auth.js`.)

- [ ] **Step 1: Write the failing tests**

Create `tests/visitor-auth-core.test.js`:

```js
import { describe, it, expect } from 'vitest';
import VisitorAuthCore from '../js/visitor-auth-core.js';

const { normalizeHash, extractPasswordHash, validatePasswordChange } = VisitorAuthCore;

// 64-character valid hex string used throughout
const VALID = 'a'.repeat(64);

describe('normalizeHash', () => {
  it('accepte un hash 64 hex lowercase et le retourne tel quel', () => {
    expect(normalizeHash(VALID)).toBe(VALID);
  });
  it('normalise en lowercase', () => {
    expect(normalizeHash('A'.repeat(64))).toBe(VALID);
  });
  it('trim les espaces avant validation', () => {
    expect(normalizeHash(' ' + VALID + ' ')).toBe(VALID);
  });
  it('retourne "" pour une longueur incorrecte (63 ou 65 chars)', () => {
    expect(normalizeHash('a'.repeat(63))).toBe('');
    expect(normalizeHash('a'.repeat(65))).toBe('');
  });
  it('retourne "" si le hash contient un caractère non-hex ("g")', () => {
    expect(normalizeHash('g' + 'a'.repeat(63))).toBe('');
  });
  it('retourne "" pour null, undefined, number, object', () => {
    expect(normalizeHash(null)).toBe('');
    expect(normalizeHash(undefined)).toBe('');
    expect(normalizeHash(42)).toBe('');
    expect(normalizeHash({})).toBe('');
  });
});

describe('extractPasswordHash', () => {
  it('retourne "" pour null ou undefined', () => {
    expect(extractPasswordHash(null)).toBe('');
    expect(extractPasswordHash(undefined)).toBe('');
  });
  it('retourne le hash normalisé pour une string valide', () => {
    expect(extractPasswordHash(VALID)).toBe(VALID);
  });
  it('retourne le hash normalisé pour un objet avec passwordHash valide', () => {
    expect(extractPasswordHash({ passwordHash: VALID })).toBe(VALID);
    expect(extractPasswordHash({ passwordHash: 'A'.repeat(64) })).toBe(VALID);
  });
  it('retourne "" pour un objet avec passwordHash invalide ou absent', () => {
    expect(extractPasswordHash({ passwordHash: 'bad' })).toBe('');
    expect(extractPasswordHash({})).toBe('');
  });
});

describe('validatePasswordChange', () => {
  const opts = { min: 6, max: 128 };

  it('retourne {ok:true} pour un mot de passe valide', () => {
    expect(validatePasswordChange('abcdef', 'abcdef', opts)).toEqual({ ok: true });
  });
  it('retourne {ok:false} avec message "trop court" si longueur < min', () => {
    const r = validatePasswordChange('abc', 'abc', opts);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('trop court');
    expect(r.error).toContain('6');
  });
  it('retourne {ok:false} avec message "trop long" si longueur > max', () => {
    const r = validatePasswordChange('a'.repeat(129), 'a'.repeat(129), opts);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('trop long');
    expect(r.error).toContain('128');
  });
  it('retourne {ok:false} avec message "ne correspondent pas" si passwords différents', () => {
    const r = validatePasswordChange('abcdef', 'abcdeg', opts);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('ne correspondent pas');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- tests/visitor-auth-core.test.js
```

Expected: FAIL with `Cannot find module '../js/visitor-auth-core.js'`

- [ ] **Step 3: Create `js/visitor-auth-core.js`**

```js
(function(){
  function normalizeHash(v){
    var s=(typeof v==='string')?v.trim().toLowerCase():'';
    return /^[a-f0-9]{64}$/.test(s)?s:'';
  }
  function extractPasswordHash(cfg){
    if(!cfg)return '';
    if(typeof cfg==='string')return normalizeHash(cfg);
    if(typeof cfg==='object')return normalizeHash(cfg.passwordHash);
    return '';
  }
  function validatePasswordChange(password,confirm,opts){
    if(password.length<opts.min)return {ok:false,error:'Mot de passe trop court (min. '+opts.min+' caractères).'};
    if(password.length>opts.max)return {ok:false,error:'Mot de passe trop long (max. '+opts.max+' caractères).'};
    if(password!==confirm)return {ok:false,error:'Les deux mots de passe ne correspondent pas.'};
    return {ok:true};
  }
  var api={normalizeHash:normalizeHash,extractPasswordHash:extractPasswordHash,validatePasswordChange:validatePasswordChange};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.VisitorAuthCore=api;
})();
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- tests/visitor-auth-core.test.js
```

Expected: 14 tests PASS.

- [ ] **Step 5: Update `js/visitor-auth.js` — replace `_normalizeHash` body (lines 35–38)**

Replace:
```js
function _normalizeHash(v){
  var s=(typeof v==='string')?v.trim().toLowerCase():'';
  return /^[a-f0-9]{64}$/.test(s)?s:'';
}
```
With:
```js
function _normalizeHash(v){
  return VisitorAuthCore.normalizeHash(v);
}
```

- [ ] **Step 6: Update `js/visitor-auth.js` — replace `_extractVisitorPasswordHash` body (lines 40–45)**

Replace:
```js
function _extractVisitorPasswordHash(cfg){
  if(!cfg)return '';
  if(typeof cfg==='string')return _normalizeHash(cfg);
  if(typeof cfg==='object')return _normalizeHash(cfg.passwordHash);
  return '';
}
```
With:
```js
function _extractVisitorPasswordHash(cfg){
  return VisitorAuthCore.extractPasswordHash(cfg);
}
```

- [ ] **Step 7: Update `js/visitor-auth.js` — replace 3-branch validation in `updateVisitorPassword` (lines 173–196)**

Replace:
```js
  if(password.length<MIN_VISITOR_PASSWORD_LENGTH){
    if(errEl){
      errEl.textContent='Mot de passe trop court (min. '+MIN_VISITOR_PASSWORD_LENGTH+' caractères).';
      errEl.style.display='block';
    }
    if(pwEl)pwEl.focus();
    return;
  }
  if(password.length>MAX_VISITOR_PASSWORD_LENGTH){
    if(errEl){
      errEl.textContent='Mot de passe trop long (max. '+MAX_VISITOR_PASSWORD_LENGTH+' caractères).';
      errEl.style.display='block';
    }
    if(pwEl)pwEl.focus();
    return;
  }
  if(password!==passwordConfirm){
    if(errEl){
      errEl.textContent='Les deux mots de passe ne correspondent pas.';
      errEl.style.display='block';
    }
    if(confirmEl)confirmEl.focus();
    return;
  }
```
With:
```js
  var validation=VisitorAuthCore.validatePasswordChange(password,passwordConfirm,{min:MIN_VISITOR_PASSWORD_LENGTH,max:MAX_VISITOR_PASSWORD_LENGTH});
  if(!validation.ok){
    if(errEl){errEl.textContent=validation.error;errEl.style.display='block';}
    if(validation.error.indexOf('correspondent pas')!==-1){if(confirmEl)confirmEl.focus();}
    else{if(pwEl)pwEl.focus();}
    return;
  }
```

- [ ] **Step 8: Run full test suite + lint**

```bash
npm test && npm run lint
```

Expected: 241 tests PASS, 0 lint errors.

- [ ] **Step 9: Commit**

```bash
git add js/visitor-auth-core.js tests/visitor-auth-core.test.js js/visitor-auth.js
git commit -m "refactor(visitor-auth): extract validation to visitor-auth-core.js"
```

---

## Task 4 — CLAUDE.md documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add three new module sections under "Modules purs (testés)"**

In `CLAUDE.md`, after the `### js/events-core.js` section, add:

```markdown
### `js/journal-core.js` → `window.JournalCore`

| Fonction | Rôle |
|---|---|
| `countBravos(bravosData)` | `Object.keys(data\|\|{}).length` — nombre de bravos pour une date |
| `hasVoted(bravosData, visitorId)` | `true` si l'identifiant visiteur figure dans les bravos |
| `buildKmInfoLabel(stage)` | `"🚴 42 km · ⛰️ D+ 300 m"` ou `""` si `kmDay` falsy ; `elevGain` clampé à 0 |
| `formatJournalDateLabel(dateISO, locale?)` | `"2026-04-20"` → `"lundi 20 avril"` (fr-FR par défaut, convention `T12:00:00`) |

### `js/stages-core.js` → `window.StagesCore`

| Fonction | Rôle |
|---|---|
| `countryFlag(idx, franceEndIdx)` | `idx <= franceEndIdx` → 🇫🇷 ; sinon 🇮🇪 ; idx non-fini ou négatif → `''` |
| `formatStageDateLabel(dateISO)` | `"2026-04-20"` → `"lun. 20 avr."` (fr-FR, convention `T12:00:00`) |
| `computeRecapTotals(kmDone, kmLeft, nbDays, totalKm)` | `{pct, avgKmPerDay}` — pct clampé 0–100, division par zéro protégée |

### `js/visitor-auth-core.js` → `window.VisitorAuthCore`

| Fonction | Rôle |
|---|---|
| `normalizeHash(v)` | `trim().toLowerCase()` + regex `/^[a-f0-9]{64}$/` ; sinon `''` |
| `extractPasswordHash(cfg)` | string → `normalizeHash(cfg)` ; objet → `normalizeHash(cfg.passwordHash)` ; autre → `''` |
| `validatePasswordChange(password, confirm, opts)` | `{ok:true}` ou `{ok:false, error}` — vérifie min/max/match dans cet ordre |
```

- [ ] **Step 2: Update the test file listing (6 → 9 files, 205 → ~241 tests)**

In `CLAUDE.md`, update the `tests/` section to add the three new test files:

```
  journal-core.test.js      — 12 tests Vitest
  stages-core.test.js       — 10 tests Vitest
  visitor-auth-core.test.js — 14 tests Vitest
```

And update any reference to the total test count from `205` to `~241`.

- [ ] **Step 3: Run tests + lint one last time**

```bash
npm test && npm run lint
```

Expected: 241 tests PASS, 0 lint errors.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document new core modules in CLAUDE.md"
```

---

## Verification Checklist

After all 4 commits:

- [ ] `npm test` : 241 tests PASS
- [ ] `npm run lint` : 0 erreurs
- [ ] Chargement `index.html` : aucune erreur console
- [ ] Test manuel : soumission mauvais mot de passe visiteur → bon message d'erreur affiché
- [ ] Test manuel : carte étapes → flag pays + date abrégée + km affichés correctement
- [ ] Test manuel : compteur bravos journal → compte correct après clic
