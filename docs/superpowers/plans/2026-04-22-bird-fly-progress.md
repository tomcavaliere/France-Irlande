# Progression vol d'oiseau Annecy → Sligo — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la progression hybride (GPX réels / haversine) par une formule unique vol d'oiseau Annecy → Sligo, supprimer l'icône vélo de la barre, et éliminer les km fantômes des étapes sans GPX.

**Architecture:** Nouvelle fonction pure `computeCrowfliesProgress(lat, lon)` dans `js/gps-core.js` (testée Vitest). `recomputeAllKm` modifié pour retourner `kmDay = 0` sans GPX. UI `updateMap` / `updateRecap` réécrites pour consommer ces valeurs, DOM et CSS simplifiés.

**Tech Stack:** Vanilla JS (ES5), Vitest (Node pur, pas de jsdom), Leaflet 1.9.4, Firebase RTDB.

**Spec:** [`docs/superpowers/specs/2026-04-22-bird-fly-progress-design.md`](../specs/2026-04-22-bird-fly-progress-design.md)

---

## Task 1 : `ANNECY_COORDS` + `computeCrowfliesProgress` (pure)

**Files:**
- Modify: `js/gps-core.js`
- Test: `tests/gps-core.test.js`

- [ ] **Step 1.1 : Écrire le test pour `ANNECY_COORDS`**

Ajouter à la fin de `tests/gps-core.test.js`, juste avant la dernière accolade fermante (après le bloc `describe('recomputeAllKm', ...)`) :

```javascript
// =====================================================================
// computeCrowfliesProgress
// =====================================================================
describe('computeCrowfliesProgress', () => {
  const { computeCrowfliesProgress, ANNECY_COORDS, SLIGO_COORDS } = gpsCore;

  it('ANNECY_COORDS exporté avec lat/lon finis', () => {
    expect(ANNECY_COORDS).toBeTruthy();
    expect(Number.isFinite(ANNECY_COORDS.lat)).toBe(true);
    expect(Number.isFinite(ANNECY_COORDS.lon)).toBe(true);
    expect(ANNECY_COORDS.lat).toBeCloseTo(45.8992, 3);
    expect(ANNECY_COORDS.lon).toBeCloseTo(6.1294, 3);
  });
});
```

- [ ] **Step 1.2 : Vérifier l'échec**

```bash
npm test -- --run tests/gps-core.test.js
```

Attendu : échec sur `ANNECY_COORDS` (undefined ou non exporté).

- [ ] **Step 1.3 : Ajouter la constante et l'exporter**

Dans `js/gps-core.js`, juste après la ligne `var SLIGO_COORDS = { lat: 54.2775, lon: -8.4714 };` (ligne 9), ajouter :

```javascript
  // Coordonnées du point de départ (Annecy), utilisées pour la progression
  // vol d'oiseau Annecy → Sligo.
  var ANNECY_COORDS = { lat: 45.8992, lon: 6.1294 };
```

Dans l'objet `api` en fin de fichier (autour ligne 270), ajouter `ANNECY_COORDS: ANNECY_COORDS` à côté de `SLIGO_COORDS`.

- [ ] **Step 1.4 : Vérifier que le test passe**

```bash
npm test -- --run tests/gps-core.test.js
```

Attendu : `ANNECY_COORDS exporté` passe.

- [ ] **Step 1.5 : Écrire les tests pour `computeCrowfliesProgress`**

Dans le même bloc `describe('computeCrowfliesProgress', ...)` ajouté à l'étape 1.1, ajouter à la suite :

```javascript
  it('position = Annecy → pct ≈ 0', () => {
    const r = computeCrowfliesProgress(ANNECY_COORDS.lat, ANNECY_COORDS.lon);
    expect(r.pct).toBeCloseTo(0, 0);
    expect(r.kmFromStart).toBeLessThan(0.1);
    expect(r.kmTotalCrow).toBeGreaterThan(0);
  });

  it('position = Sligo → pct === 100', () => {
    const r = computeCrowfliesProgress(SLIGO_COORDS.lat, SLIGO_COORDS.lon);
    expect(r.pct).toBe(100);
    expect(r.kmRemaining).toBeLessThan(0.1);
  });

  it('position intermédiaire (Cork) → 0 < pct < 100 et somme ≈ kmTotalCrow', () => {
    const r = computeCrowfliesProgress(51.90, -8.47);
    expect(r.pct).toBeGreaterThan(0);
    expect(r.pct).toBeLessThan(100);
    expect(r.kmFromStart + r.kmRemaining).toBeCloseTo(r.kmTotalCrow, 0);
  });

  it('position au-delà de Sligo → pct clampé à 100, kmRemaining = 0', () => {
    const r = computeCrowfliesProgress(60, -20);
    expect(r.pct).toBe(100);
    expect(r.kmRemaining).toBe(0);
  });

  it('entrées invalides → défaut (pct 0, kmFromStart 0, kmRemaining = kmTotalCrow)', () => {
    const cases = [
      [NaN, NaN],
      [null, null],
      ['a', 'b'],
      [undefined, 0]
    ];
    cases.forEach(([lat, lon]) => {
      const r = computeCrowfliesProgress(lat, lon);
      expect(r.pct).toBe(0);
      expect(r.kmFromStart).toBe(0);
      expect(r.kmRemaining).toBe(r.kmTotalCrow);
    });
  });

  it('kmTotalCrow > 0 et stable entre appels', () => {
    const r1 = computeCrowfliesProgress(0, 0);
    const r2 = computeCrowfliesProgress(50, 5);
    expect(r1.kmTotalCrow).toBeGreaterThan(0);
    expect(r1.kmTotalCrow).toBe(r2.kmTotalCrow);
  });
```

- [ ] **Step 1.6 : Vérifier l'échec**

```bash
npm test -- --run tests/gps-core.test.js
```

Attendu : les 6 nouveaux tests échouent (fonction non définie).

- [ ] **Step 1.7 : Implémenter `computeCrowfliesProgress`**

Dans `js/gps-core.js`, ajouter après la fonction `haversineKm` (après la ligne 124) :

```javascript
  // Distance vol d'oiseau Annecy → Sligo, calculée une fois et mise en cache.
  var _kmTotalCrowCache = null;
  function _kmTotalCrow(){
    if (_kmTotalCrowCache === null){
      _kmTotalCrowCache = haversineKm(
        ANNECY_COORDS.lat, ANNECY_COORDS.lon,
        SLIGO_COORDS.lat, SLIGO_COORDS.lon
      );
    }
    return _kmTotalCrowCache;
  }

  // Progression vol d'oiseau entre Annecy et Sligo.
  // @param {number} lat @param {number} lon
  // @returns {{ pct:number, kmFromStart:number, kmRemaining:number, kmTotalCrow:number }}
  function computeCrowfliesProgress(lat, lon){
    var kmTotalCrow = _kmTotalCrow();
    var nlat = Number(lat), nlon = Number(lon);
    if (!isFinite(nlat) || !isFinite(nlon)){
      return { pct: 0, kmFromStart: 0, kmRemaining: kmTotalCrow, kmTotalCrow: kmTotalCrow };
    }
    var kmFromStart = Math.max(0, haversineKm(ANNECY_COORDS.lat, ANNECY_COORDS.lon, nlat, nlon));
    var kmRemaining = Math.max(0, kmTotalCrow - kmFromStart);
    var rawPct = kmTotalCrow > 0 ? (kmFromStart / kmTotalCrow) * 100 : 0;
    var pct = Math.max(0, Math.min(100, Math.round(rawPct * 10) / 10));
    return { pct: pct, kmFromStart: kmFromStart, kmRemaining: kmRemaining, kmTotalCrow: kmTotalCrow };
  }
```

Ajouter à l'objet `api` : `computeCrowfliesProgress: computeCrowfliesProgress`.

- [ ] **Step 1.8 : Vérifier que tous les tests passent**

```bash
npm test -- --run tests/gps-core.test.js
```

Attendu : tous les tests `computeCrowfliesProgress` passent.

- [ ] **Step 1.9 : Commit**

```bash
git add js/gps-core.js tests/gps-core.test.js
git commit -m "feat(gps-core): add computeCrowfliesProgress and ANNECY_COORDS"
```

---

## Task 2 : `recomputeAllKm` — `kmDay = 0` sans GPX

**Files:**
- Modify: `js/gps-core.js:233-243`
- Test: `tests/gps-core.test.js:347-406`

- [ ] **Step 2.1 : Remplacer les 3 tests existants obsolètes**

Dans `tests/gps-core.test.js`, remplacer :

- Le test `'3 étapes sans GPX : km croissants et cohérents avec snapToRoute'` (lignes ~347-365)
- Le test `'suppression GPX → retour aux km snappés'` (lignes ~389-406)

Par les 2 tests suivants (le reste du bloc `describe('recomputeAllKm', ...)` reste inchangé) :

```javascript
  it('3 étapes sans GPX : kmDay = 0 pour toutes, kmTotal n\'accumule pas', () => {
    const stages = {
      '2026-07-01': { lat: pt0[0], lon: pt0[1], kmTotal: 0, kmDay: 0 },
      '2026-07-02': { lat: pt5[0], lon: pt5[1], kmTotal: 0, kmDay: 0 },
      '2026-07-03': { lat: pt10[0], lon: pt10[1], kmTotal: 0, kmDay: 0 }
    };
    const { stageUpdates, currentKmTotal } = recomputeAllKm(stages, {}, ROUTE_PTS, CUM_KM);

    expect(stageUpdates['2026-07-01'].kmDay).toBe(0);
    expect(stageUpdates['2026-07-02'].kmDay).toBe(0);
    expect(stageUpdates['2026-07-03'].kmDay).toBe(0);
    expect(stageUpdates['2026-07-01'].kmTotal).toBe(0);
    expect(stageUpdates['2026-07-02'].kmTotal).toBe(0);
    expect(stageUpdates['2026-07-03'].kmTotal).toBe(0);
    expect(currentKmTotal).toBe(0);
  });

  it('suppression GPX → kmDay retombe à 0 (plus de fallback snap)', () => {
    const stages = {
      '2026-07-01': { lat: pt0[0], lon: pt0[1], kmTotal: 0, kmDay: 0 },
      '2026-07-02': { lat: pt5[0], lon: pt5[1], kmTotal: 100, kmDay: 100 }
    };
    // Avec GPX
    const tracksAvec = { '2026-07-02': { kmDay: 75, elevGain: 500, coords: [], ts: 1 } };
    const avecGPX = recomputeAllKm(stages, tracksAvec, ROUTE_PTS, CUM_KM);
    expect(avecGPX.stageUpdates['2026-07-02'].kmDay).toBe(75);

    // Sans GPX (suppression) : kmDay = 0, pas de fallback snap
    const sansTracks = recomputeAllKm(stages, {}, ROUTE_PTS, CUM_KM);
    expect(sansTracks.stageUpdates['2026-07-02'].kmDay).toBe(0);
    expect(sansTracks.stageUpdates['2026-07-02'].kmTotal).toBe(0);
    expect(sansTracks.stageUpdates['2026-07-02'].elevGain).toBe(0);
  });

  it('étape avec GPX suivie d\'une étape sans GPX : kmTotal reste au niveau du GPX', () => {
    const stages = {
      '2026-07-01': { lat: pt0[0], lon: pt0[1], kmTotal: 0, kmDay: 0 },
      '2026-07-02': { lat: pt5[0], lon: pt5[1], kmTotal: 0, kmDay: 0 },
      '2026-07-03': { lat: pt10[0], lon: pt10[1], kmTotal: 0, kmDay: 0 }
    };
    const tracks = {
      '2026-07-01': { kmDay: 40, elevGain: 300, coords: [], ts: 1 }
    };
    const { stageUpdates } = recomputeAllKm(stages, tracks, ROUTE_PTS, CUM_KM);
    expect(stageUpdates['2026-07-01'].kmTotal).toBe(40);
    expect(stageUpdates['2026-07-02'].kmDay).toBe(0);
    expect(stageUpdates['2026-07-02'].kmTotal).toBe(40); // inchangé
    expect(stageUpdates['2026-07-03'].kmDay).toBe(0);
    expect(stageUpdates['2026-07-03'].kmTotal).toBe(40); // inchangé
  });
```

Note : le test `'3 étapes avec GPX sur la 2e'` (vers ligne 367) est conservé tel quel — son GPX en étape 2 reste le comportement attendu, et son assertion `kmDay(3) > GPX(2)` devient fausse. Modifier uniquement son assertion finale :

Dans ce même test `'3 étapes avec GPX sur la 2e'`, remplacer :
```javascript
    // Étape 3 se base sur le kmTotal cumulé depuis GPX
    expect(stageUpdates['2026-07-03'].kmTotal).toBeGreaterThan(50);
```
par :
```javascript
    // Étape 3 sans GPX : kmDay=0, kmTotal reste = kmTotal étape 2 (GPX)
    expect(stageUpdates['2026-07-03'].kmDay).toBe(0);
    expect(stageUpdates['2026-07-03'].kmTotal).toBe(stageUpdates['2026-07-02'].kmTotal);
```

- [ ] **Step 2.2 : Vérifier l'échec**

```bash
npm test -- --run tests/gps-core.test.js
```

Attendu : les 3 nouveaux tests échouent (l'implémentation retourne toujours le fallback snap).

- [ ] **Step 2.3 : Modifier `recomputeAllKm`**

Dans `js/gps-core.js`, remplacer le bloc `else { … }` de `recomputeAllKm` (lignes 233-243) par :

```javascript
      } else {
        // Pas de GPX : aucune distance ajoutée (plus de fallback snap).
        // Conséquence : kmTotal reste au niveau de la dernière étape avec GPX.
        kmDay = 0;
      }
```

- [ ] **Step 2.4 : Vérifier que tous les tests passent**

```bash
npm test
```

Attendu : tous les tests Vitest passent (les 240 existants + ceux ajoutés en Task 1 + les 3 remplacés).

- [ ] **Step 2.5 : Commit**

```bash
git add js/gps-core.js tests/gps-core.test.js
git commit -m "fix(gps-core): return kmDay=0 when stage has no GPX track"
```

---

## Task 3 : `updateMap` — barre sans vélo + crow-flies

**Files:**
- Modify: `js/map-core.js:109-148`

- [ ] **Step 3.1 : Réécrire `updateMap`**

Remplacer la fonction complète `updateMap` (lignes 109-148) par :

```javascript
function updateMap(){
  var pos=getCurrentPos();
  var crow=GPSCore.computeCrowfliesProgress(pos?pos.lat:NaN,pos?pos.lon:NaN);

  // Tracé orange snappé désactivé : on force toujours le layer à vide,
  // même avec une position active, car seuls les GPX réels doivent être visibles.
  completedLayer.setLatLngs([]);
  if(pos){
    posMarker.setLatLng([pos.lat,pos.lon]);
    if(!map.hasLayer(posMarker))posMarker.addTo(map);
  } else {
    if(map.hasLayer(posMarker))map.removeLayer(posMarker);
  }

  // Badge position
  var badge=document.getElementById('posBadge');
  if(pos){
    badge.classList.add('vis');
    document.getElementById('posT').textContent=Math.round(crow.pct)+'% — route France → Irlande';
    var posS=document.getElementById('posS');
    if(posS){posS.textContent='';posS.style.display='none';}
    document.getElementById('posB').style.width=crow.pct+'%';
  } else {
    badge.classList.remove('vis');
  }

  // Stats header carte : km vol d'oiseau
  document.getElementById('mapKmD').textContent=Math.round(crow.kmFromStart);
  document.getElementById('mapKmL').textContent=Math.round(crow.kmRemaining);
  var nbDays=Object.keys(stages).length;
  document.getElementById('mapDays').textContent='J'+nbDays;
}
```

- [ ] **Step 3.2 : Commit**

```bash
git add js/map-core.js
git commit -m "refactor(map): use crow-flies progress and drop bike indicator"
```

---

## Task 4 : `updateRecap` — crow-flies + ligne GPX

**Files:**
- Modify: `js/stages.js:141-153`

- [ ] **Step 4.1 : Réécrire `updateRecap`**

Remplacer la fonction complète `updateRecap` (lignes 141-153) par :

```javascript
function updateRecap(){
  var dates=Object.keys(stages).sort();
  var kmReal=GPSCore.sumTrackKm(tracks);
  var crow=current
    ?GPSCore.computeCrowfliesProgress(current.lat,current.lon)
    :GPSCore.computeCrowfliesProgress(NaN,NaN);
  var nbDays=dates.length;
  var avgKmPerDay=nbDays>0?Math.round((crow.kmFromStart/nbDays)*10)/10:0;

  document.getElementById('rKmD').textContent=Math.round(crow.kmFromStart);
  document.getElementById('rKmL').textContent=Math.round(crow.kmRemaining);
  document.getElementById('rDays').textContent=nbDays;
  document.getElementById('rAvg').textContent=avgKmPerDay||'—';
  document.getElementById('rBar').style.width=crow.pct+'%';

  var rReal=document.getElementById('rKmReal');
  if(rReal){
    if(kmReal>0){
      rReal.textContent=Math.round(kmReal)+' km pédalés (GPX)';
      rReal.style.display='';
    } else {
      rReal.textContent='';
      rReal.style.display='none';
    }
  }

  document.getElementById('mapDays').textContent='J'+nbDays;
}
```

- [ ] **Step 4.2 : Commit**

```bash
git add js/stages.js
git commit -m "refactor(stages): recap uses crow-flies and shows real GPX km"
```

---

## Task 5 : DOM — `index.html`

**Files:**
- Modify: `index.html:184-205`

- [ ] **Step 5.1 : Retirer l'icône vélo de la barre carte**

Dans `index.html`, remplacer le bloc (lignes ~184-191) :

```html
    <div class="pos-badge" id="posBadge">
      <div class="pos-badge-t" id="posT">Prochaine : Cork → Kinsale</div>
      <div class="pos-badge-s" id="posS">~2978 km restants (vol d'oiseau)</div>
      <div class="pos-bar">
        <div class="pos-bar-f w-0" id="posB"></div>
        <div class="pos-bike" id="posBike" aria-hidden="true">🚴‍♂️</div>
      </div>
    </div>
```

par :

```html
    <div class="pos-badge" id="posBadge">
      <div class="pos-badge-t" id="posT">0% — route France → Irlande</div>
      <div class="pos-badge-s" id="posS" style="display:none"></div>
      <div class="pos-bar">
        <div class="pos-bar-f w-0" id="posB"></div>
      </div>
    </div>
```

- [ ] **Step 5.2 : Mettre à jour les labels du recap Étapes + ajouter `rKmReal`**

Dans `index.html`, remplacer le bloc (lignes ~196-205) :

```html
    <div class="recap" id="recapBox">
      <div class="recap-t">Progression globale</div>
      <div class="recap-grid">
        <div class="recap-item"><div class="recap-v" id="rKmD">0</div><div class="recap-l">km parcourus</div></div>
        <div class="recap-item"><div class="recap-v" id="rKmL">2978</div><div class="recap-l">km restants (~)</div></div>
        <div class="recap-item"><div class="recap-v" id="rDays">0</div><div class="recap-l">jours</div></div>
        <div class="recap-item"><div class="recap-v" id="rAvg">—</div><div class="recap-l">km/jour moy.</div></div>
      </div>
      <div class="recap-bar"><div class="recap-bar-f w-0" id="rBar"></div></div>
    </div>
```

par :

```html
    <div class="recap" id="recapBox">
      <div class="recap-t">Progression globale</div>
      <div class="recap-grid">
        <div class="recap-item"><div class="recap-v" id="rKmD">0</div><div class="recap-l">km parcourus (~)</div></div>
        <div class="recap-item"><div class="recap-v" id="rKmL">0</div><div class="recap-l">km restants (~)</div></div>
        <div class="recap-item"><div class="recap-v" id="rDays">0</div><div class="recap-l">jours</div></div>
        <div class="recap-item"><div class="recap-v" id="rAvg">—</div><div class="recap-l">km/jour moy.</div></div>
      </div>
      <div class="recap-real" id="rKmReal" style="display:none"></div>
      <div class="recap-bar"><div class="recap-bar-f w-0" id="rBar"></div></div>
    </div>
```

- [ ] **Step 5.3 : Commit**

```bash
git add index.html
git commit -m "refactor(html): drop bike icon, add GPX km line in recap"
```

---

## Task 6 : CSS — `styles.css`

**Files:**
- Modify: `styles.css:69`

- [ ] **Step 6.1 : Retirer `.pos-bike` et ajouter `.recap-real`**

Dans `styles.css`, supprimer la ligne 69 :

```css
.pos-bike{position:absolute;left:0;top:50%;transform:translate(-50%,-50%);font-size:16px;line-height:1;transition:left .5s;filter:drop-shadow(0 1px 1px rgba(0,0,0,.2))}
```

Ajouter immédiatement après la règle `.recap-bar-f` (ou n'importe où dans la zone `.recap*` pour grouper par thème) :

```css
.recap-real{font-size:12px;opacity:.85;margin-top:8px;text-align:center}
```

- [ ] **Step 6.2 : Commit**

```bash
git add styles.css
git commit -m "style: remove .pos-bike, add .recap-real"
```

---

## Task 7 : `CLAUDE.md` — point de départ Annecy

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 7.1 : Corriger le point de départ**

Dans `CLAUDE.md`, remplacer :

```
Tracé complet : France (Chamonix → Roscoff) + Irlande (Cork → Sligo).
```

par :

```
Tracé complet : France (Annecy → Roscoff) + Irlande (Cork → Sligo).
```

- [ ] **Step 7.2 : Commit**

```bash
git add CLAUDE.md
git commit -m "docs: correct starting point (Annecy, not Chamonix)"
```

---

## Task 8 : Validation finale

- [ ] **Step 8.1 : Lancer les tests + lint**

```bash
npm test
npm run lint
```

Attendu : tous les tests passent (9 fichiers, au total ≥ 246 tests après ajout des 6 nouveaux `computeCrowfliesProgress`), aucun warning ESLint.

- [ ] **Step 8.2 : Smoke test manuel (visiteur + admin)**

Servir localement (`python3 -m http.server 8080` ou équivalent) et vérifier :

1. Onglet Carte :
   - Badge affiche `"XX% — route France → Irlande"` sans icône vélo.
   - Barre remplie à XX% en cohérence avec le pourcentage affiché.
   - `#mapKmD` et `#mapKmL` affichent des entiers cohérents (kmFromStart + kmRemaining ≈ kmTotalCrow Annecy → Sligo).
   - Quand aucune position n'est connue, badge masqué.
2. Onglet Étapes :
   - Recap affiche `rKmD` (parcourus ~) + `rKmL` (restants ~), même pct que la carte.
   - Si au moins un GPX : ligne "X km pédalés (GPX)" visible ; si aucun : ligne absente.
   - L'étape du 2026-04-19 (sans GPX) n'affiche **plus** "73 km" : `kmDay` = 0 donc le label `🚴 X km · ⛰️ D+ Y m` devient vide (via `JournalCore.buildKmInfoLabel`).
3. Admin : uploader un GPX sur une étape → `kmDay` et `kmTotal` se mettent à jour, puis supprimer → `kmDay` retombe à 0.

---

## Hors périmètre (rappel du spec)

- Cache bump service worker : non requis par le spec. Si une mise en cache stale pose problème en prod, incrémenter `ev1-v28` manuellement au déploiement.
- Migration des `stages.kmTotal` en base : non requise, `recomputeAllKm` réécrit à la prochaine mutation GPX.
