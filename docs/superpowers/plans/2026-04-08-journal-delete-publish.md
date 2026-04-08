# Journal — Suppression et publication des entrées

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'admin de supprimer le contenu journal d'un jour et de contrôler la visibilité publique de chaque entrée (brouillon par défaut, publiée explicitement).

**Architecture:** Tout dans `index.html`. Ajout d'un champ `published` dans `state.days[date]`, filtre dans `renderJournal()` pour les visiteurs, et une barre d'actions admin par entrée journal.

**Tech Stack:** HTML/CSS/JS vanilla, Firebase RTDB via `save()` existant.

---

## Fichiers modifiés

- `index.html` uniquement :
  - CSS (section styles journal) : ajout `.j-actions`
  - JS `renderJournal()` : filtre dates non publiées si visiteur + ajout barre d'actions admin
  - JS : ajout `publishDay(date)` et `deleteJournalEntry(date)`

---

### Task 1 : CSS — barre d'actions admin dans le journal

**Files:**
- Modify: `index.html` (section CSS, après `.j-tag.sel` ligne ~159)

- [ ] **Step 1 : Ajouter le style `.j-actions`**

Dans `index.html`, après la ligne `.j-tag.sel{background:var(--green);color:#fff;border-color:var(--green)}` (ligne ~159), insérer :

```css
.j-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.j-actions .btn{font-size:12px;padding:5px 12px;border-radius:20px}
.j-badge-draft{font-size:11px;padding:2px 8px;border-radius:20px;background:#f0f0f0;color:#888;border:1px solid #ddd;display:inline-block;margin-top:6px}
.j-badge-pub{font-size:11px;padding:2px 8px;border-radius:20px;background:#e8f5e9;color:var(--green);border:1px solid var(--green);display:inline-block;margin-top:6px}
```

- [ ] **Step 2 : Vérifier visuellement** — ouvrir `index.html` dans un navigateur, se connecter en admin, vérifier qu'aucune régression CSS n'est visible (le journal n'a pas encore de boutons).

- [ ] **Step 3 : Commit**

```bash
git add index.html
git commit -m "feat(journal): add CSS for admin actions bar and publish badge"
```

---

### Task 2 : Fonctions `publishDay` et `deleteJournalEntry`

**Files:**
- Modify: `index.html` (section JS, après `togTag()` ligne ~1808)

- [ ] **Step 1 : Ajouter les deux fonctions** après `togTag()` (ligne ~1808) :

```js
function publishDay(date){
  if(!isAdmin)return;
  if(!state.days[date])return;
  state.days[date].published=!state.days[date].published;
  save();
  // Mise à jour locale du badge et du bouton sans re-render complet
  var entry=document.querySelector('#journalList .journal-entry[data-date="'+date+'"]');
  if(!entry)return;
  var badge=entry.querySelector('.j-pub-badge');
  var btn=entry.querySelector('.j-pub-btn');
  var pub=state.days[date].published;
  if(badge){badge.className=pub?'j-badge-pub':'j-badge-draft';badge.textContent=pub?'✓ Publié':'Brouillon';}
  if(btn){btn.textContent=pub?'Dépublier':'Publier';}
}

function deleteJournalEntry(date){
  if(!isAdmin)return;
  confirmDialog({
    title:'Supprimer l\'entrée journal',
    message:'Le texte, les étoiles et les tags de ce jour seront effacés. L\'étape reste sur la carte.',
    okLabel:'Supprimer'
  }).then(function(ok){
    if(!ok)return;
    delete state.journal[date];
    delete state.ratings[date];
    delete state.tags[date];
    save();
    renderJournal();
  });
}
```

- [ ] **Step 2 : Vérifier que `save()` et `confirmDialog()` sont bien disponibles** — ces fonctions existent déjà dans `index.html` (lignes ~762 et ~1300). Aucun import nécessaire.

- [ ] **Step 3 : Commit**

```bash
git add index.html
git commit -m "feat(journal): add publishDay and deleteJournalEntry functions"
```

---

### Task 3 : Filtre dans `renderJournal()` + barre d'actions admin

**Files:**
- Modify: `index.html`, fonction `renderJournal()` (ligne ~1729)

- [ ] **Step 1 : Filtrer les dates non publiées pour les visiteurs**

Remplacer la ligne :
```js
var dates=Object.keys(days).sort().reverse();
```
Par :
```js
var dates=Object.keys(days)
  .filter(function(d){return isAdmin||days[d].published===true;})
  .sort().reverse();
```

- [ ] **Step 2 : Ajouter la barre d'actions admin dans le HTML de chaque entrée**

Dans `renderJournal()`, la variable `edate` est déjà définie (ligne ~1750). Ajouter après `var edate=escAttr(date);` :

```js
var pub=!!(days[date]&&days[date].published);
var adminActionsHtml='';
if(isAdmin){
  adminActionsHtml=
    '<div class="j-actions">'+
      '<span class="'+(pub?'j-badge-pub':'j-badge-draft')+' j-pub-badge">'+(pub?'✓ Publié':'Brouillon')+'</span>'+
      '<button class="btn btn-o j-pub-btn" onclick="publishDay(\''+edate+'\')">'+
        (pub?'Dépublier':'Publier')+
      '</button>'+
      '<button class="btn btn-danger" onclick="deleteJournalEntry(\''+edate+'\')">🗑 Supprimer</button>'+
    '</div>';
}
```

- [ ] **Step 3 : Injecter `adminActionsHtml` dans le `entry.innerHTML`**

Dans l'assignation `entry.innerHTML=...` (ligne ~1774), ajouter `adminActionsHtml` à la fin, juste avant `renderStageCommentsHtml(date)` :

```js
entry.innerHTML=
  '<div class="j-date">'+dateLabel+'</div>'+
  (kmInfo?'<div class="j-stage">'+kmInfo+'</div>':'')+
  '<textarea class="j-ta" placeholder="'+placeholder+'"'+taAttr+'>'+txt+'</textarea>'+
  renderPhotosHtml(date)+
  '<div class="j-rating" id="'+taId+'">'+starsHtml+'</div>'+
  '<div class="j-meta" id="'+tmId+'">'+tagsHtml+'</div>'+
  adminActionsHtml+
  renderStageCommentsHtml(date);
```

- [ ] **Step 4 : Vérifier manuellement**
  - En mode **visiteur** (non admin) : seules les entrées avec `published: true` dans `state.days` sont visibles. Si aucune n'est publiée, le message vide apparaît.
  - En mode **admin** : toutes les entrées sont visibles, avec badge "Brouillon" ou "✓ Publié" + boutons.
  - Cliquer "Publier" → badge passe à "✓ Publié", bouton devient "Dépublier".
  - Cliquer "🗑 Supprimer" → confirm dialog → après confirmation, l'entrée disparaît du journal mais l'étape reste dans les stats (onglet Étapes et recap).

- [ ] **Step 5 : Commit**

```bash
git add index.html
git commit -m "feat(journal): filter unpublished entries for visitors, add admin publish/delete actions"
```

---

### Task 4 : Vérification message vide visiteur

**Files:**
- Modify: `index.html`, fin de `renderJournal()` (ligne ~1784)

- [ ] **Step 1 : Vérifier le message "journal vide"**

Le message vide existant s'affiche quand `!hasAny`. Avec le filtre, si toutes les entrées sont brouillon, `dates` sera vide et `hasAny` restera `false` → le message vide s'affichera correctement. Aucune modification nécessaire.

- [ ] **Step 2 : Tester ce cas** — en mode visiteur avec toutes les entrées en brouillon, vérifier que le message `"Le journal apparaîtra ici après la mise à jour de position."` s'affiche.

- [ ] **Step 3 : Push final**

```bash
git push
```

---

## Résumé des commits attendus

1. `feat(journal): add CSS for admin actions bar and publish badge`
2. `feat(journal): add publishDay and deleteJournalEntry functions`
3. `feat(journal): filter unpublished entries for visitors, add admin publish/delete actions`
4. Push final
