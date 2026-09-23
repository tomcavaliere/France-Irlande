// activity-core.js
// Logique pure du tableau de bord d'activité admin : normalisation des
// événements, filtres, séries par jour, classement des utilisateurs.
// Pas de DOM, pas d'I/O. Double export navigateur/CommonJS pour les tests.

(function(){
  // Garder cette liste alignée avec firebase.rules.json (/activity/$id/type).
  var VALID_TYPES = ['admin_login', 'visitor_login', 'visitor_suspicious'];
  var NAME_MAX = 60;

  /**
   * Chaîne nettoyée : trim, repli si vide, tronquée à maxLen.
   * @param {*} v
   * @param {number} maxLen
   * @param {string} [fallback]
   * @returns {string}
   */
  function safeString(v, maxLen, fallback){
    var s = typeof v === 'string' ? v.trim() : '';
    if (!s) s = fallback || '';
    if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
    return s;
  }

  /**
   * @param {*} type
   * @returns {string} un type valide, sinon 'other'
   */
  function normalizeType(type){
    return VALID_TYPES.indexOf(type) !== -1 ? type : 'other';
  }

  /**
   * Normalise un événement brut RTDB en {type, name, ts} (ts = 0 si invalide).
   * @param {*} raw
   * @returns {{type:string, name:string, ts:number}}
   */
  function normalizeEntry(raw){
    raw = raw && typeof raw === 'object' ? raw : {};
    var tsNum = Number(raw.ts);
    return {
      type: normalizeType(raw.type),
      name: safeString(raw.name, NAME_MAX, 'Inconnu'),
      ts: isFinite(tsNum) && tsNum > 0 ? tsNum : 0
    };
  }

  /**
   * @param {string} type
   * @returns {string} libellé français affiché dans la liste
   */
  function typeLabel(type){
    if (type === 'admin_login') return 'Connexion admin';
    if (type === 'visitor_login') return 'Connexion visiteur';
    if (type === 'visitor_suspicious') return 'Alerte suspecte';
    return 'Événement';
  }

  /**
   * Vrai pour les événements à masquer : connexions admin et connexions
   * visiteur de Tom ou Chloé (les voyageurs eux-mêmes).
   * @param {{type:string, name:string}} entry
   * @returns {boolean}
   */
  function shouldIgnoreEntry(entry){
    if (!entry || typeof entry !== 'object') return false;
    if (entry.type === 'admin_login') return true;
    if (entry.type !== 'visitor_login') return false;
    // NFD + suppression des diacritiques : « Chloé » doit valoir « chloe ».
    var normalized = safeString(entry.name, NAME_MAX, '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return normalized === 'tom' || normalized === 'chloe';
  }

  /**
   * Arbre RTDB activity/ → événements valides, triés du plus récent au plus
   * ancien, sans les événements ignorés.
   * @param {Object<string,*>|null} tree
   * @returns {Array<{type:string, name:string, ts:number}>}
   */
  function prepareEntries(tree){
    var src = tree && typeof tree === 'object' ? tree : {};
    return Object.keys(src)
      .map(function(id){ return normalizeEntry(src[id]); })
      .filter(function(e){ return e.ts > 0 && !shouldIgnoreEntry(e); })
      .sort(function(a, b){ return b.ts - a.ts; });
  }

  /**
   * Compteurs du résumé.
   * @param {Array<{type:string, name:string}>} entries
   * @returns {{total:number, visitors:number, suspicious:number, uniqueUsers:number}}
   */
  function summarize(entries){
    var names = {};
    var visitors = 0, suspicious = 0;
    entries.forEach(function(e){
      names[e.name] = true;
      if (e.type === 'visitor_login') visitors++;
      else if (e.type === 'visitor_suspicious') suspicious++;
    });
    return {
      total: entries.length,
      visitors: visitors,
      suspicious: suspicious,
      uniqueUsers: Object.keys(names).length
    };
  }

  /**
   * Nombre d'événements par jour sur les nbDays derniers jours (aujourd'hui inclus),
   * du plus ancien au plus récent.
   * @param {Array<{ts:number}>} entries
   * @param {number} nbDays
   * @param {function(Date|number):string} toDayISO  date → 'YYYY-MM-DD' (locale)
   * @param {number} [nowTs]  horloge injectable (défaut : maintenant)
   * @returns {Array<{date:string, count:number}>}
   */
  function lastDaysSeries(entries, nbDays, toDayISO, nowTs){
    var days = Math.max(1, Math.round(nbDays || 7));
    var base = new Date(typeof nowTs === 'number' ? nowTs : Date.now());
    base.setHours(12, 0, 0, 0);
    var counts = {};
    entries.forEach(function(e){
      if (!isFinite(e.ts) || e.ts <= 0) return;
      var day = toDayISO(e.ts);
      counts[day] = (counts[day] || 0) + 1;
    });
    var out = [];
    for (var i = days - 1; i >= 0; i--){
      var d = new Date(base);
      d.setDate(base.getDate() - i);
      var iso = toDayISO(d);
      out.push({ date: iso, count: counts[iso] || 0 });
    }
    return out;
  }

  /**
   * Utilisateurs les plus actifs : décompte par nom, tri décroissant puis alphabétique.
   * @param {Array<{name:string}>} entries
   * @param {number} maxUsers
   * @returns {Array<{name:string, count:number}>}
   */
  function topUsers(entries, maxUsers){
    var counts = {};
    entries.forEach(function(e){
      var key = safeString(e.name, NAME_MAX, 'Inconnu');
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.keys(counts)
      .map(function(name){ return { name: name, count: counts[name] }; })
      .sort(function(a, b){
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      })
      .slice(0, Math.max(1, Math.round(maxUsers || 20)));
  }

  var api = {
    VALID_TYPES: VALID_TYPES,
    safeString: safeString,
    normalizeType: normalizeType,
    normalizeEntry: normalizeEntry,
    typeLabel: typeLabel,
    shouldIgnoreEntry: shouldIgnoreEntry,
    prepareEntries: prepareEntries,
    summarize: summarize,
    lastDaysSeries: lastDaysSeries,
    topUsers: topUsers
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.ActivityCore = api;
})();
