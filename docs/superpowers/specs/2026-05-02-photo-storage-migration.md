# Photo Storage — Migration RTDB → Firebase Storage

## Contexte

Les photos du journal étaient stockées en base64 dans la Realtime Database (RTDB) sous `photos/{date}/{id}`. Cette approche entraîne un téléchargement excessif de données lors de la connexion au site et une forte consommation mémoire côté navigateur.

Ce document décrit le nouveau modèle cible, le comportement de transition, et la procédure de migration.

---

## Modèle de données

### Format legacy (RTDB base64)
```
photos/{date}/{id} = "<base64 string>"
```

### Nouveau format (Storage + métadonnées RTDB)
```
Storage : photos/{date}/{id}.jpg       ← fichier JPEG binaire
RTDB    : photos/{date}/{id} = {
  "url":  "https://storage.googleapis.com/...",   // URL de téléchargement publique
  "path": "photos/2026-05-02/p_123.jpg",           // chemin Storage (pour la suppression)
  "ts":   1746000000000                             // timestamp création (ms)
}
```

Les deux formats coexistent pendant la période de transition — le frontend les gère de façon transparente.

---

## Helpers de lecture — `Utils.getPhotoUrl` / `Utils.getPhotoPath`

Tout accès à la valeur d'une photo doit passer par ces helpers (exposés dans `window.Utils`) :

```js
// Retourne l'URL ou la chaîne base64 selon le format détecté.
// Retourne '' si la valeur est invalide ou null.
Utils.getPhotoUrl(photo)

// Retourne le chemin Storage (nouveau format uniquement).
// Retourne '' pour le format legacy ou si la valeur est invalide.
Utils.getPhotoPath(photo)
```

Ne jamais accéder directement à `photos[date][id]` comme source d'image.

---

## Flux upload (nouveau)

1. L'admin sélectionne une ou plusieurs images.
2. Chaque image est redimensionnée (max 960 px) et compressée en JPEG (qualité 0,65) via `<canvas>.toBlob()`.
3. Le blob est uploadé dans Firebase Storage sous `photos/{date}/{id}.jpg`.
4. L'URL de téléchargement est récupérée via `getDownloadURL()`.
5. Les métadonnées `{ url, path, ts }` sont écrites dans la RTDB.
6. Le cache mémoire (`photos[date][id]`) est mis à jour avec l'objet métadonnées.
7. L'UI est patchée via `patchMedia(date)`.

---

## Flux suppression

### Nouveau format (objet avec `path`)
1. Suppression du fichier dans Firebase Storage via `_fbDeleteObject`.
2. Suppression de l'entrée RTDB via `_fbRemove`.
3. Mise à jour du cache et de l'UI.

### Format legacy (chaîne base64)
1. Suppression de l'entrée RTDB uniquement (pas de fichier Storage à supprimer).
2. Mise à jour du cache et de l'UI.

---

## Règles de sécurité

### RTDB (`firebase.rules.json`)
Le nœud `photos/{date}/{id}` accepte désormais :
- une chaîne base64 (< 500 000 chars) — compatibilité legacy
- **ou** un objet `{ url, path, ts }` validé strictement

### Storage (`storage.rules`)
```
match /photos/{date}/{id} {
  allow read: if true;                                    // lecture publique
  allow write: if request.auth != null                   // upload admin uniquement
               && request.resource.size < 10 * 1024 * 1024;  // max 10 MB
  allow delete: if request.auth != null;
}
```

---

## Migration des données existantes

### Prérequis
- Node.js ≥ 18
- Clé de service Firebase Admin (jamais commitée)
- `npm install firebase-admin` (hors du projet, dans un répertoire temporaire)

### Procédure

```bash
# 1. Télécharger la clé de service admin depuis la console Firebase :
#    Project Settings → Service Accounts → Generate new private key
#    Sauvegarder sous /tmp/serviceAccountKey.json

# 2. Tester en mode dry-run (aucune écriture)
node scripts/migrate-photos.js --key=/tmp/serviceAccountKey.json --dry-run

# 3. Migrer réellement
node scripts/migrate-photos.js --key=/tmp/serviceAccountKey.json
```

Le script est **idempotent** : les entrées déjà migrées (format objet) sont ignorées. En cas d'échec partiel, relancer le script reprend là où il s'est arrêté.

### Résultat attendu
```
── Migration complete ──────────────────────────────────
  Total entries examined : 47
  Migrated               : 45
  Skipped (already done) : 2
  Failed                 : 0
────────────────────────────────────────────────────────
```

---

## Nettoyage post-migration

Une fois toutes les données migrées et la migration validée en production :

1. Dans `js/utils.js` : la branche `typeof photo === 'string'` de `getPhotoUrl` peut être retirée.
2. Dans `firebase.rules.json` : supprimer la branche `newData.isString()` de la règle photos.
3. Dans `js/photos.js` : supprimer la variable `PHOTO_UPLOAD_INITIAL_QUALITY` si plus nécessaire.
4. Documenter la fin de la période de transition dans ce fichier.

---

## Risques et points d'attention

| Risque | Mitigation |
|---|---|
| Fichier Storage orphelin si la suppression RTDB échoue | Logs d'erreur explicites ; un audit manuel est possible via la console Firebase |
| Coût download Storage | Photos lazy-loadées via `IntersectionObserver` ; compression JPEG à la source |
| URL de téléchargement expirante | Les URLs `storage.googleapis.com` publiques n'expirent pas |
| Migration partielle laissant des formats mixtes | Le frontend supporte les deux formats indéfiniment jusqu'au nettoyage |
