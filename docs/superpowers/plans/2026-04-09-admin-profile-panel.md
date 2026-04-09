# Admin Profile Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la `quota-bar` fixe et la `exportJournalBar` par un dropdown sur le bouton Admin (connecté) qui ouvre un modal Profil avec infos compte, stockage RTDB, stats rapides et export journal.

**Architecture:** Tout dans `index.html` (fichier unique, vanilla JS/CSS). On supprime les deux barres existantes, on ajoute le dropdown `#adminDropdown` ancré au bouton Admin, et le modal `#profileModal` centré avec trois blocs + section export. La logique quota est extraite dans `refreshQuotaState()` (sans DOM) que le modal consomme.

**Tech Stack:** HTML/CSS/JS vanilla, Firebase RTDB (déjà initialisé via `window._fbGet`, `window._fbRef`, `window._fbDb`), Vitest (aucun test nouveau — tout DOM-only).

---

### Task 1 : Supprimer les CSS et éléments DOM des barres obsolètes

**Files:**
- Modify: `index.html:238-245` (CSS `.quota-bar`)
- Modify: `index.html:399` (div `#quotaBar`)
- Modify: `index.html:475-478` (div `#exportJournalBar`)
- Modify: `index.html:598-599` (référence `expBar` dans `setAdminUI`)

- [ ] **Step 1 : Supprimer les règles CSS `.quota-bar`**

Dans `index.html`, supprimer les lignes 238–245 :
```css
.quota-bar{position:fixed;left:0;right:0;bottom:0;z-index:1500;display:none;
  background:rgba(26,94,31,.95);color:#fff;font-size:11px;padding:6px 12px;
  text-align:center;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  padding-bottom:calc(6px + env(safe-area-inset-bottom,0px))}
.quota-bar.vis{display:block}
.quota-bar.warn{background:rgba(230,126,34,.95)}
.quota-bar.high{background:rgba(231,76,60,.95)}
.quota-bar.block{background:#c0392b}
```

- [ ] **Step 2 : Supprimer le div `#quotaBar`**

Supprimer la ligne 399 :
```html
<div class="quota-bar" id="quotaBar">📊 —</div>
```

- [ ] **Step 3 : Supprimer le div `#exportJournalBar`**

Supprimer les lignes 475–478 :
```html
<div id="exportJournalBar" style="display:none;padding:0 12px 8px">
  <button class="btn btn-p" style="width:100%" onclick="exportJournal('md')">📥 Exporter le journal (.md)</button>
  <button class="btn" style="width:100%;margin-top:6px" onclick="exportJournal('json')">📦 Exporter (.json complet)</button>
</div>
```

- [ ] **Step 4 : Retirer la référence `expBar` dans `setAdminUI`**

Dans `setAdminUI`, supprimer les deux lignes qui gèrent `exportJournalBar` :
```js
// SUPPRIMER ces deux lignes :
var expBar=document.getElementById('exportJournalBar');
if(expBar)expBar.style.display=on?'block':'none';
```

- [ ] **Step 5 : Vérifier que l'app se charge sans erreur console**

Ouvrir `index.html` dans un navigateur (ou via un serveur local). Vérifier : aucune erreur JS dans la console, la barre verte n'apparaît plus.

- [ ] **Step 6 : Commit**

```bash
git add index.html
git commit -m "refactor: remove quota-bar and exportJournalBar DOM elements"
```

---

### Task 2 : Ajouter les CSS du dropdown et du modal Profil

**Files:**
- Modify: `index.html` (section `<style>`, après `.admin-btn.on` ligne 218)

- [ ] **Step 1 : Insérer les CSS du dropdown `#adminDropdown`**

Après la ligne `.admin-btn.on{background:var(--orange);border-color:var(--orange)}`, ajouter :

```css
#adminDropdown{position:fixed;top:calc(env(safe-area-inset-top,0) + 40px);right:12px;
  z-index:1200;background:#fff;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.18);
  display:none;flex-direction:column;min-width:160px;overflow:hidden}
#adminDropdown.vis{display:flex}
#adminDropdown button{background:none;border:none;text-align:left;padding:12px 16px;
  font-size:14px;cursor:pointer;color:#1a1a1a;display:flex;align-items:center;gap:8px}
#adminDropdown button:hover{background:#f5f5f5}
#adminDropdown hr{margin:0;border:none;border-top:1px solid #eee}
```

- [ ] **Step 2 : Insérer les CSS du modal `#profileModal`**

Dans la même section `<style>`, juste après le CSS du dropdown, ajouter :

```css
#profileModal{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);
  z-index:3200;display:none;align-items:center;justify-content:center;padding:16px}
#profileModal.vis{display:flex}
.profile-box{background:#fff;border-radius:16px;width:100%;max-width:360px;
  max-height:85vh;overflow-y:auto;padding:20px}
.profile-box h2{font-size:17px;font-weight:700;margin:0 0 16px;display:flex;
  justify-content:space-between;align-items:center}
.profile-box h2 button{background:none;border:none;font-size:20px;cursor:pointer;color:#888;line-height:1}
.profile-section{margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid #eee}
.profile-section:last-child{margin-bottom:0;padding-bottom:0;border-bottom:none}
.profile-section h3{font-size:12px;font-weight:700;text-transform:uppercase;
  letter-spacing:.05em;color:#888;margin:0 0 10px}
.profile-row{display:flex;justify-content:space-between;align-items:center;
  font-size:13px;color:#1a1a1a;margin-bottom:6px}
.profile-row span:last-child{color:#555;font-weight:500}
.quota-progress{height:8px;border-radius:4px;background:#e8e8e8;margin:8px 0;overflow:hidden}
.quota-progress-fill{height:100%;border-radius:4px;background:#27ae60;transition:width .3s}
.quota-progress-fill.warn{background:#e67e22}
.quota-progress-fill.high{background:#e74c3c}
.quota-progress-fill.block{background:#c0392b}
.quota-refresh-row{display:flex;justify-content:space-between;align-items:center;margin-top:4px}
.profile-stat-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center}
.profile-stat{background:#f7f7f7;border-radius:8px;padding:10px 6px}
.profile-stat .stat-num{font-size:20px;font-weight:700;color:#1a1a1a}
.profile-stat .stat-lbl{font-size:11px;color:#888;margin-top:2px}
.profile-export{display:flex;gap:8px;margin-top:4px}
.profile-export .btn{flex:1;font-size:13px;padding:10px 8px}
```

- [ ] **Step 3 : Vérifier que l'app se charge sans erreur console**

Pas de comportement visible encore (éléments non présents dans le DOM). Vérifier aucune erreur CSS dans le navigateur.

- [ ] **Step 4 : Commit**

```bash
git add index.html
git commit -m "feat: add CSS for admin dropdown and profile modal"
```

---

### Task 3 : Ajouter le HTML du dropdown et du modal Profil

**Files:**
- Modify: `index.html` — après `<button class="admin-btn" ...>` (ligne 397)

- [ ] **Step 1 : Entourer le bouton Admin et le dropdown dans un wrapper relatif**

Remplacer la ligne 397 :
```html
<button class="admin-btn" id="adminBtn" onclick="toggleAdmin()">&#x1f512; Admin</button>
```
par :
```html
<button class="admin-btn" id="adminBtn" onclick="toggleAdmin()">&#x1f512; Admin</button>
<div id="adminDropdown">
  <button onclick="openProfileModal()">👤 Profil</button>
  <hr>
  <button onclick="logoutAdmin()">🚪 Déconnexion</button>
</div>
```

- [ ] **Step 2 : Ajouter le HTML du modal Profil**

Après le div `#adminDropdown` (et avant `<div class="confirm-modal"`), insérer :

```html
<div id="profileModal" onclick="if(event.target===this)closeProfileModal()">
  <div class="profile-box">
    <h2>Profil admin <button onclick="closeProfileModal()" aria-label="Fermer">✕</button></h2>

    <div class="profile-section">
      <h3>Compte</h3>
      <div class="profile-row"><span>Email</span><span id="profileEmail">—</span></div>
      <div class="profile-row"><span>Session restante</span><span id="profileSession">—</span></div>
    </div>

    <div class="profile-section">
      <h3>Stockage RTDB <button class="btn" style="font-size:11px;padding:3px 8px" onclick="refreshProfileQuota()">🔄</button></h3>
      <div class="quota-progress"><div class="quota-progress-fill" id="profileQuotaFill" style="width:0%"></div></div>
      <div class="profile-row" id="profileQuotaText"><span>Chargement…</span></div>
    </div>

    <div class="profile-section">
      <h3>Stats</h3>
      <div class="profile-stat-grid">
        <div class="profile-stat"><div class="stat-num" id="profileStatStages">—</div><div class="stat-lbl">Étapes</div></div>
        <div class="profile-stat"><div class="stat-num" id="profileStatJournal">—</div><div class="stat-lbl">Journal publié</div></div>
        <div class="profile-stat"><div class="stat-num" id="profileStatComments">—</div><div class="stat-lbl">Commentaires</div></div>
      </div>
    </div>

    <div class="profile-section">
      <h3>Export journal</h3>
      <div class="profile-export">
        <button class="btn btn-p" onclick="exportJournal('md')">⬇ .md</button>
        <button class="btn" onclick="exportJournal('json')">⬇ .json</button>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 3 : Vérifier que le HTML est valide**

Ouvrir l'app dans le navigateur, vérifier aucune erreur de parsing HTML.

- [ ] **Step 4 : Commit**

```bash
git add index.html
git commit -m "feat: add admin dropdown and profile modal HTML"
```

---

### Task 4 : Refactoriser `refreshQuotaBar` → `refreshQuotaState` et câbler le JS

**Files:**
- Modify: `index.html` — fonctions JS (autour des lignes 563–606)

- [ ] **Step 1 : Remplacer `refreshQuotaBar()` par `refreshQuotaState(callback)`**

Remplacer la fonction entière `refreshQuotaBar` (lignes 563–583) par :

```js
function refreshQuotaState(callback){
  if(!window._fbDb||!window._fbGet){if(callback)callback();return;}
  window._fbGet(window._fbRef(window._fbDb,'photos'))
    .then(function(snap){
      var tree=snap.exists()?snap.val():{};
      var r=Utils.computeQuotaBytes(tree);
      var lvl=Utils.quotaLevel(r.bytes);
      _quotaState={count:r.count,bytes:r.bytes,level:lvl};
      if(callback)callback();
    })
    .catch(function(err){
      console.error('[quota] refresh failed',err);
      if(callback)callback();
    });
}
```

- [ ] **Step 2 : Mettre à jour `setAdminUI` pour ne plus référencer `quotaBar`**

Dans `setAdminUI`, remplacer l'appel à `refreshQuotaBar()` (ligne ~601) :
```js
// AVANT :
if(on){
  refreshQuotaBar();
}else{
  var qb=document.getElementById('quotaBar');
  if(qb)qb.classList.remove('vis');
}

// APRÈS :
if(on){
  refreshQuotaState();
}
```

- [ ] **Step 3 : Implémenter `toggleAdmin()`**

Remplacer la fonction `toggleAdmin` (lignes 664–671) par :

```js
function toggleAdmin(){
  if(isAdmin){
    var dd=document.getElementById('adminDropdown');
    if(dd.classList.contains('vis')){dd.classList.remove('vis');return;}
    dd.classList.add('vis');
    // Fermer dropdown si clic en dehors
    setTimeout(function(){
      document.addEventListener('click',closeAdminDropdown,{once:true,capture:true});
    },0);
    return;
  }
  document.getElementById('pwEmail').value='';
  document.getElementById('pwInput').value='';
  document.getElementById('pwErr').style.display='none';
  document.getElementById('pwModal').classList.add('vis');
  setTimeout(function(){document.getElementById('pwEmail').focus()},100);
}
function closeAdminDropdown(){
  var dd=document.getElementById('adminDropdown');
  if(dd)dd.classList.remove('vis');
}
```

- [ ] **Step 4 : Implémenter `openProfileModal()` et `closeProfileModal()`**

Ajouter après `closeAdminDropdown` :

```js
var _sessionCountdown=null;

function openProfileModal(){
  closeAdminDropdown();
  // Email
  var u=window._fbAuth&&window._fbAuth.currentUser;
  document.getElementById('profileEmail').textContent=u?u.email:'—';
  // Stats depuis state
  var stages=state.stages||[];
  document.getElementById('profileStatStages').textContent=stages.length;
  var days=state.days||{};
  var published=Object.values(days).filter(function(d){return d.published===true;}).length;
  document.getElementById('profileStatJournal').textContent=published;
  // Commentaires RTDB
  document.getElementById('profileStatComments').textContent='…';
  if(window._fbDb&&window._fbGet){
    window._fbGet(window._fbRef(window._fbDb,'comments'))
      .then(function(snap){
        var count=0;
        if(snap.exists()){
          var tree=snap.val();
          Object.values(tree).forEach(function(stageComments){
            count+=Object.keys(stageComments).length;
          });
        }
        document.getElementById('profileStatComments').textContent=count;
      })
      .catch(function(err){console.error('[profile] comments count failed',err);});
  }
  // Quota
  refreshProfileQuota();
  // Compte à rebours session
  _sessionCountdown=setInterval(function(){
    var el=document.getElementById('profileSession');
    if(!el){clearInterval(_sessionCountdown);return;}
    // inactivityTimer est un ID setTimeout — on ne peut pas lire le temps restant directement.
    // On affiche le temps depuis le dernier resetInactivity via _lastActivity.
    var elapsed=Date.now()-(_lastActivity||Date.now());
    var remaining=Math.max(0,INACTIVITY_MS-elapsed);
    var m=Math.floor(remaining/60000);
    var s=Math.floor((remaining%60000)/1000);
    el.textContent=m+':'+(s<10?'0':'')+s;
  },1000);
  document.getElementById('profileModal').classList.add('vis');
}

function closeProfileModal(){
  document.getElementById('profileModal').classList.remove('vis');
  clearInterval(_sessionCountdown);
  _sessionCountdown=null;
}

function refreshProfileQuota(){
  document.getElementById('profileQuotaText').innerHTML='<span>Chargement…</span>';
  refreshQuotaState(function(){
    var r=_quotaState;
    var pct=(r.bytes/Utils.RTDB_QUOTA_BYTES*100);
    var pctStr=pct.toFixed(1);
    var fill=document.getElementById('profileQuotaFill');
    fill.style.width=Math.min(pct,100)+'%';
    fill.className='quota-progress-fill'+(r.level!=='ok'?' '+r.level:'');
    document.getElementById('profileQuotaText').innerHTML=
      '<span>'+r.count+' photos · '+Utils.formatBytes(r.bytes)+'</span>'+
      '<span>'+pctStr+'% / 1 Go</span>';
  });
}
```

- [ ] **Step 5 : Ajouter `_lastActivity` pour le compte à rebours**

Juste avant `function resetInactivity(){` (ligne ~659), ajouter :
```js
var _lastActivity=Date.now();
```

Et dans `resetInactivity()`, ajouter `_lastActivity=Date.now();` en première ligne :
```js
function resetInactivity(){
  if(!isAdmin)return;
  _lastActivity=Date.now();
  clearTimeout(inactivityTimer);
  inactivityTimer=setTimeout(logoutAdmin,INACTIVITY_MS);
}
```

- [ ] **Step 6 : Tester manuellement dans le navigateur**

1. Ouvrir l'app, se connecter en admin.
2. Cliquer sur "🔓 Admin" → dropdown apparaît avec "👤 Profil" et "🚪 Déconnexion".
3. Cliquer en dehors → dropdown se ferme.
4. Cliquer "👤 Profil" → modal s'ouvre avec email, compte à rebours, quota, stats, boutons export.
5. Cliquer "🔄" → quota se rafraîchit.
6. Cliquer "⬇ .md" → téléchargement journal markdown.
7. Cliquer "⬇ .json" → téléchargement journal JSON.
8. Cliquer "🚪 Déconnexion" → déconnexion, dropdown fermé.
9. Vérifier aucune erreur console.

- [ ] **Step 7 : Commit**

```bash
git add index.html
git commit -m "feat: add admin dropdown, profile modal with quota, stats and journal export"
```

---

### Task 5 : Vérifier les tests et pousser

**Files:**
- Aucun fichier de test modifié (tout DOM-only)

- [ ] **Step 1 : Lancer les tests**

```bash
npm test
```
Expected : tous les tests passent (19 gps-core + 15 utils = 34 tests).

- [ ] **Step 2 : Commit final si ajustements mineurs**

Si des ajustements CSS/UX ont été faits pendant les tests manuels :
```bash
git add index.html
git commit -m "fix: admin profile panel polish"
```
