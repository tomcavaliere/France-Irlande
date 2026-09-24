// dashboard-core.js
// Logique pure des tableaux de bord admin Santé et Training : normalisation
// des saisies, séries par jour, semaines, tracé SVG des courbes.
// Pas de DOM, pas d'I/O. Double export navigateur/CommonJS pour les tests.

(function(){
  // ---- Courbes SVG (viewBox 0 0 100 68, ligne de base y=62, hauteur utile 54) ----
  var X_LEFT = 4, X_SPAN = 92, Y_BASE = 62, Y_SPAN = 54;

  /**
   * Chemin SVG d'une courbe dans le cadre 100×68 des cartes graphiques.
   * Une seule valeur → segment horizontal ; plage nulle → courbe sur la ligne de base.
   * @param {number[]} values
   * @param {number} minY
   * @param {number} maxY
   * @returns {string} attribut d du <path> ('' si aucune valeur)
   */
  function linePath(values, minY, maxY){
    if (!values.length) return '';
    var range = maxY - minY;
    function y(v){
      return range > 0 ? Math.round(Y_BASE - ((v - minY) / range) * Y_SPAN) : Y_BASE;
    }
    if (values.length === 1) {
      var ySolo = y(values[0]);
      return 'M ' + X_LEFT + ' ' + ySolo + ' L ' + (X_LEFT + X_SPAN) + ' ' + ySolo;
    }
    return values.map(function(v, idx){
      var x = Math.round((idx / (values.length - 1)) * X_SPAN) + X_LEFT;
      return (idx === 0 ? 'M ' : 'L ') + x + ' ' + y(v);
    }).join(' ');
  }

  /**
   * Cumul progressif : [1, 2, 3] → [1, 3, 6].
   * @param {number[]} values
   * @returns {number[]}
   */
  function cumulative(values){
    var sum = 0;
    return values.map(function(v){ sum += v; return sum; });
  }

  // ---- Dates ISO (arithmétique UTC sur 'YYYY-MM-DD' : indépendante du fuseau) ----

  function _parseISO(iso){
    var p = String(iso).split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  }

  function _formatISO(d){
    return d.toISOString().slice(0, 10);
  }

  /**
   * @param {string} iso 'YYYY-MM-DD'
   * @param {number} days décalage (peut être négatif)
   * @returns {string}
   */
  function addDaysISO(iso, days){
    var d = _parseISO(iso);
    d.setUTCDate(d.getUTCDate() + days);
    return _formatISO(d);
  }

  /**
   * Lundi de la semaine contenant la date.
   * @param {string} iso 'YYYY-MM-DD'
   * @returns {string}
   */
  function weekStartISO(iso){
    var d = _parseISO(iso);
    var sinceMonday = (d.getUTCDay() + 6) % 7; // lundi → 0, dimanche → 6
    d.setUTCDate(d.getUTCDate() - sinceMonday);
    return _formatISO(d);
  }

  // ---- Santé ----

  /**
   * Arrondit au pas de saisie (0.1, 1…) sans erreurs de flottant.
   * @param {number} v
   * @param {number} step
   * @returns {number}
   */
  function roundByStep(v, step){
    if (!isFinite(step) || step <= 0) return Number(v) || 0;
    var rounded = Math.round(v / step) * step;
    var decimals = (String(step).split('.')[1] || '').length;
    return Number(rounded.toFixed(Math.min(6, decimals)));
  }

  /**
   * Borne une valeur à [def.min, def.max] puis l'arrondit au pas ; non numérique → 0.
   * @param {{min:number, max:number, step:number}} def
   * @param {*} v
   * @returns {number}
   */
  function clampMetric(def, v){
    var n = Number(v);
    if (!isFinite(n)) return 0;
    if (n < def.min) return def.min;
    if (n > def.max) return def.max;
    return roundByStep(n, def.step);
  }

  /**
   * Entrée santé brute RTDB → toutes les métriques bornées + ts.
   * @param {*} raw
   * @param {Array<{key:string, min:number, max:number, step:number}>} metrics
   * @param {number} [nowTs] ts de repli si absent/invalide (défaut : maintenant)
   * @returns {Object<string, number>}
   */
  function normalizeHealthEntry(raw, metrics, nowTs){
    raw = raw && typeof raw === 'object' ? raw : {};
    var tsNum = Number(raw.ts);
    var out = { ts: (isFinite(tsNum) && tsNum > 0) ? tsNum : (typeof nowTs === 'number' ? nowTs : Date.now()) };
    metrics.forEach(function(def){
      out[def.key] = clampMetric(def, raw[def.key]);
    });
    return out;
  }

  /**
   * @param {{unit:string, step:number}} def
   * @param {number} val
   * @returns {string} '72 bpm', '7.5/10'…
   */
  function formatHealthValue(def, val){
    if (def.step === 1) return String(Math.round(val)) + def.unit;
    return val.toFixed(1) + def.unit;
  }

  /**
   * Série chronologique d'une métrique santé.
   * @param {Object<string,*>|null} healthTree { [date]: entrée }
   * @param {{key:string}} def
   * @param {Array} metrics
   * @returns {Array<{date:string, val:number}>}
   */
  function healthSeries(healthTree, def, metrics){
    var tree = healthTree && typeof healthTree === 'object' ? healthTree : {};
    return Object.keys(tree).sort().map(function(date){
      return { date: date, val: normalizeHealthEntry(tree[date], metrics, 0)[def.key] };
    });
  }

  // ---- Training ----

  /**
   * @param {*} v
   * @returns {number} nombre fini strictement positif, sinon 0
   */
  function positiveNumber(v){
    var n = Number(v);
    return isFinite(n) && n > 0 ? n : 0;
  }

  /**
   * Entrée training brute → compteurs positifs (squats/pompes entiers) + ts.
   * @param {*} raw
   * @param {number} [nowTs]
   * @returns {{squats:number, pushups:number, absMin:number, runKm:number, ts:number}}
   */
  function normalizeTrainingEntry(raw, nowTs){
    raw = raw && typeof raw === 'object' ? raw : {};
    var tsNum = Number(raw.ts);
    return {
      squats: Math.round(positiveNumber(raw.squats)),
      pushups: Math.round(positiveNumber(raw.pushups)),
      absMin: positiveNumber(raw.absMin),
      runKm: positiveNumber(raw.runKm),
      ts: (isFinite(tsNum) && tsNum > 0) ? tsNum : (typeof nowTs === 'number' ? nowTs : Date.now())
    };
  }

  /**
   * @param {string} key exercice
   * @param {number} val
   * @returns {string}
   */
  function formatTrainingValue(key, val){
    if (key === 'runKm') return val.toFixed(1);
    if (key === 'absMin') return val.toFixed(val % 1 === 0 ? 0 : 1);
    return String(Math.round(val));
  }

  /**
   * Série chronologique d'un exercice.
   * @param {Object<string,*>|null} trainingTree { [date]: entrée }
   * @param {string} key
   * @returns {Array<{date:string, val:number}>}
   */
  function trainingSeries(trainingTree, key){
    var tree = trainingTree && typeof trainingTree === 'object' ? trainingTree : {};
    return Object.keys(tree).sort().map(function(date){
      return { date: date, val: normalizeTrainingEntry(tree[date], 0)[key] };
    });
  }

  /**
   * Total d'un exercice sur les 7 jours à partir de weekStart.
   * @param {Object<string,*>|null} trainingTree
   * @param {string} key
   * @param {string} weekStart 'YYYY-MM-DD' (lundi)
   * @returns {number}
   */
  function weekTotal(trainingTree, key, weekStart){
    var tree = trainingTree && typeof trainingTree === 'object' ? trainingTree : {};
    var total = 0;
    for (var i = 0; i < 7; i++){
      var d = addDaysISO(weekStart, i);
      if (tree[d]) total += normalizeTrainingEntry(tree[d], 0)[key];
    }
    return total;
  }

  var api = {
    linePath: linePath,
    cumulative: cumulative,
    addDaysISO: addDaysISO,
    weekStartISO: weekStartISO,
    roundByStep: roundByStep,
    clampMetric: clampMetric,
    normalizeHealthEntry: normalizeHealthEntry,
    formatHealthValue: formatHealthValue,
    healthSeries: healthSeries,
    positiveNumber: positiveNumber,
    normalizeTrainingEntry: normalizeTrainingEntry,
    formatTrainingValue: formatTrainingValue,
    trainingSeries: trainingSeries,
    weekTotal: weekTotal
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.DashboardCore = api;
})();
