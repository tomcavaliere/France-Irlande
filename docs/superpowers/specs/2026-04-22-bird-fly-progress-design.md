# Progression vol d'oiseau Annecy → Sligo — design

## Contexte

La barre de progression de l'onglet Carte (badge `#posBadge`) repose actuellement sur deux calculs hétérogènes :

- **Pourcentage** : `pct = sumTrackKm(tracks) / TOTAL_KM` — somme des GPX réels divisée par la longueur du tracé prévu complet (~2978 km).
- **Km restants** : haversine de la position actuelle jusqu'à Sligo.

Problèmes identifiés :

1. L'icône vélo 🚴‍♂️ positionnée sur la barre est peu lisible et complexifie le rendu sans apporter d'information.
2. Le `kmDay` d'une étape sans GPX vaut `snap.kmTotal − prevKmTotal` (snap sur le tracé prévu), ce qui affiche des distances fantômes. Cas constaté : étape du 2026-04-19 affichée avec 73 km alors qu'aucun GPX n'est uploadé.
3. Le recap "Progression globale" de l'onglet Étapes utilise la même logique hybride et pourra diverger du nouveau calcul de la carte.

## Objectif

- Remplacer le calcul de progression par une formule **vol d'oiseau Annecy → Sligo** simple et cohérente entre l'onglet Carte et l'onglet Étapes.
- Supprimer l'icône vélo sur la barre de progression de la carte et simplifier l'affichage à un seul texte `"XX% — route France → Irlande"` au-dessus de la barre.
- Corriger le `kmDay` : aucune étape sans GPX ne doit générer de km fictif.
- Conserver l'information "km réellement pédalés (GPX)" comme stat complémentaire dans le recap Étapes.
- Mettre à jour `CLAUDE.md` (le point de départ est Annecy, pas Chamonix).

## Contrat de l'API pure

### `gps-core.js` — ajouts

**Constante** :

```js
var ANNECY_COORDS = { lat: 45.8992, lon: 6.1294 };
```

À exposer via `window.GPSCore.ANNECY_COORDS` (et via `module.exports` côté Node pour les tests).

**Fonction `computeCrowfliesProgress(lat, lon)`** :

Calcule la progression vol d'oiseau entre Annecy et Sligo.

- **Entrée** : `lat` et `lon` (nombres finis attendus ; tout autre type → sortie par défaut).
- **Sortie** : `{ pct, kmFromStart, kmRemaining, kmTotalCrow }`
  - `kmTotalCrow` : `haversineKm(ANNECY, SLIGO)` — valeur constante, calculée une fois et mise en cache en module.
  - `kmFromStart` : `max(0, haversineKm(ANNECY.lat, ANNECY.lon, lat, lon))`.
  - `kmRemaining` : `max(0, kmTotalCrow − kmFromStart)`.
  - `pct` : `clamp(kmFromStart / kmTotalCrow × 100, 0, 100)` arrondi à 1 décimale.
- **Cas limites** :
  - `lat` ou `lon` non finis (`NaN`, `null`, `undefined`, string) → `{ pct: 0, kmFromStart: 0, kmRemaining: kmTotalCrow, kmTotalCrow }`.
  - Position au-delà de Sligo (distance Annecy → pos > distance Annecy → Sligo) → `pct` clampé à 100, `kmRemaining = 0`.

Fonction pure : pas d'accès DOM ni I/O. Export via `window.GPSCore.computeCrowfliesProgress` et `module.exports` Node.

### `gps-core.js` — modification de `recomputeAllKm`

Branche fallback (aucune entrée dans `tracks` pour la date) : retourner `kmDay = 0` au lieu de `snap.kmTotal − prevKmTotal`.

Conséquences :

- `kmTotal` d'une étape sans GPX reste égal à celui de l'étape précédente.
- `sumTrackKm(tracks)` reste la source unique de vérité pour les km réels pédalés.
- Le label `🚴 X km · ⛰️ D+ Y m` du carnet (via `journal-core.buildKmInfoLabel`) devient vide pour une étape sans GPX — `buildKmInfoLabel` retourne déjà `""` si `kmDay` est falsy, aucune modification nécessaire.

## UI

### Onglet Carte — badge `#posBadge`

Texte unique au-dessus de la barre :

```
XX% — route France → Irlande
```

où `XX = round(computeCrowfliesProgress(pos.lat, pos.lon).pct)`.

Sortie du badge (détail DOM) :

- `#posT` : contient la chaîne ci-dessus.
- `#posS` : vidé et masqué (`style.display = 'none'`) — conservé dans le DOM pour éviter de casser d'éventuels sélecteurs, sans impact visuel.
- `.pos-bar > #posB` : `width = pct + '%'` (inchangé).
- `.pos-bike` / `#posBike` : **supprimé** du DOM et des styles.

Stats header carte (`#mapKmD`, `#mapKmL`, `#mapDays`) :

- `#mapKmD` : `round(kmFromStart)` (vol d'oiseau depuis Annecy).
- `#mapKmL` : `round(kmRemaining)` (vol d'oiseau restant Annecy → Sligo).
- `#mapDays` : inchangé (`'J' + nbDays`).

### Onglet Étapes — recap `#recapBox`

Grid 4 cellules (inchangé structurellement) :

- `#rKmD` : `round(kmFromStart)` — label "km parcourus (vol d'oiseau)".
- `#rKmL` : `round(kmRemaining)` — label "km restants (vol d'oiseau)".
- `#rDays` : inchangé (nombre d'étapes).
- `#rAvg` : `kmFromStart / nbDays` arrondi à 1 décimale (0 si `nbDays === 0`).
- `#rBar` : `width = pct + '%'` (même pct que la carte).

**Nouvelle ligne** sous le grid, au-dessus de `.recap-bar` :

- Nouveau DOM : `<div class="recap-real" id="rKmReal">X km pédalés (GPX)</div>`.
- Contenu dynamique : `round(sumTrackKm(tracks))` km + suffixe statique.
- Masquée si `sumTrackKm(tracks) === 0` (pas de GPX encore).

### Labels textuels mis à jour

Dans `index.html` :

- Label sous `#rKmD` : "km parcourus" → "km parcourus (~)".
- Label sous `#rKmL` : "km restants (~)" (inchangé, toujours approximatif).

Le "~" rappelle au lecteur que l'affichage est vol d'oiseau et non un kilométrage réel.

### Styles `styles.css`

- Supprimer la règle `.pos-bike{...}` (ligne 69).
- Ajouter `.recap-real{font-size:12px;opacity:.85;margin-top:8px;text-align:center}`.

### `CLAUDE.md`

Remplacer dans la section "biketrip — Bikepacking France → Irlande" :

```
Tracé complet : France (Chamonix → Roscoff) + Irlande (Cork → Sligo).
```

par :

```
Tracé complet : France (Annecy → Roscoff) + Irlande (Cork → Sligo).
```

## Tests (Vitest, `tests/gps-core.test.js`)

### Nouveaux tests — `computeCrowfliesProgress`

1. `ANNECY_COORDS` exact (45.8992, 6.1294) → `pct ≈ 0`, `kmFromStart < 0.1`.
2. `SLIGO_COORDS` exact (54.2775, -8.4714) → `pct === 100`, `kmRemaining < 0.1`.
3. Position intermédiaire plausible (ex. Cork 51.90, -8.47) → `0 < pct < 100` et `kmFromStart + kmRemaining ≈ kmTotalCrow` (tolérance 1 km).
4. Position au-delà de Sligo (ex. lat = 60, lon = -20) → `pct === 100`, `kmRemaining === 0`.
5. Entrées invalides : `(NaN, NaN)`, `(null, null)`, `("a", "b")`, `(undefined, 0)` → retour par défaut (`pct: 0`, `kmFromStart: 0`, `kmRemaining === kmTotalCrow`).
6. `kmTotalCrow` strictement > 0 et stable entre appels (constante).

### Tests modifiés — `recomputeAllKm`

1. Stage avec entrée dans `tracks` → `kmDay = tracks[date].kmDay` (comportement inchangé).
2. Stage sans entrée dans `tracks` + lat/lon valides → `kmDay = 0` (nouveau).
3. Enchaînement de plusieurs stages sans GPX → `kmTotal` n'accumule pas (reste à la valeur du dernier stage avec GPX).
4. Les tests existants qui reposaient sur le comportement "fallback snap" doivent être relus et adaptés : le comportement attendu est désormais `kmDay = 0` sans GPX.

## Hors périmètre

- Tracés GPX réels sur la carte (rendu `renderTrackPolylines`) : inchangés.
- Logique offline queue, service worker, Firebase RTDB rules : inchangées.
- Onglets Santé, Entraînement, Dépenses : inchangés.
- Ajout d'une logique "progression le long du tracé prévu" (projection orthogonale, distance parcourue sur polyline) : non pertinent, la formule vol d'oiseau suffit pour le besoin.
- Affichage des km réellement pédalés dans le badge de la carte : décidé hors scope (le badge reste minimal). L'info reste accessible via le recap Étapes.

## Risques connus

- **Divergence vol d'oiseau vs tracé réel** : le vélo parcourra ~2978 km de tracé réel pour seulement ~1600 km à vol d'oiseau Annecy → Sligo (ordre de grandeur). Le pourcentage affiché ne correspond donc pas à l'effort réel mais à "quelle fraction du segment géographique Annecy → Sligo ai-je franchie". C'est volontaire et documenté dans les labels (suffixe `(~)` et libellé "vol d'oiseau").
- **Détours géographiques** : un détour nord (ex. Chamonix) augmente temporairement `kmFromStart`. Acceptable : l'utilisateur accepte cette approximation.
- **`stages.kmTotal` dans la base Firebase** : avec le nouveau comportement, `kmTotal` cessera d'accumuler pour les étapes sans GPX. Les étapes historiques déjà écrites en base ne sont pas touchées automatiquement — un `recomputeAllKm` déclenché après déploiement recalculera et persistera les nouvelles valeurs lors du prochain upload GPX ou de la prochaine mise à jour d'étape. Pas de migration manuelle requise.

## Critères de réussite

- Barre de progression carte sans vélo, texte unique `"XX% — route France → Irlande"`.
- Étape 2026-04-19 (sans GPX) n'affiche plus "73 km" dans le carnet.
- Onglet Étapes recap : 4 chiffres vol d'oiseau + ligne "X km pédalés (GPX)" cohérente.
- Pourcentage identique entre la barre Carte et la barre Étapes pour une même position.
- Tous les tests Vitest passent (`npm test`), aucun warning ESLint (`npm run lint`).
- `CLAUDE.md` mentionne Annecy comme point de départ.
