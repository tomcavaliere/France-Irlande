// init.js
// Application bootstrap: service worker, local cache, Firebase init,
// and event bus subscriptions that own all re-render policy.

function flushState(){
  saveLocalCache();
  if(isAdmin)flushJournals();
}

var _appBooted=false;

function _bootApp(){
  if(_appBooted)return;
  _appBooted=true;
  _subscribeEvents();
  loadLocalCache();
  loadExpensesCache();
  loadAllCommentsCache();
  initMap();
  Events.emit('state:stages-changed');
  setSyncDot(isOnline?'online':'offline');
  setTimeout(function(){
    initAuth();initFirebase();fetchWeather();
    if(isOnline)flushQueue();
  },800);
}

function _setVisitorAuthError(msg){
  var errEl=document.getElementById('visitorAuthErr');
  if(!errEl)return;
  if(msg){
    errEl.textContent=msg;
    errEl.style.display='block';
  }else{
    errEl.style.display='none';
  }
}

function _applyVisitorAuth(username){
  isVisitorAuthenticated=true;
  visitorUsername=username;
  localStorage.setItem(VISITOR_SESSION_KEY,JSON.stringify({
    username:username,
    ts:Date.now()
  }));
  var modal=document.getElementById('visitorAuthModal');
  if(modal)modal.classList.remove('vis');
  var passEl=document.getElementById('visitorPassword');
  if(passEl)passEl.value='';
}

function _sha256Hex(text){
  if(!window.crypto||!window.crypto.subtle||typeof TextEncoder==='undefined'){
    return Promise.resolve(String(text||''));
  }
  var data=new TextEncoder().encode(String(text||''));
  return window.crypto.subtle.digest('SHA-256',data).then(function(buf){
    return Array.from(new Uint8Array(buf))
      .map(function(b){return b.toString(16).padStart(2,'0');})
      .join('');
  });
}

async function submitVisitorAuth(){
  var nameEl=document.getElementById('visitorUsername');
  var passEl=document.getElementById('visitorPassword');
  var rawName=nameEl?nameEl.value:'';
  var password=passEl?passEl.value:'';
  _setVisitorAuthError('');
  var vr=Utils.validateVisitorUsername(rawName);
  if(!vr.ok){
    _setVisitorAuthError('Nom utilisateur ou mot de passe invalide.');
    if(nameEl)nameEl.focus();
    return;
  }
  try{
    var passHash=await _sha256Hex(password);
    if(passHash!==VISITOR_SHARED_PASSWORD_SHA256){
      _setVisitorAuthError('Nom utilisateur ou mot de passe invalide.');
      if(passEl){
        passEl.value='';
        passEl.focus();
      }
      return;
    }
  }catch(err){
    console.error('[visitorAuth/check]',err);
    _setVisitorAuthError('Validation impossible. Réessaie.');
    return;
  }
  if(nameEl)nameEl.value=vr.value;
  _applyVisitorAuth(vr.value);
  _bootApp();
  showToast('Bienvenue '+vr.value+' !','success',2200);
}

function initVisitorAuth(){
  var modal=document.getElementById('visitorAuthModal');
  if(!modal){_bootApp();return;}
  _setVisitorAuthError('');
  try{
    var raw=localStorage.getItem(VISITOR_SESSION_KEY);
    if(raw){
      var parsed=JSON.parse(raw);
      var username=parsed&&typeof parsed.username==='string'?parsed.username:'';
      var vr=Utils.validateVisitorUsername(username);
      if(vr.ok){
        _applyVisitorAuth(vr.value);
        _bootApp();
        return;
      }
    }
  }catch(err){
    console.error('[visitorAuth/init]',err);
  }
  isVisitorAuthenticated=false;
  visitorUsername='';
  localStorage.removeItem(VISITOR_SESSION_KEY);
  modal.classList.add('vis');
  var nameEl=document.getElementById('visitorUsername');
  if(nameEl)setTimeout(function(){nameEl.focus();},50);
  var passEl=document.getElementById('visitorPassword');
  if(passEl){
    passEl.addEventListener('keydown',function(e){
      if(e.key==='Enter')submitVisitorAuth();
    });
  }
  if(nameEl){
    nameEl.addEventListener('keydown',function(e){
      if(e.key==='Enter'&&passEl)passEl.focus();
    });
  }
}

// Subscribe UI renderers to state events. Mutation sites emit named
// events — this is the ONLY place that decides which render runs when.
// Any new render call belongs here, not at the mutation site.
function _subscribeEvents(){
  Events.on('state:current-changed',function(){
    updateMap();
    updatePositionBadge();
    updateRecap();
  });
  Events.on('state:stages-changed',function(){
    var newCount=Object.keys(stages||{}).length;
    var countChanged=newCount!==lastCompletedCount;
    lastCompletedCount=newCount;
    renderStages();
    if(!fbInitialized){
      renderJournal();
      fbInitialized=true;
      journalDirty=false;
    }else if(countChanged){
      if(activeTab()==='journal'){renderJournal();journalDirty=false;}
      else journalDirty=true;
    }
  });
  Events.on('state:tracks-changed',function(){
    renderTrackPolylines();
    renderStages();
  });
  Events.on('state:journal-changed',function(){
    if(activeTab()==='journal'){renderJournal();journalDirty=false;}
    else journalDirty=true;
  });
  Events.on('state:expenses-changed',function(){
    if(activeTab()==='depenses')renderExpenses();
  });
  Events.on('admin:toggled',function(){
    renderStages();
    renderJournal();
    updateMap();
  });
}
// beforeunload : fonctionne sur desktop et Android
window.addEventListener('beforeunload',flushState);
// visibilitychange : fonctionne sur iOS Safari (beforeunload ignoré)
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='hidden')flushState();
});

document.addEventListener('DOMContentLoaded',function(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(function(){});
  }
  initEventDelegation();
  initVisitorAuth();
});
