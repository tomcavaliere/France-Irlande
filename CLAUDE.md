# EuroVelo 1 — Bikepacking Cork → Sligo

PWA de suivi de voyage. Tom tient son journal, ses proches suivent en temps réel.

## Infos clés

- **Stack** : HTML/CSS/JS vanilla dans `index.html` (~1250 lignes). Pas de build, pas de framework.
- **Déploiement** : GitHub Pages — `https://tomcavaliere.github.io/France-Irlande/`
- **Firebase** : projet `france-irlande-bike`, RTDB europe-west1. Lecture publique, écriture auth.
- **28 étapes**, 1734 km, +11 041 m de dénivelé

## Fichiers

```
index.html          — tout le code
sw.js               — service worker hors-ligne
manifest.json       — PWA manifest
IRELANDE-TRACK.gpx  — trace GPX
```

## Points non-évidents (à ne pas casser)

- **Photos** : base64 dans RTDB (pas Firebase Storage — payant). Lazy load via IntersectionObserver, listeners désabonnés à chaque `renderJournal`.
- **Journal** : debounce 60s + `flushState()` sur `beforeunload` ET `visibilitychange:hidden` (iOS Safari).
- **Hors-ligne** : state dans localStorage + offlineQueue. Photos/commentaires/dépenses NON mis en cache.
- **Admin** : déconnexion auto après 3 min d'inactivité.

## Faiblesses connues

- Pas de confirmation avant suppression
- Photos/commentaires/dépenses indisponibles hors-ligne
- Quota RTDB non surveillé (1 Go gratuit)
- Pas d'export journal

## Catégories dépenses
`Hébergement` `Nourriture` `Transport` `Équipement` `Loisirs` `Autre`

## Tags journal
`Beau temps` `Pluie` `Vent` `Dur` `Génial` `Pub` `Camping` `Bivouac` `Photos`

## Conventions Git

- **Commits atomiques** : un commit = une seule modif logique (une feature, un fix, un refacto). Jamais de mélange.
- **Conventional Commits en anglais** :
  - `feat:` nouvelle fonctionnalité
  - `fix:` correction de bug
  - `refactor:` réécriture sans changement de comportement
  - `chore:` maintenance (deps, config, etc.)
  - `docs:` documentation uniquement
- **Avant chaque `git commit`** : vérifier qu'il ne reste pas de `console.log()` de debug ni de blocs de code commentés inutiles dans le diff stagé.
- **Ne jamais utiliser `--no-verify`** ni contourner les hooks sans demande explicite.

## Qualité du code (stack vanilla JS)

- **Pas de `any` implicite déguisé** : même en JS vanilla, documenter via JSDoc (`@param`, `@returns`) dès qu'un type n'est pas évident. Si le type est inconnu, valider avec un type guard (`typeof`, `Array.isArray`, `instanceof`) avant usage.
- **Pas d'erreur silencieuse** : toute fonction `async` / tout `.then()` DOIT avoir un `try/catch` ou `.catch()` avec au minimum un `console.error('[contexte]', err)` nommé. Pas de `catch {}` vide.
- **Séparation logique UI / logique métier / I/O** : ce projet tient tout dans [index.html](index.html), mais à l'intérieur garder la séparation par sections de fonctions :
  - rendu DOM (`render*`)
  - état et logique métier (mutations de `state`, calculs)
  - accès Firebase / localStorage / réseau (`flushState`, listeners RTDB, `offlineQueue`)
  - Ne pas manipuler le DOM depuis une fonction d'I/O, et inversement.
- **Ne jamais casser les points non-évidents** listés plus haut (photos base64, debounce journal, désabonnement listeners, etc.).

## Tests et QA

- **Tests existants** : [tests/utils.test.js](tests/utils.test.js) — toute modification de [js/utils.js](js/utils.js) ou d'une fonction utilitaire pure DOIT être accompagnée d'un test ajouté ou mis à jour dans ce fichier.
- **Exécution** : lancer les tests avant de considérer une tâche terminée. Si un test échoue, analyser la stack trace, corriger, relancer — ne pas laisser au user le soin de découvrir la casse.
- **Pas d'appel réseau réel dans les tests** : mocker Firebase RTDB et toute API tierce (météo, etc.). Les tests doivent tourner hors-ligne.
- **Nouvelles fonctions métier pures** (calculs distance, dénivelé, formatage dépenses, etc.) → test obligatoire. Code purement DOM/rendu → test non requis.
