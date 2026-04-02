# EuroVelo 1 — Bikepacking Cork → Sligo

Application web PWA de suivi de voyage bikepacking, conçue pour que Tom puisse tenir son journal de route et que ses proches puissent suivre l'aventure en temps réel.

---

## Vue d'ensemble

| Élément | Valeur |
|---|---|
| Itinéraire | Cork → Sligo (EuroVelo 1) |
| Distance totale | 1734.3 km |
| Dénivelé total | +11 041 m |
| Nombre d'étapes | 28 |
| Hébergement | `https://tomcavaliere.github.io/France-Irlande/` |
| Firebase projet | `france-irlande-bike` |
| Firebase DB | `https://france-irlande-bike-default-rtdb.europe-west1.firebasedatabase.app` |

---

## Fichiers du projet

```
index.html      — Application complète (HTML + CSS + JS, ~1100 lignes)
sw.js           — Service Worker pour le mode hors-ligne
manifest.json   — Manifest PWA (icône, couleurs, mode standalone)
IRELANDE-TRACK.gpx — Trace GPX de la route complète
```

Tout le code est dans `index.html`. Il n'y a pas de build system, pas de framework, pas de dépendances npm — c'est du HTML/CSS/JS vanilla déployé directement sur GitHub Pages.

---

## Architecture

### Données Firebase (Realtime Database)

```
/state
  completed: { 0: true, 1: true, ... }   — étapes cochées
  journal:   { 0: "texte...", ... }       — entrées journal
  ratings:   { 0: 4, ... }               — notes étoiles (1-5)
  tags:      { 0: ["Pluie", "Pub"], ... } — tags d'ambiance

/photos
  {stageIndex}: { {photoId}: "data:image/jpeg;base64,..." }

/comments
  {stageIndex}: { {commentId}: { name, text, ts } }

/expenses
  {expenseId}: { date, cat, amount, desc, ts }
```

### Stockage local (localStorage)

```
ev1-state-cache   — copie du state pour affichage hors-ligne instantané
offlineQueue      — modifications en attente de sync Firebase
```

### Persistance session (sessionStorage)

```
adminActive = '1'  — conserve le mode admin après refresh de page
```

---

## Fonctionnalités

### Onglets (tous utilisateurs)
- **Carte** — trace GPX sur Leaflet, position des étapes, stats km/étapes en overlay
- **Étapes** — liste des 28 étapes avec km, dénivelé, hébergements ; cocher = marquer comme fait
- **Journal** — entrées par étape (uniquement les étapes cochées), texte + photos + étoiles + tags + commentaires des proches
- **Infos** — informations pratiques sur l'Irlande (météo, hébergement, bivouac, budget, urgences)

### Onglet admin uniquement
- **Dépenses** — suivi du budget : formulaire date/catégorie/montant/description, résumé total + moyenne/jour + répartition par catégorie

### Mode admin
- Accès via bouton `🔒 Admin` en haut à droite
- Mot de passe : `velo2025` (ligne 396 de index.html — **visible dans le source public**)
- Session conservée dans `sessionStorage` (survit au refresh, pas à la fermeture de l'onglet)
- Déconnexion automatique après **3 minutes d'inactivité**
- En mode admin : édition journal, cochage étapes, upload photos, suppression commentaires/dépenses

### Mode hors-ligne
- Le service worker (`sw.js`) met en cache `index.html` et Leaflet au premier chargement
- Le state est sauvegardé dans `localStorage` à chaque modification → affichage instantané même sans réseau
- Les modifications admin faites hors-ligne sont mises en queue et envoyées automatiquement au retour du réseau
- **Point de sync dans le header** : 🟢 connecté / 🟠 hors-ligne / 🔵 synchronisation en cours
- **Limite** : photos, commentaires et dépenses ne sont pas disponibles hors-ligne (pas de cache Firebase)

---

## Points techniques importants

### Photos
- Stockées en **base64 dans Firebase Realtime Database** (pas Firebase Storage, qui est payant)
- Compressées côté client avant upload : max 1200px, qualité JPEG 72% (~150-250 Ko par photo)
- Chargées séparément du state principal via `/photos` pour ne pas bloquer l'app
- **Attention** : avec beaucoup de photos, la taille de la DB peut croître vite (quota gratuit : 1 Go)

### Sauvegarde journal
- Debounce de **60 secondes** sur les frappes clavier → Firebase n'est écrit qu'après 60s d'inactivité
- `saveNow()` pour les actions immédiates (cocher/décocher étape, supprimer)
- `beforeunload` force une sauvegarde à la fermeture — **ne fonctionne pas sur iOS Safari**
- `saveLocalCache()` écrit dans `localStorage` à chaque changement comme filet de sécurité

### Commentaires
- Rattachés à chaque étape (pas un espace global)
- Visibles par tous, postables par tous (prénom libre, sans compte)
- Supprimables uniquement en mode admin

### Règles Firebase actuelles
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
> Écriture entièrement ouverte — la protection repose uniquement sur le mot de passe dans le code.

---

## Faiblesses connues (par priorité)

| Priorité | Problème | Impact |
|---|---|---|
| 🔴 Haute | Mot de passe admin visible dans le source HTML public | N'importe qui peut l'inspecter et modifier les données |
| 🔴 Haute | Règles Firebase `.write: true` sans auth | N'importe qui peut écrire directement via l'API Firebase |
| 🟠 Moyenne | `beforeunload` ignoré sur iOS Safari | Risque de perte des 60 dernières secondes de journal |
| 🟠 Moyenne | Toutes les photos se chargent au démarrage | Lent si beaucoup de photos |
| 🟡 Faible | Pas de confirmation avant suppression | Suppression accidentelle possible |
| 🟡 Faible | Pas de notification pour les nouveaux commentaires | Tom ne sait pas si quelqu'un a écrit |
| 🟡 Faible | Photos/commentaires/dépenses non disponibles hors-ligne | Donnée partielle en zone sans réseau |

---

## Idées d'amélioration futures

- **Sécurité** : passer le mot de passe admin côté Firebase Auth (email/password) au lieu de le hardcoder dans le HTML
- **Notifications push** : alerter Tom quand un commentaire est posté (via Firebase Cloud Messaging)
- **Météo** : afficher les prévisions de l'étape suivante via [Open-Meteo](https://open-meteo.com) (API gratuite, sans clé)
- **Sauvegarde journal iOS** : sauvegarder sur `visibilitychange` (fonctionne sur Safari) en plus de `beforeunload`
- **Lazy loading photos** : ne charger les photos d'une étape que quand elle est affichée à l'écran
- **Export PDF** : générer un carnet de voyage à la fin du trip avec toutes les entrées + photos

---

## Catégories de dépenses

`Hébergement` · `Nourriture` · `Transport` · `Équipement` · `Loisirs` · `Autre`

## Tags journal disponibles

`Beau temps` · `Pluie` · `Vent` · `Dur` · `Génial` · `Pub` · `Camping` · `Bivouac` · `Photos`
