# Mode démo — design

**Date** : 2026-07-16
**Statut** : validé

## Objectif

Le voyage est terminé. Tom veut un lien démo dans son CV : montrer l'app à des recruteurs
sans exposer les données personnelles du voyage. À l'ouverture du site, choix entre la
démo (données fictives légères, toutes les fonctionnalités y compris admin) et la vraie
version (mot de passe visiteur, strictement inchangée).

## Décisions

1. **Démo = visiteur + admin** : démarre en visiteur, bouton « Tester le mode admin »
   sans mot de passe dans le bandeau démo.
2. **Vrai tracé GPS** (déjà public dans le repo via `route-data.js`) + **contenu 100 %
   fictif**, étapes **uniquement en Irlande** (Cork → Sligo), voyage « en cours »
   (position courante entre Westport et Sligo).
3. **Faux backend en mémoire** : en démo, Firebase n'est jamais importé ; les globales
   `window._fb*` sont remplacées par des stubs alimentés par `DEMO_DATA`. Écritures
   fonctionnelles mais volatiles — le rechargement réinitialise la démo (feature).
4. Lien direct pour le CV : `…/#demo` (le hash n'affecte ni le service worker ni le
   cache, contrairement à `?demo` qui casse la détection app-shell de sw.js).

## Architecture

**Point de bascule unique** : les ~30 sites d'appel Firebase passent tous par les
globales `window._fb*` posées par `js/firebase-init.js`. En démo on remplace ces
globales ; zéro modification des sites d'appel.

### Activation

- La CSP de index.html n'autorise pas les scripts inline (`script-src 'self' …`) →
  le flag est évalué par **`js/demo-flag.js`**, chargé **sans defer** en tête de
  `<head>` (après `js/demo-core.js`, lui aussi non-defer), donc exécuté au parse,
  avant tout script différé (`state.js` lit le flag à l'évaluation).
- `window.DEMO_MODE = DemoCore.isDemoRequested(location.hash, localStorage.getItem('ev1-demo'))`
- Entrée : bouton « 🎬 Découvrir la démo » sur le gate visiteur →
  `localStorage.setItem('ev1-demo','1')` + reload.
- Sortie : bouton « Quitter la démo » du bandeau → clear flag + strip hash + reload.
- Les actions (`enterDemoMode`, `exitDemoMode`, `demoToggleAdmin`) sont enregistrées
  dans la map `ACTIONS` de `js/ui.js` (délégation d'événements existante).

### Nouveaux fichiers

| Fichier | Rôle |
|---|---|
| `js/demo-core.js` | Pur, testé, double export (`window.DemoCore` + `module.exports`). `pathGet/pathSet/pathRemove` (arbre par chemin `a/b/c`, nettoyage des nœuds vides), `makeSnapshot(value)` (`{val(), exists()}` avec deep-clone — les sites d'appel mutent le résultat, ex. `stages[date].published=!pub`), `isDemoRequested(hash, storedFlag)`. |
| `js/demo-flag.js` | 3 lignes, non-defer : pose `window.DEMO_MODE`. |
| `js/demo-data.js` | `window.DEMO_DATA` : arbre RTDB fictif complet, < 25 KB. |
| `js/demo-mode.js` | Couche I/O du mode démo. Définit toujours `enterDemoMode()`. Si `DEMO_MODE` : installe les stubs `_fb*` (RTDB, Auth, Storage) et le bandeau démo (DOMContentLoaded propre, comme `visitor-auth.js`). |

### Stubs (js/demo-mode.js)

- **RTDB** : arbre en mémoire cloné depuis `DEMO_DATA`. `_fbRef(db,path)→{path}`,
  `_fbGet→Promise<snapshot>`, `_fbSet`/`_fbRemove` écrivent puis notifient,
  `_fbOnValue(ref,cb)` : registre par path, appel initial asynchrone (`setTimeout 0`),
  retourne l'unsub. Chaque écriture re-notifie **tous** les listeners (données
  minuscules ; couvre la sémantique ancêtre/descendant de Firebase sans complexité).
- **Auth** : `_fbAuth={currentUser:null}` + observers. `_fbSignIn` →
  `currentUser={email:'demo@biketrip.app', uid:'demo-admin'}` + notifie → tout le flux
  admin existant (`initAuth`, `admin.js`) fonctionne tel quel, auto-déconnexion 3 min
  comprise. `_fbSignOut` → null + notifie.
- **Storage** (photos + vidéos) : `_fbUploadResumable(ref, blob)` → faux uploadTask
  (`on('state_changed', progress, err, done)`, progress 100 % puis done asynchrone,
  `snapshot.ref` porte le blob) ; `_fbGetDownloadURL(ref)` → `URL.createObjectURL(blob)`
  — l'upload fonctionne réellement dans la session. `_fbDeleteObject` → resolve.

### Modifications de fichiers existants

- **index.html** : scripts `demo-core.js` + `demo-flag.js` non-defer en tête ;
  `demo-data.js` + `demo-mode.js` defer après `state.js` ; bouton démo dans
  `#visitorGate` ; div bandeau démo ; CSP : ajout de `media-src 'self' blob:
  https://*.googleapis.com` (la lightbox vidéo doit pouvoir lire un object URL en démo ;
  sans directive, `default-src` ne contient pas `blob:`).
- **js/firebase-init.js** : si `window.DEMO_MODE`, ne rien faire. Sinon imports
  **dynamiques** (`import()` dans `.then()`) puis affectation des globales comme
  aujourd'hui — en démo, zéro requête vers Firebase. Les sites d'appel gardent leurs
  guards `if(!window._fbDb…)` et le timer 800 ms de init.js tolère l'asynchronie.
- **js/visitor-auth.js** : `isVisitorAuthenticated()` → `true` en démo (le gate ne
  s'affiche jamais) ; `getVisitorName()` → `'Visiteur démo'`. **Ne jamais écrire
  `ev1-visitor-auth` en démo** — sinon un recruteur déverrouillerait la vraie version.
- **js/offline.js** : early-return en démo dans `saveLocalCache`, `loadLocalCache`,
  `saveExpensesCache`, `loadExpensesCache`, `saveCommentsCache`, `loadAllCommentsCache`,
  `persistQueue`, `flushQueue`. Raisons : ne pas afficher les vraies données cachées du
  device, ne pas écraser le cache réel avec du fictif, ne pas drainer une vraie
  `offlineQueue` vers le stub (perte silencieuse de données réelles).
- **js/state.js** : `offlineQueue = window.DEMO_MODE ? [] : JSON.parse(…)`.
- **js/ui.js** : 3 entrées dans `ACTIONS`.
- **sw.js** : nouveaux fichiers js dans `PRECACHE`, bump `ev1-v33` → `ev1-v34`.
- **styles.css** : bandeau démo + bouton démo du gate.

## Données démo (js/demo-data.js)

6 étapes fictives Cork → Sligo. Les `lat/lon/kmTotal` sont des **points réels de
`ALL_ROUTE_PTS`** (idx > `FRANCE_END_IDX`=2531) pour que snap GPS et progression soient
cohérents — générés par script jetable (scratchpad) lisant `route-data.js`/`CUM_KM`,
littéraux collés ensuite.

| Nœud | Contenu |
|---|---|
| `current` | `{lat, lon, kmTotal, date, ts}` — entre Westport et Sligo |
| `stages/{date}` | `{lat, lon, kmTotal, kmDay, elevGain, published:true, ts}` |
| `journals/{date}` | Textes français inventés, 2-4 phrases |
| `tracks/{date}` | `{coords, kmDay, ts}` — segments du vrai tracé sous-échantillonnés (~60-100 pts) |
| `photos/{date}/{id}` | `{url, path, ts}`, `url` = data URI SVG inline (~300 o) — les photos sont sur Firebase Storage depuis la migration (la note base64 de CLAUDE.md était obsolète) |
| `comments`, `commentLikes`, `commentReplies` | Fils fictifs avec likes/réponses |
| `bravos/{date}/{vid}` | Quelques `true` |
| `expenses/{id}` | ~10 entrées sur les catégories `EXPENSE_CATEGORIES` |
| `training`, `health`, `activity` | Quelques entrées conformes aux règles RTDB |
| `visitorAuth` | Absent (gate jamais affiché en démo) |

## Tests

`tests/demo-core.test.js` (Vitest, Node pur) : pathGet/pathSet/pathRemove (chemins
profonds, nettoyage des nœuds vides, valeurs falsy), makeSnapshot (val/exists,
indépendance par clone), isDemoRequested. Les stubs DOM/async de demo-mode.js ne sont
pas testés (couche I/O, conforme aux conventions du repo).

## Vérification end-to-end

1. **Réel intact** : ouverture normale → gate mot de passe, requêtes
   `firebasedatabase.app` visibles, aucune régression.
2. **Entrée démo** : « Découvrir la démo » → reload, pas de gate, bandeau visible,
   carte + position en Irlande, **zéro requête Firebase** dans l'onglet Réseau.
3. **Visiteur démo** : carnet 6 étapes irlandaises, photos SVG, commentaire, bravo, like.
4. **Admin démo** : onglets admin, édition journal, dépense, upload photo, publication.
5. **Isolation** : localStorage sans `ev1-visitor-auth` ni caches modifiés ; reload →
   démo réinitialisée ; « Quitter la démo » → gate normal, vraies données intactes.
6. **Lien CV** : `…/index.html#demo` en navigation privée → démo directe.
