# Admin Profile Panel — Design Spec

**Date:** 2026-04-09
**Scope:** Remplacer la barre quota verte fixe et la barre d'export journal par un panneau Profil admin accessible via un dropdown sur le bouton Admin.

---

## Contexte

Actuellement :
- Une `div.quota-bar` verte fixée en bas de page affiche le quota RTDB photos (visible admin seulement).
- Une `div#exportJournalBar` affiche les boutons d'export journal (visible admin seulement).

Ces deux éléments sont supprimés et leurs fonctionnalités consolidées dans un modal Profil.

---

## Comportement du bouton Admin

### État déconnecté
- Bouton : `🔒 Admin`
- Clic → ouvre le modal de login (comportement actuel inchangé)

### État connecté
- Bouton : `🔓 Admin`
- Clic → affiche `#adminDropdown` positionné sous le bouton, avec deux entrées :
  - `👤 Profil` → ouvre `#profileModal`
  - `🚪 Déconnexion` → appelle `logoutAdmin()`
- Clic en dehors du dropdown → ferme le dropdown
- Le dropdown se ferme après toute sélection

---

## Modal Profil (`#profileModal`)

Modal centré, fond semi-transparent par-dessus l'app. Croix de fermeture en haut à droite.

### Bloc 1 — Compte
- Email connecté (ex: `tom@exemple.com`) — lu depuis `firebase.auth().currentUser.email`
- Session restante : compte à rebours live mis à jour chaque seconde (ex: `2:47`)
  - Calcul : temps restant avant le prochain déclenchement de `logoutAdmin()` via `inactivityTimer`
  - Le `setInterval` du compte à rebours démarre à l'ouverture du modal et s'arrête à la fermeture

### Bloc 2 — Stockage RTDB
- Barre de progression visuelle colorée selon le niveau :
  - `ok` → vert, `warn` → orange, `high` → rouge clair, `block` → rouge foncé
- Texte : `N photos · X MB · Y% / 1 Go`
- Bouton "🔄 Rafraîchir" → rappelle `refreshQuotaState()` et met à jour l'affichage

### Bloc 3 — Stats rapides
- Entrées journal publiées : N (compter `state.days` où `published === true`)
- Étapes total : N (longueur de `state.stages`)
- Commentaires reçus : N (agréger tous les commentaires sur toutes les étapes depuis RTDB)

### Section Export journal (séparée visuellement, en bas du modal)
- Bouton `⬇ Exporter en .md` → appelle `exportJournal('md')`
- Bouton `⬇ Exporter en .json` → appelle `exportJournal('json')`

---

## Ce qui est supprimé

| Élément | Remplacement |
|---|---|
| `div.quota-bar` + styles CSS | Bloc Stockage dans `#profileModal` |
| `div#exportJournalBar` + styles CSS | Section Export dans `#profileModal` |
| `refreshQuotaBar()` | `refreshQuotaState()` (sans DOM) |

---

## Ce qui est ajouté

### `div#adminDropdown`
- Positionné sous `#adminBtn` (absolute, aligné à droite)
- Caché par défaut, affiché au clic sur le bouton Admin (connecté)
- Deux entrées : Profil, Déconnexion

### `div#profileModal`
- Structure : overlay + rectangle centré
- Croix de fermeture `#profileModalClose`
- Trois blocs + section export

### `refreshQuotaState()`
- Remplace `refreshQuotaBar()`
- Lit `photos/` depuis RTDB, calcule `computeQuotaBytes` + `quotaLevel`
- Met à jour `_quotaState` uniquement — ne touche pas au DOM
- Le modal lit `_quotaState` pour son affichage

### `openProfileModal()`
- Affiche `#profileModal`
- Peuple l'email depuis `window._fbAuth.currentUser.email`
- Lance le `setInterval` du compte à rebours (1s)
- Appelle `refreshQuotaState()` puis met à jour le bloc Stockage
- Charge les stats (étapes, journal publié) depuis `state`, commentaires depuis RTDB

### `closeProfileModal()`
- Cache `#profileModal`
- Stoppe le `setInterval` du compte à rebours

---

## Ce qui migre

- `exportJournal(fmt)` : fonction inchangée, appelée depuis les boutons du modal
- `_quotaState` : variable globale conservée, alimentée par `refreshQuotaState()`

---

## Tests

Aucun test nouveau requis — toutes les modifications sont DOM-only. Les fonctions pures (`computeQuotaBytes`, `quotaLevel`, `formatBytes`) ne sont pas modifiées.
