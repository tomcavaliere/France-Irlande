# biketrip — France → Irlande

PWA de suivi de voyage bikepacking en temps réel (Tom + proches), déployée sur GitHub Pages.

## Stack

- Frontend: HTML/CSS/JS vanilla (sans bundler)
- Carte: Leaflet 1.9.4
- Backend: Firebase Realtime Database + Firebase Auth + Firebase Storage (vidéos)
- Tests: Vitest
- Lint: ESLint 9 (flat config)
- CI: GitHub Actions (`lint` + `test`)

## Arborescence principale

- `/index.html` : shell applicatif + structure UI
- `/styles.css` : styles globaux
- `/sw.js` : service worker PWA
- `/manifest.json` : manifeste PWA
- `/js/` : modules applicatifs (bootstrap, UI, map, journal, offline, etc.)
- `/tests/` : tests unitaires Vitest sur la logique pure
- `/firebase.rules.json` : règles de sécurité RTDB (source de vérité)

## Démarrage local

```bash
npm ci
npm run lint
npm test
```

Le projet n’a pas de build step: les fichiers sont servis tels quels.

## Runbook qualité

Avant toute PR:

1. `npm ci`
2. `npm run lint`
3. `npm test`
4. Vérifier absence de logs de debug et code mort dans le diff

## Conventions

- Architecture en séparation stricte:
  - rendu DOM
  - logique métier/état
  - I/O (Firebase, réseau, offline queue)
- Les modules `*-core.js` restent purs (pas de DOM, pas d’I/O)
- Toute requête réseau applicative passe par `Utils.safeFetch` (pas de `fetch()` direct)
- Commits atomiques + Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`)

## Sécurité

- CSP active dans `index.html` (scripts inline désactivés)
- Échappement HTML/attribut via `Utils.escHtml` / `Utils.escAttr`
- Règles Firebase strictes et versionnées dans `firebase.rules.json`

## Déploiement

- Déploiement GitHub Pages: `https://tomcavaliere.github.io/France-Irlande/`
