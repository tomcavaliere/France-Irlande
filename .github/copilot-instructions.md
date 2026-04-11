# AI Coding Instructions for EuroVelo 1 — France → Irlande

## Overview
PWA de suivi de voyage EuroVelo 1 : Chamonix → Roscoff (France) puis Cork → Sligo (Irlande).
Tom journalise, ses proches suivent en live via Firebase RTDB.

## Architecture
- **Fichier principal** : `index.html` — HTML + CSS uniquement (~650 lignes). Zéro JS inline.
- **JS** : 14 modules dans `js/` chargés via `<script>` ordinaires (pas ESM). Ordre de chargement : `route-data → state → ui → offline → admin → map-core → campings → stages → photos → comments → expenses → weather → journal → init`.
- **État global** : toutes les variables mutables dans `js/state.js`.
- **Modules purs testés** : `js/gps-core.js` (`GPSCore`) et `js/utils.js` (`Utils`).
- **Backend** : Firebase RTDB `france-irlande-bike` (région `europe-west1`).
- **PWA** : service worker `sw.js`, manifest `manifest.json`.
- **Tests** : Vitest — `npm test`. Aucun bundler, aucun jsdom.

## Modules JS principaux
| Fichier | Rôle |
|---|---|
| `js/route-data.js` | Tableaux GPS de la trace (FR + IE), `TOTAL_KM`, `FRANCE_END_IDX` |
| `js/state.js` | Variables globales + wrappers vers `Utils` |
| `js/ui.js` | Toast, confirmDialog, lightbox, syncDot, switchTab |
| `js/offline.js` | Cache localStorage, offlineQueue, tryWrite, flushQueue |
| `js/admin.js` | Auth Firebase, inactivité, profil admin, GPS |
| `js/map-core.js` | Initialisation Leaflet, updateMap, wrappers GPSCore |
| `js/campings.js` | Layers Leaflet : campings, Campspace, points d'eau |
| `js/stages.js` | Cartes étapes, recap, suppression, publication |
| `js/photos.js` | Compression, upload, suppression, rendu photos |
| `js/comments.js` | Affichage, envoi, suppression commentaires |
| `js/expenses.js` | Ajout, suppression, rendu dépenses |
| `js/weather.js` | Météo 3 jours (Open-Meteo) |
| `js/journal.js` | Rendu journal, save/flush, bravos, lazy loading |
| `js/init.js` | Bootstrap : SW, cache local, Firebase, carte |

## Conventions
- **Langue** : UI et commentaires en français.
- **Validation** : utiliser `Utils.validateExpense()`, `Utils.validateComment()`, `Utils.validateJournal()`.
- **Fetch réseau** : uniquement via `Utils.safeFetch()` — jamais `fetch()` directement.
- **Escaping HTML** : `escAttr()` / `escHtml()` (wrappers de `Utils`).
- **Tests** : toute fonction pure dans `gps-core.js` ou `utils.js` doit être testée.

## Développement
```bash
npm install   # une seule fois
npm test      # run tests
```
Ouvrir `index.html` via un serveur local (ex. Live Server) pour tester. PWA nécessite HTTPS.

## Données de référence
- **Catégories dépenses** : `Utils.EXPENSE_CATEGORIES` (liste fermée).
- **Limites de taille** : `Utils.LIMITS` (partagées avec les règles Firebase).
- **Traces GPX** : `FRANCE-TRACK.gpx`, `IRELANDE-TRACK.gpx`.
- **Règles Firebase** : `firebase.rules.json` (source de vérité).