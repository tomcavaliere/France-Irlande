# Vidéos dans le journal — Design spec

**Date :** 2026-04-13
**Statut :** approuvé

## Contexte

Tom journalise son voyage à vélo (France → Irlande). Les photos sont déjà supportées (base64 dans RTDB). Il veut pouvoir ajouter de courts clips vidéo depuis son téléphone, affichés dans la même grille que les photos.

## Contraintes clés

- Stocker les vidéos en base64 dans RTDB est impossible (un clip de 30s = 5-15 MB, limite RTDB = 490 KB par entrée).
- Solution retenue : **Firebase Storage** pour les fichiers vidéo, **RTDB** pour l'URL de téléchargement uniquement.
- Les vidéos n'affectent pas le quota RTDB (seule une URL ~100 chars y est stockée).
- Plan Firebase Blaze activé (budget €10).

## Modèle de données

### Firebase Storage (nouveau)
```
videos/{date}/{id}    ← fichier vidéo brut (mp4, mov, webm…), max 200 MB
```

### Firebase RTDB (nouveau nœud)
```
videos/$date/$id      ← URL de téléchargement Storage (string < 500 chars)
```

Les `photos/$date/$id` (base64) restent **inchangées**. Aucune migration.

## Règles de sécurité

### RTDB (`firebase.rules.json`)
```json
"videos": {
  ".read": true,
  "$date": {
    "$id": {
      ".write": "auth != null",
      ".validate": "newData.isString() && newData.val().length < 500"
    }
  }
}
```

### Firebase Storage (`storage.rules`)
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /videos/{date}/{id} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.resource.size < 200 * 1024 * 1024;
      allow delete: if request.auth != null;
    }
  }
}
```

Les deux fichiers sont versionnés dans le repo (source de vérité). Déploiement manuel via Firebase Console.

## Architecture JS

### Nouveau module `js/videos.js`
Miroir de `photos.js`, même structure de responsabilités :

| Fonction | Rôle |
|---|---|
| `uploadVideo(date)` | Ouvre `<input type="file" accept="video/*">`, upload vers Storage, écrit l'URL dans RTDB |
| `deleteVideo(date, id)` | Supprime dans Storage ET dans RTDB, confirmation via `confirmDialog` |

Variable d'état globale :
```js
var videos = {};  // { [date]: { [id]: url } }
```

Chargé lazy par date via `loadStageContent` (même IntersectionObserver que photos).

Protections identiques à photos :
- Vérifie `isAdmin`, `isOnline`
- Bloque si `_quotaState.level === 'block'` (note : ce quota surveille le RTDB, pas Firebase Storage — c'est une protection UI par cohérence, pas une vraie limite Storage)

### Upload avec progression
Upload vidéo pouvant durer 30-60s sur réseau mobile → indicateur de progression (pourcentage ou spinner) via l'API `uploadBytesResumable` de Firebase Storage.

### `renderMediaHtml(date)` (remplace `renderPhotosHtml`)
- Fusionne `photos[date]` (base64) et `videos[date]` (URL), triés par `id` (timestamp → ordre d'upload)
- Photos : `<img>` comme aujourd'hui
- Vidéos : `<video preload="metadata" muted playsinline>` + overlay CSS `▶` (première frame auto comme vignette)
- Bouton ✕ admin sur les deux types
- Taille vignette identique : 90×90px

### `patchMedia(date)` (remplace `patchPhotos`)
Même logique de remplacement DOM ciblé.

## UX admin — bouton d'ajout

Deux boutons côte à côte dans la grille (remplacent l'unique bouton "📷 Ajouter") :

```
[ 📷 Photo ]  [ 🎥 Vidéo ]
```

Même style `.j-photo-add` (90×90, bordure pointillée). Actions distinctes : `uploadPhoto` (inchangée) et `uploadVideo` (nouvelle).

## Lightbox — mise à jour minimale

Actuellement : `<img id="lightboxImg">` uniquement.

Devient : `<img id="lightboxImg">` + `<video id="lightboxVideo" controls autoplay>`, l'un masqué selon le type.

- `openLightbox(id, date, type)` — 3e argument `type` ('photo' | 'video')
- Fermeture → `video.pause()` pour couper le son

## SDK Firebase Storage

Ajouter le script CDN Firebase Storage dans `index.html` et initialiser `getStorage(app)`. L'app utilise déjà l'app Firebase initialisée — Storage se branche dessus.

## Tests

Aucun nouveau test Vitest requis :
- `videos.js` est code DOM + I/O (même règle que `photos.js`, hors périmètre Vitest)
- `renderMediaHtml` est code DOM, non testé
- Les 34 tests existants continuent de passer sans modification

## Déploiement des règles

1. **RTDB** : Firebase Console → Realtime Database → Règles → coller `firebase.rules.json` → Publier
2. **Storage** : Firebase Console → Build → Storage → Commencer (activer une fois), puis Storage → Règles → coller `storage.rules` → Publier
