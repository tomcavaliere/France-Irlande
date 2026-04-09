# Journal visiteur & Bravos — Design Spec

**Date:** 2026-04-09
**Scope:** Évolution de la vue journal : suppression étoiles/tags, masquage textarea vide pour visiteur, ajout compteur Bravos avec bouton "Maith sibh!".

---

## Ce qui est supprimé

| Élément | Détail |
|---|---|
| `state.ratings` | Objet ratings par date — abandonné (données RTDB non nettoyées) |
| `state.tags` | Objet tags par date — abandonné (données RTDB non nettoyées) |
| `setRat(date, n)` | Fonction de notation — supprimée |
| `togTag(date, t)` | Fonction de toggle tag — supprimée |
| Rendu `starsHtml` | Boucle de rendu des étoiles dans `renderJournal()` — supprimée |
| Rendu `tagsHtml` | Boucle de rendu des tags dans `renderJournal()` — supprimée |
| `<div class="j-rating">` | Conteneur étoiles dans le HTML de chaque entrée — supprimé |
| `<div class="j-meta">` | Conteneur tags dans le HTML de chaque entrée — supprimé |
| CSS `.j-star`, `.j-star.on` | Styles étoiles — supprimés |
| CSS `.j-tag`, `.j-tag.sel`, `.j-meta` | Styles tags — supprimés |
| Constante `tags` | Tableau des tags disponibles — supprimé |
| Variables `taId`, `tmId` | IDs DOM étoiles/tags — supprimées |

Les données existantes dans RTDB (`state/ratings`, `state/tags`) sont abandonnées sans nettoyage.

---

## Zone de texte journal

### Visiteur
- Si `txt` est vide ou absent → le `<textarea>` n'est **pas rendu**
- Si `txt` est non vide → `<textarea readonly>` affiché normalement

### Admin
- Le `<textarea>` est **toujours affiché**, vide ou non
- Placeholder : `"Raconte ta journée..."`
- Comportement d'écriture inchangé (`oninput` → `state.journal[date]` → `save()`)

---

## Bravos

### Stockage RTDB

Nœud : `bravos/$date/$visitorId: true`

Règles Firebase à ajouter dans `firebase.rules.json` :
```json
"bravos": {
  ".read": true,
  "$date": {
    "$visitorId": {
      ".write": "!data.exists()",
      ".validate": "newData.val() === true"
    }
  }
}
```
- Lecture publique
- Écriture publique uniquement si le nœud n'existe pas encore (`!data.exists()`) → empêche de modifier ou supprimer un bravo
- La valeur doit être `true`

### Identification visiteur

- Clé localStorage : `ev1_visitor_id`
- Générée au premier vote via `crypto.randomUUID()` (fallback : `Math.random().toString(36).slice(2)`)
- Persistée indéfiniment dans localStorage

### Fonction `getVisitorId()`

```js
function getVisitorId(){
  var k='ev1_visitor_id';
  var id=localStorage.getItem(k);
  if(!id){
    id=crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
    localStorage.setItem(k,id);
  }
  return id;
}
```

### Affichage

Positionné dans chaque entrée journal : **sous le texte, au-dessus des commentaires**.

**Visiteur (non voté) :**
```html
<div class="j-bravos">
  <button class="j-bravo-btn" onclick="addBravo('2026-05-01')">Maith sibh! 👏</button>
  <span class="j-bravo-count">12</span>
</div>
```

**Visiteur (déjà voté) :**
```html
<div class="j-bravos">
  <button class="j-bravo-btn" disabled>Maith sibh! 👏</button>
  <span class="j-bravo-count">13</span>
</div>
```

**Admin :**
```html
<div class="j-bravos">
  <span class="j-bravo-count">👏 13</span>
</div>
```

### Chargement des bravos

Dans `renderJournal()`, pour chaque entrée, après injection du HTML :
- Appel de `loadBravos(date)` qui pose un listener `onValue('bravos/'+date)`
- Le listener met à jour le compteur et l'état du bouton dans le DOM de l'entrée
- Le listener est désabonné à chaque appel de `renderJournal()` (même pattern que les photos — stocker les unsubscribe dans un tableau `_bravoListeners`)

### Fonction `loadBravos(date)`

```js
function loadBravos(date){
  var ref=window._fbRef(window._fbDb,'bravos/'+date);
  var unsub=window._fbOnValue(ref,function(snap){
    var data=snap.val()||{};
    var count=Object.keys(data).length;
    var vid=getVisitorId();
    var voted=!!data[vid];
    var entry=document.querySelector('.journal-entry[data-date="'+date+'"]');
    if(!entry)return;
    var countEl=entry.querySelector('.j-bravo-count');
    var btn=entry.querySelector('.j-bravo-btn');
    if(countEl)countEl.textContent=isAdmin?'👏 '+count:count;
    if(btn)btn.disabled=voted;
  });
  _bravoListeners.push(unsub);
}
```

### Fonction `addBravo(date)`

```js
function addBravo(date){
  var vid=getVisitorId();
  var ref=window._fbRef(window._fbDb,'bravos/'+date+'/'+vid);
  window._fbSet(ref,true).catch(function(err){
    console.error('[addBravo]',err);
  });
}
```

### Nettoyage listeners

Au début de `renderJournal()`, désabonner tous les listeners bravos existants :
```js
(_bravoListeners||[]).forEach(function(u){u();});
_bravoListeners=[];
```

---

## CSS à ajouter

```css
.j-bravos{display:flex;align-items:center;gap:8px;margin:8px 0;}
.j-bravo-btn{background:#f0f4ff;border:1px solid #c5d0f0;border-radius:20px;padding:6px 14px;font-size:14px;cursor:pointer;}
.j-bravo-btn:disabled{opacity:.45;cursor:default;}
.j-bravo-count{font-size:14px;color:var(--text-light);}
```

---

## Tests

Aucun test nouveau requis — modifications DOM-only et RTDB. Les fonctions pures ne sont pas modifiées.
