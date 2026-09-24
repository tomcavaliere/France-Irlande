# Tests

Deux niveaux, tous deux hors réseau applicatif :

| Niveau | Outil | Commande | Cible |
|---|---|---|---|
| Unitaire | [Vitest](https://vitest.dev), Node pur (ni jsdom ni bundler) | `npm test` / `npm run test:watch` | `unit/` : modules purs de `js/core/` et façade `js/services/db.js` ; `static/` : garde-fous sur les fichiers livrés |
| E2E | [Playwright](https://playwright.dev) (Chromium, viewport Pixel 7) + [axe-core](https://github.com/dequelabs/axe-core) | `npm run test:e2e` | parcours du **mode démo** dans un vrai navigateur, accessibilité |

Plus `npm run security:test` (`static/security-check.js`) : règles Firebase (aucune
écriture anonyme), CSP, motifs JS interdits (`eval`, `document.write`, `fetch()` direct).

## Principe : la prod exécute le code testé

Les scripts de `js/` ne sont pas des modules ES : ils sont chargés par `<script>` dans
`index.html`. Toute logique non triviale (calcul, validation, normalisation, formatage)
vit dans un module pur de `js/core/` à **double export** :

```js
(function(){
  function maFonction(x){ /* … */ }
  var api = { maFonction: maFonction };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // tests
  if (typeof window !== 'undefined') window.MonCore = api;                  // navigateur
})();
```

Les modules DOM/I/O n'y délèguent que par des wrappers d'une ligne
(`function escAttr(s){ return Utils.escAttr(s); }`) : aucune copie de logique.

## Fichiers Vitest (357 tests)

| Fichier | Tests | Couvre |
|---|---|---|
| `unit/utils.test.js` | 156 | escaping (sécurité), dates locales, validations, dépenses, quota, `safeFetch` (retries/timeout), filtres carnet |
| `unit/gps-core.test.js` | 46 | snap au tracé, points devant, bbox, simulation de 3 étapes FR→IE, distance POI, parsing GPX, recalcul des km |
| `unit/demo-core.test.js` | 25 | arbre en mémoire du mode démo, snapshots, détection `#demo` |
| `unit/stages-core.test.js` | 19 | drapeau pays, labels, totaux, étape manuelle, paths Storage, compteur de jours |
| `unit/journal-core.test.js` | 18 | bravos, labels, fusion brouillons admin / temps réel |
| `unit/activity-core.test.js` | 14 | normalisation, filtre voyageurs (accents), séries 7 jours, classement |
| `unit/visitor-auth-core.test.js` | 14 | hash, config, changement de mot de passe |
| `unit/offline-core.test.js` | 11 | file hors-ligne bornée, index des caches |
| `unit/events-core.test.js` | 10 | bus d'événements |
| `unit/db.test.js` | 9 | façade RTDB avec `window._fb*` simulés, Firebase absent → rejet propre |
| `unit/campings-core.test.js` | 8 | mapping des POI, proximité du tracé |
| `unit/comments-core.test.js` | 7 | nom d'auteur admin, normalisation des réponses |
| `unit/weather-core.test.js` | 6 | parsing open-meteo |
| `static/sw-precache.test.js` | 6 | `PRECACHE` couvre les assets et pages liées d'`index.html`, chemins relatifs, fichiers existants |
| `static/index-html.test.js` | 5 | viewport zoomable, manifest et dimensions des icônes |

Les tests de dates construisent leurs horloges en heure **locale**
(`new Date(2026, 4, 20, 12)`) : la suite passe quel que soit `TZ`
(vérifié avec `TZ` = America/Los_Angeles, UTC, Europe/Paris, Pacific/Auckland,
Pacific/Kiritimati).

## E2E (18 tests)

`playwright.config.js` démarre `scripts/serve.mjs`, qui sert le dépôt sous
`/France-Irlande/` comme GitHub Pages : le service worker tourne avec les chemins de prod.
Seul le **mode démo** est testé (aucun Firebase) ; tuiles OSM et open-meteo sont
interceptées.

- `e2e/demo.e2e.js` : démarrage sans aucune requête vers Firebase/Google, compteur de
  jours, commentaire visiteur, admin démo (publier/dépublier, onglets, sortie), Campspace
  chargé à la demande, tableau de bord d'activité, rendu lecture seule du mode archive, SW activé
  + installabilité + rechargement **hors-ligne** (page de confidentialité comprise).
  Garde-fous RGPD : aucun appel open-meteo pour un visiteur, aucun `ev1_visitor_id`
  stocké en démo, gate de l'archive sans prénom, liens vers la page de confidentialité.
- `e2e/a11y.e2e.js` : audit axe WCAG 2 A/AA de toutes les vues visiteur et admin, des
  dialogues, du gate de l'archive et de `confidentialite.html`, ouverture d'une photo au
  clavier, Échap.

Première exécution locale : `npx playwright install chromium`.

## Ce qui n'est pas testé automatiquement

| Zone | Raison |
|---|---|
| Vraie version (Firebase réel, login admin, position GPS) | Nécessite le backend de prod ; la démo exerce les mêmes chemins de code via les stubs `window._fb*` |
| Règles Firebase à l'exécution | Seule leur forme est vérifiée (`security-check.js`) ; à valider dans le Rules Playground avant publication |
| Upload réel photo/vidéo, compression canvas | API navigateur + Storage ; la démo simule l'upload |

## Ajouter un test

1. Logique pure → dans le module concerné de `js/core/` (ou un nouveau, sur le patron
   ci-dessus : à ajouter aussi dans `index.html` et dans `PRECACHE` de `sw.js` ; ESLint le
   reconnaît par son dossier), puis test dans `unit/<module>.test.js`.
2. Logique mêlée au DOM ou à Firebase → extraire la partie pure, garder un wrapper.
3. Nouveau parcours ou nouvelle vue de la démo → test dans `e2e/`, qui doit passer l'audit axe.
4. `npm run test:watch` pendant le développement.

## Fixture du tracé

`fixtures/route-sample.js` : 50 points réels sous-échantillonnés (25 FR + 25 IE) avec
`CUM_KM` recalculé à la haversine, pour ne pas charger les 5 058 points du tracé.
`TOTAL_KM` de la fixture (~2337 km) ≠ prod (~2978 km) : on teste la logique, pas le tracé.

Si le tracé change significativement, régénérer la fixture :

```python
import re, json, math
src = open('js/data/route-data.js').read()
fr  = json.loads(re.search(r'const FULL_ROUTE_FR=(\[\[.*?\]\]);', src, re.S).group(1))
ire = json.loads(re.search(r'const FULL_ROUTE_IRE=(\[\[.*?\]\]);', src, re.S).group(1))
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
