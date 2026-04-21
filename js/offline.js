// offline.js
// Offline cache (localStorage), offline queue, tryWrite, flushQueue.
// Manages synchronisation between local state and Firebase RTDB.

var COMMENTS_CACHE_MAX=50;
var MAX_OFFLINE_QUEUE=200;
var _offlineCoreWarned=false;

function _warnOfflineCoreMissing(){
  if(_offlineCoreWarned)return;
  _offlineCoreWarned=true;
  console.warn('[Offline] OfflineCore module non chargé');
}

function saveLocalCache(){
  try{localStorage.setItem('ev1-current-cache',JSON.stringify(current));}catch(e){console.warn('[cache] current non sauvegardé',e);}
  try{localStorage.setItem('ev1-stages-cache',JSON.stringify(stages));}catch(e){console.warn('[cache] stages non sauvegardé',e);}
  try{localStorage.setItem('ev1-journals-cache',JSON.stringify(journals));}
  catch(e){console.warn('[cache] journals non sauvegardé',e);}
}

function loadLocalCache(){
  try{var c=localStorage.getItem('ev1-current-cache');if(c)current=JSON.parse(c);}catch(e){console.warn('[cache] current illisible',e);}
  try{var s=localStorage.getItem('ev1-stages-cache');if(s)stages=JSON.parse(s)||{};}catch(e){console.warn('[cache] stages illisible',e);}
  try{var j=localStorage.getItem('ev1-journals-cache');if(j)journals=JSON.parse(j)||{};}catch(e){console.warn('[cache] journals illisible',e);}
}

function saveExpensesCache(){
  try{localStorage.setItem('ev1-expenses-cache',JSON.stringify(expenses));}catch(e){console.warn('[cache] expenses non sauvegardé',e);}
}

function loadExpensesCache(){
  try{var e=localStorage.getItem('ev1-expenses-cache');if(e)expenses=JSON.parse(e)||{};}catch(e){console.warn('[cache] expenses illisible',e);}
}

// Cache commentaires par étape (lecture hors-ligne). Taille limitée : 50 étapes max.
function saveCommentsCache(date,data){
  var key='ev1-cmts-'+date;
  try{
    localStorage.setItem(key,JSON.stringify(data));
    // Tenir à jour un index des dates mises en cache
    var idxRaw=localStorage.getItem('ev1-cmts-idx');
    var idx=idxRaw?JSON.parse(idxRaw):[];
    if(!window.OfflineCore){ _warnOfflineCoreMissing(); return; }
    var upd=window.OfflineCore.upsertBoundedIndex(idx, date, COMMENTS_CACHE_MAX);
    if(upd.index.indexOf(date)!==-1){
      upd.evicted.forEach(function(d){try{localStorage.removeItem('ev1-cmts-'+d);}catch(_){}});
      localStorage.setItem('ev1-cmts-idx',JSON.stringify(upd.index));
    }
  }catch(e){console.warn('[cache] commentaires non sauvegardés pour '+date,e);}
}
function loadAllCommentsCache(){
  try{
    var idxRaw=localStorage.getItem('ev1-cmts-idx');
    if(!idxRaw)return;
    var idx=JSON.parse(idxRaw);
    var storedByDate={};
    idx.forEach(function(date){
      try{
        var raw=localStorage.getItem('ev1-cmts-'+date);
        if(raw){
          var data=JSON.parse(raw);
          if(data&&typeof data==='object') storedByDate[date]=data;
        }
      }catch(e){console.warn('[cache] commentaires illisibles pour '+date,e);}
    });
    if(!window.OfflineCore){ _warnOfflineCoreMissing(); return; }
    comments=window.OfflineCore.hydrateComments(idx, storedByDate, comments);
  }catch(e){console.warn('[cache] index commentaires illisible',e);}
}

function persistQueue(){
  try{localStorage.setItem('offlineQueue',JSON.stringify(offlineQueue));}catch(_e){
    console.warn('localStorage plein, queue offline non sauvegardée');
  }
}
function queueWrite(path, data){
  if(!isOfflineable(path)){
    // Photos/commentaires/bravos/expenses not available offline
    return false;
  }
  enqueueOp(data===null?'remove':'set', path, data);
  return true;
}
function _inferType(path){
  return actionLabel(path);
}
function enqueueOp(op, path, data){
  offlineQueue.push({op:op, path:path, data:data, ts:Date.now(), type:_inferType(path)});
  if(window.OfflineCore){
    offlineQueue=window.OfflineCore.trimQueue(offlineQueue, MAX_OFFLINE_QUEUE);
  } else if(offlineQueue.length>MAX_OFFLINE_QUEUE){
    offlineQueue=offlineQueue.slice(-MAX_OFFLINE_QUEUE);
  }
  persistQueue();
  setSyncDot('queued');
}
// Tente une écriture Firebase, ou la met en queue si offline / échec.
// Retourne une Promise qui résout dans tous les cas (queue = succès logique).
function tryWrite(op, path, data){
  if(!isOnline||!window._fbDb){enqueueOp(op,path,data);return Promise.resolve({queued:true});}
  var p=(op==='remove')
    ? window._fbRemove(window._fbRef(window._fbDb,path))
    : window._fbSet(window._fbRef(window._fbDb,path),data);
  return p.then(function(){return {queued:false};}).catch(function(err){
    console.error('[tryWrite] '+op+' '+path+' failed, queueing',err);
    enqueueOp(op,path,data);
    return {queued:true};
  });
}

function flushQueue(){
  if(!offlineQueue.length||!window._fbDb)return;
  setSyncDot('syncing');
  var queue=offlineQueue.slice();
  offlineQueue=[];
  persistQueue();
  // Séquentiel pour préserver l'ordre (delete avant set sur même path, etc.)
  var failed=[];
  var chain=Promise.resolve();
  queue.forEach(function(item){
    chain=chain.then(function(){
      var op=item.op||'set';
      var ref=window._fbRef(window._fbDb,item.path);
      var p=(op==='remove')?window._fbRemove(ref):window._fbSet(ref,item.data);
      return p.catch(function(err){
        console.error('[flushQueue] '+op+' '+item.path+' failed',err);
        failed.push(item);
      });
    });
  });
  chain.then(function(){
    if(failed.length){
      offlineQueue=failed.concat(offlineQueue);
      persistQueue();
      setSyncDot(isOnline?'queued':'offline');
    } else {
      setSyncDot(isOnline?'online':'offline');
    }
  });
}

window.addEventListener('online', function(){
  isOnline=true;
  setSyncDot(offlineQueue.length?'queued':'online');
  flushQueue();
});
window.addEventListener('offline', function(){
  isOnline=false;
  setSyncDot('offline');
});
