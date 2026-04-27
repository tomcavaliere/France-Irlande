// init.js
// Application bootstrap: service worker, local cache, Firebase init,
// and event bus subscriptions that own all re-render policy.

function flushState(){
  saveLocalCache();
  if(isAdmin)flushJournals();
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
    updateMap();
  });
  Events.on('state:journal-changed',function(){
    if(activeTab()==='journal'){renderJournal();journalDirty=false;}
    else journalDirty=true;
  });
  Events.on('state:expenses-changed',function(){
    if(activeTab()==='depenses')renderExpenses();
  });
  Events.on('admin:toggled',function(){
    if(isAdmin)closeVisitorGate();
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
  _subscribeEvents();
  loadLocalCache();
  loadExpensesCache();
  loadAllCommentsCache();
  initMap();
  Events.emit('state:stages-changed');
  setSyncDot(isOnline?'online':'offline');
  // Afficher le gate visiteur si non authentifié (l'admin lève le gate via admin:toggled)
  if(!isVisitorAuthenticated()){
    showVisitorGate({hardLock:true});
  }
  setTimeout(function(){
    initAuth();initFirebase();fetchWeather();
    if(isOnline)flushQueue();
    trackReturningVisitor();
  },800);
});
