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
