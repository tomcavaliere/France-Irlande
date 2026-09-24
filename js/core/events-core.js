// events-core.js
// Minimal synchronous pub/sub bus. No framework, no async.
//
// Used to decouple state mutations from UI re-renders : instead of manually
// calling renderStages() / renderJournal() / updateMap() after each change,
// callers emit a named event and the subscribers set up at boot time take
// care of the re-render. This eliminates the risk of silent desyncs when a
// new mutation site forgets to call a render function.
//
// Listeners fire synchronously in subscription order. An exception thrown
// by one listener does not prevent the others from running. Unsubscribing
// during an emit is safe — the snapshot is taken before dispatch.

(function(){
  function createBus(){
    var listeners = Object.create(null);

    function on(name, fn){
      if (typeof fn !== 'function') return function(){};
      if (!listeners[name]) listeners[name] = [];
      listeners[name].push(fn);
      return function off(){
        var arr = listeners[name];
        if (!arr) return;
        var i = arr.indexOf(fn);
        if (i >= 0) arr.splice(i, 1);
      };
    }

    function off(name, fn){
      var arr = listeners[name];
      if (!arr) return;
      var i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    }

    function emit(name, data){
      var arr = listeners[name];
      if (!arr || !arr.length) return;
      // Snapshot so off() / on() during dispatch don't mutate iteration.
      var snapshot = arr.slice();
      for (var i = 0; i < snapshot.length; i++){
        try { snapshot[i](data); }
        catch (err) { console.error('[events] listener threw for', name, err); }
      }
    }

    function clear(name){
      if (name) delete listeners[name];
      else listeners = Object.create(null);
    }

    return { on: on, off: off, emit: emit, clear: clear };
  }

  var api = {
    createBus: createBus,
    // Default singleton bus used by the app.
    Events: createBus()
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined'){
    window.EventsCore = api;
    window.Events = api.Events;
  }
})();
