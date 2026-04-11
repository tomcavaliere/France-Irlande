// init.js
// Application bootstrap: service worker, local cache, Firebase init.

function flushState(){
  saveLocalCache();
  if(isAdmin)flushJournals();
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
  loadLocalCache();
  loadExpensesCache();
  loadAllCommentsCache();
  initMap();
  renderStages();
  renderJournal();
  setSyncDot(isOnline?'online':'offline');
  setTimeout(function(){
    initAuth();initFirebase();fetchWeather();
    if(isOnline)flushQueue();
  },800);
});
