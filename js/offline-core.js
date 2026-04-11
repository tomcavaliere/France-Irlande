// offline-core.js
// Fonctions pures pour la gestion cache/queue offline.

(function(){
  function upsertBoundedIndex(index, key, maxSize){
    var max = Math.max(1, Number(maxSize) || 1);
    var arr = Array.isArray(index) ? index.slice() : [];
    if (typeof key !== 'string' || !key) return { index: arr, evicted: [] };
    if (arr.indexOf(key) !== -1) return { index: arr, evicted: [] };
    arr.push(key);
    if (arr.length <= max) return { index: arr, evicted: [] };
    var overflow = arr.length - max;
    return { index: arr.slice(overflow), evicted: arr.slice(0, overflow) };
  }

  function trimQueue(queue, maxSize){
    var max = Math.max(1, Number(maxSize) || 1);
    var arr = Array.isArray(queue) ? queue.slice() : [];
    if (arr.length <= max) return arr;
    return arr.slice(arr.length - max);
  }

  function hydrateComments(index, storedByDate, existingComments){
    var out = Object.assign({}, (existingComments && typeof existingComments === 'object') ? existingComments : {});
    if (!Array.isArray(index) || !storedByDate || typeof storedByDate !== 'object') return out;
    index.forEach(function(date){
      if (out[date]) return;
      var data = storedByDate[date];
      if (data && typeof data === 'object') out[date] = data;
    });
    return out;
  }

  var api = {
    upsertBoundedIndex: upsertBoundedIndex,
    trimQueue: trimQueue,
    hydrateComments: hydrateComments
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.OfflineCore = api;
})();
