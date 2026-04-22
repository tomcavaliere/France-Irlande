# Tests unitaires

Suite de tests pour la logique pure de l'app biketrip.

## Lancer les tests

```bash
npm install      # une seule fois
npm test         # run unique (CI)
npm run test:watch  # mode TDD
```

Outil : [Vitest](https://vitest.dev). Pas de bundler, pas de jsdom — uniquement
du JS pur exécuté en Node.

## Architecture

L'app vit dans un seul gros [index.html](../index.html) (~1700 lignes) très
couplé au DOM, à Firebase et à `navigator.geolocation`. Pour pouvoir tester
sans navigateur, **les fonctions pures sont extraites** dans deux modules
chargés à la fois par le navigateur (`<script>`) et par les tests
(`import`) :

| Module | Rôle |
|---|---|
| [js/gps-core.js](../js/gps-core.js) | Calculs GPS : snap au tracé, progression, détection FR/IRE, distance aux POI |
| [js/utils.js](../js/utils.js) | Helpers : escaping HTML, formatage de date, agrégation de dépenses |

`index.html` ne fait plus que déléguer via des wrappers d'une ligne
(`function escAttr(s){return Utils.escAttr(s);}` etc.) — la prod utilise donc
exactement le code couvert par les tests.

## Fixtures

[fixtures/route-sample.js](fixtures/route-sample.js) — 50 points GPS réels
sous-échantillonnés depuis le tracé biketrip d'`index.html` (25 en France,
25 en Irlande), avec `CUM_KM` recalculé à la haversine. Cette fixture est
**figée** : elle évite de charger les ~5000 points du tracé complet à chaque
test et garantit des assertions déterministes.

`TOTAL_KM` de la fixture (~2337 km) ≠ `TOTAL_KM` de la prod (2978 km) — c'est
normal, on teste la logique, pas le tracé exact.

## Couverture

### `tests/gps-core.test.js` — 19 tests

#### `snapToRoute(lat, lon, routePts, cumKm)` — 4 tests
Trouve le point le plus proche du tracé pour une coordonnée GPS donnée.
**Critique** : c'est cette fonction qui fait avancer le marker sur la carte.

- Snap exact (point identique → renvoie cet index)
- Snap approché (~10 m de décalage → toujours le bon index)
- Point très éloigné → renvoie quand même un index valide (pas de `null`)
- Cohérence `kmTotal` ↔ `CUM_KM[idx]`

#### `routePointsAhead(fromIdx, distKm, routePts, cumKm)` — 3 tests
Renvoie les points du tracé dans les N km à venir. Utilisé pour requêter
Overpass (campings, points d'eau) uniquement sur la portion devant.

- Renvoie au moins le point de départ
- S'arrête une fois la distance cible atteinte
- Cas limite : `fromIdx` proche de la fin du tracé

#### `ptsBbox(pts, margin)` — 2 tests
Bounding box autour d'une liste de points, utilisée pour les requêtes
Overpass.

- Bbox correcte sur 3 points connus
- Marge appliquée symétriquement

#### `computeStageInfo(...)` — **simulation de 3 étapes** — 6 tests
**Le test métier central**, demandé explicitement : on simule trois positions
GPS successives pour vérifier comment l'état de l'app évolue le long du
voyage.

| Étape | Position simulée | Pays attendu | Progression |
|---|---|---|---|
| 1 | Premier point du tracé | 🇫🇷 FR | ~0 % |
| 2 | Dernier point français (`FRANCE_END_IDX`) | 🇫🇷 FR | intermédiaire |
| 3 | Dernier point irlandais | 🇮🇪 IE | ~100 % |

Et deux **invariants métier** vérifiés à travers les trois étapes :

- `kmTotal` strictement croissant (on n'avance jamais en arrière)
- `kmRemaining` strictement décroissant
- Transition FR→IE bien à `FRANCE_END_IDX + 1`

#### `campingDist(fromIdx, lat, lon, routePts, cumKm)` — 4 tests
Distance jusqu'à un POI : km via le tracé + détour à vol d'oiseau.

- POI sur le tracé devant nous → détour ≈ 0, `trace` ≈ ΔCUM_KM
- POI **derrière** nous → `trace` clampée à 0 (pas de km négatifs)
- POI ~1 km à l'écart → détour effectif > 0
- Arrondis : `trace` entier, `detour` à 0,1 km près

### `tests/utils.test.js` — 15 tests

#### `escAttr(s)` — 3 tests
Échappement pour valeurs d'attribut HTML. Critique pour la sécurité car
utilisé partout dans les `onclick="..."` des galeries photos / commentaires.

- Échappement de `&`, `'`, `"`
- Test d'injection : impossible de casser un `onclick`
- Coercition propre des non-strings

#### `escHtml(s)` — 3 tests
Échappement pour contenu HTML (commentaires, descriptions de dépenses).

- Échappement de `<`, `>` (anti-XSS)
- Échappement de `&`, `"`
- Texte ordinaire intact

#### `formatTime(ts)` — 2 tests
Formate `Date.now()` en `"7 avr. à 14:30"`. Tests volontairement
**indépendants du fuseau horaire** : on vérifie le format (regex), pas la
valeur exacte.

#### `summarizeExpenses(expenses)` — 7 tests
Agrégation pure des dépenses (extraction de la logique de
`renderExpenses` dans `index.html`).

- Total exact
- Comptage des jours distincts
- Moyenne par jour
- Agrégation par catégorie
- Regroupement par date
- Cas vide → ne crashe pas, `days = 1`
- `amount` non-numérique → traité comme 0

## Ce qui n'est *pas* testé (et pourquoi)

| Fonction | Raison |
|---|---|
| `updatePosition()` | Couplée à `navigator.geolocation` + DOM + Firebase. Test E2E (Playwright) requis. |
| `updateMap()`, `renderStages()`, `renderExpenses()` | DOM-only, ROI faible. Couvert par la non-régression visuelle manuelle. |
| `initFirebase()`, `flushQueue()` | Réseau / RTDB. Nécessiterait un mock Firebase complet. |
| Compression d'image, upload photo | API canvas / FileReader, hors scope unit. |

Ces fonctions sont des **adaptateurs** autour du noyau pur testé — la valeur
business critique est dans `gps-core` et `utils`.

## Ajouter un test

1. Si la fonction est déjà pure → ajoute-la dans `js/gps-core.js` ou
   `js/utils.js`, ajoute-la à l'objet `api`, importe-la dans le test.
2. Si elle dépend du DOM ou de Firebase → extrais la partie pure
   (calcul / transformation de données) dans un helper, garde le wrapper
   couplé au DOM dans `index.html`.
3. Lance `npm run test:watch` pendant le développement.

## Mise à jour de la fixture

Si le tracé change significativement et que tu veux régénérer
`route-sample.js`, le script Python suivant est suffisant (sous-échantillonne
50 points et recalcule la distance haversine) :

```python
import re, json, math
html = open('index.html').read()
fr  = json.loads(re.search(r'const FULL_ROUTE_FR=(\[\[.*?\]\]);', html, re.S).group(1))
ire = json.loads(re.search(r'const FULL_ROUTE_IRE=(\[\[.*?\]\]);', html, re.S).group(1))
def hav(a,b):
    R=6371; toR=lambda x:x*math.pi/180
    dLat=toR(b[0]-a[0]); dLon=toR(b[1]-a[1])
    s=math.sin(dLat/2)**2+math.cos(toR(a[0]))*math.cos(toR(b[0]))*math.sin(dLon/2)**2
    return 2*R*math.asin(math.sqrt(s))
def sample(arr,n): return [arr[i*(len(arr)-1)//(n-1)] for i in range(n)]
frS, ireS = sample(fr,25), sample(ire,25)
all_pts = frS + ireS
cum=[0.0]
for i in range(1,len(all_pts)): cum.append(cum[-1]+hav(all_pts[i-1],all_pts[i]))
out = {'ROUTE_PTS': all_pts, 'CUM_KM': [round(k,4) for k in cum],
       'FRANCE_END_IDX': len(frS)-1, 'TOTAL_KM': round(cum[-1],2)}
open('tests/fixtures/route-sample.js','w').write(
    '// Échantillon réel du tracé\nmodule.exports = '+json.dumps(out,indent=2)+';\n')
```
