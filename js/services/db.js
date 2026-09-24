// db.js
// Couche I/O : façade unique sur Firebase Realtime Database.
// S'appuie sur les globales window._fb* posées par firebase-init.js (vraie
// version) ou par demo-mode.js (stubs en mémoire) — la bascule démo reste
// donc invisible pour les appelants.
// Si Firebase n'est pas chargé (hors-ligne au démarrage, CDN bloqué…), les
// opérations rejettent proprement au lieu de lever un TypeError synchrone.
// Double export navigateur/CommonJS pour les tests (globalThis.window simulé).

(function(){
  function _fb(){
    return (typeof window !== 'undefined') ? window : {};
  }

  /**
   * Vrai si le SDK RTDB (ou le stub démo) est disponible.
   * @returns {boolean}
   */
  function ready(){
    var w = _fb();
    return !!(w._fbDb && typeof w._fbRef === 'function');
  }

  function _ref(path){
    var w = _fb();
    return w._fbRef(w._fbDb, path);
  }

  function _unavailable(op, path){
    var err = new Error('Firebase indisponible');
    console.error('[db] ' + op + ' ' + path, err);
    return Promise.reject(err);
  }

  /**
   * Écrit une valeur à un chemin RTDB.
   * @param {string} path
   * @param {*} value
   * @returns {Promise<void>}
   */
  function set(path, value){
    if (!ready() || typeof _fb()._fbSet !== 'function') return _unavailable('set', path);
    return _fb()._fbSet(_ref(path), value);
  }

  /**
   * Supprime le nœud à un chemin RTDB.
   * @param {string} path
   * @returns {Promise<void>}
   */
  function remove(path){
    if (!ready() || typeof _fb()._fbRemove !== 'function') return _unavailable('remove', path);
    return _fb()._fbRemove(_ref(path));
  }

  /**
   * Lit une fois le nœud à un chemin RTDB.
   * @param {string} path
   * @returns {Promise<{val:function():*, exists:function():boolean}>}
   */
  function get(path){
    if (!ready() || typeof _fb()._fbGet !== 'function') return _unavailable('get', path);
    return _fb()._fbGet(_ref(path));
  }

  /**
   * Écoute un chemin RTDB en temps réel.
   * @param {string} path
   * @param {function(*):void} onSnap
   * @param {function(Error):void} [onError]
   * @returns {function():void} désabonnement (no-op si Firebase indisponible)
   */
  function on(path, onSnap, onError){
    if (!ready() || typeof _fb()._fbOnValue !== 'function') {
      console.error('[db] on ' + path, new Error('Firebase indisponible'));
      return function(){};
    }
    return onError
      ? _fb()._fbOnValue(_ref(path), onSnap, onError)
      : _fb()._fbOnValue(_ref(path), onSnap);
  }

  var api = { ready: ready, set: set, remove: remove, get: get, on: on };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.Db = api;
})();
