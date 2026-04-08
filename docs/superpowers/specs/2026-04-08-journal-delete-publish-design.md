# Design — Suppression et publication des entrées journal

**Date** : 2026-04-08  
**Scope** : Journal uniquement (pas la carte, pas les stats)

## Contexte

Le journal affiche une entrée par date présente dans `state.days`. Deux besoins :
1. Pouvoir supprimer le contenu journal d'un jour (texte, étoiles, tags) sans effacer l'étape de la carte/stats.
2. Contrôler la visibilité publique : par défaut une entrée est invisible (brouillon), l'admin la publie explicitement.

## Structure des données

`state.days[date]` reçoit un champ optionnel `published: boolean`.

- Absence du champ (ou `false`) = brouillon → invisible pour les visiteurs
- `published: true` = visible publiquement
- Aucune migration nécessaire : les étapes existantes sans ce champ seront brouillon par défaut

```js
// Exemple
state.days["2025-06-01"] = {
  lat: 48.5, lon: -2.1,
  kmTotal: 312, kmDay: 87,
  note: "Quimper",
  ts: 1748736000000,
  published: true   // nouveau champ
}
```

## Comportement mode admin

Chaque entrée journal affiche une barre d'actions (visible uniquement si `isAdmin`) :

### Bouton Publier / Dépublier
- Si `!state.days[date].published` → bouton **"Publier"**
  - Action : `state.days[date].published = true` → `save()` → mise à jour locale du bouton
- Si `state.days[date].published === true` → bouton **"Dépublier"**
  - Action : `state.days[date].published = false` → `save()` → mise à jour locale

### Bouton Supprimer le journal
- Ouvre la `confirmDialog` existante (`title: "Supprimer l'entrée journal"`, `message: "Le texte, les étoiles et les tags de ce jour seront effacés. L'étape reste sur la carte."`)
- Si confirmé :
  - `delete state.journal[date]`
  - `delete state.ratings[date]`
  - `delete state.tags[date]`
  - `save()`
  - Retire l'entrée du DOM (ou re-render)
- **Ne touche pas** `state.days[date]` — la position, kmDay, kmTotal restent intacts

## Comportement mode visiteur

`renderJournal()` filtre les dates :

```js
// Avant (affiche tout)
var dates = Object.keys(days).sort().reverse();

// Après (filtre si non admin)
var dates = Object.keys(days)
  .filter(function(d) { return isAdmin || days[d].published === true; })
  .sort().reverse();
```

Aucun indicateur "brouillon" ou "non publié" n'est visible côté public.

## Ce qui ne change pas

- `state.days[date]` reste intact après suppression journal → carte, stats, recap inchangés
- La logique debounce/flush (`save()`, `beforeunload`, `visibilitychange`) reste inchangée
- Photos, commentaires, dépenses ne sont pas affectés par la publication
- `renderStages()` (onglet Étapes) n'est pas filtré — il affiche toujours toutes les étapes

## Fichiers modifiés

- `index.html` uniquement :
  - `renderJournal()` : filtre + ajout barre d'actions admin
  - Nouvelle fonction `publishDay(date)` : toggle published + save
  - Nouvelle fonction `deleteJournalEntry(date)` : supprime journal/ratings/tags + save

## Hors scope

- Export journal (déjà existant, non modifié)
- Suppression de `state.days[date]` (étape entière)
- Publication par lot
