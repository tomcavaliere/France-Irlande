// utils.js
// Helpers purs (escaping HTML, formatage de date, agrégation de dépenses).
// Double export navigateur/CommonJS pour partager le code avec les tests.

(function(){
  // Échappe les caractères dangereux dans une valeur d'attribut HTML.
  function escAttr(s){
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/'/g, '&#39;')
      .replace(/"/g, '&quot;');
  }

  // Échappe les caractères dangereux dans du contenu HTML (texte).
  function escHtml(s){
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Formate un timestamp en "12 mars à 14:30" (locale fr-FR).
  function formatTime(ts){
    var d = new Date(ts);
    return d.toLocaleDateString('fr-FR', { day:'numeric', month:'short' }) +
           ' à ' +
           d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
  }

  // Catégories de dépenses autorisées (liste fermée, cohérente avec l'UI).
  var EXPENSE_CATEGORIES = [
    'Hébergement', 'Nourriture', 'Transport', 'Équipement', 'Loisirs', 'Autre'
  ];

  // Personnes pouvant effectuer une dépense (liste fermée).
  var EXPENSE_PERSONS = ['Tom', 'Chloé'];

  // Limites de taille partagées entre validation client et règles Firebase.
  var LIMITS = {
    COMMENT_NAME: 30,
    COMMENT_TEXT: 500,
    EXPENSE_DESC: 100,
    EXPENSE_MAX_AMOUNT: 10000,
    JOURNAL_TEXT: 5000
  };

  // Valide un commentaire {name, text}. Retourne {ok, error?}.
  // - name: requis, trim non vide, max 30 caractères
  // - text: requis, trim non vide, max 500 caractères
  function validateComment(c){
    if (!c || typeof c !== 'object') {
      return { ok: false, error: 'Commentaire invalide.' };
    }
    var name = (typeof c.name === 'string') ? c.name.trim() : '';
    var text = (typeof c.text === 'string') ? c.text.trim() : '';
    if (!name) return { ok: false, error: 'Le nom est requis.' };
    if (name.length > LIMITS.COMMENT_NAME) {
      return { ok: false, error: 'Le nom ne doit pas dépasser ' + LIMITS.COMMENT_NAME + ' caractères.' };
    }
    if (!text) return { ok: false, error: 'Le commentaire est vide.' };
    if (text.length > LIMITS.COMMENT_TEXT) {
      return { ok: false, error: 'Le commentaire ne doit pas dépasser ' + LIMITS.COMMENT_TEXT + ' caractères.' };
    }
    return { ok: true };
  }

  // Valide une dépense {amount, cat, date, desc}. Retourne {ok, error?}.
  // - amount: nombre fini, strictement > 0, < 10000
  // - cat: dans EXPENSE_CATEGORIES
  // - date: chaîne ISO YYYY-MM-DD
  // - desc: optionnel, max 100 caractères
  function validateExpense(e){
    if (!e || typeof e !== 'object') {
      return { ok: false, error: 'Dépense invalide.' };
    }
    var amount = Number(e.amount);
    if (!isFinite(amount) || amount <= 0) {
      return { ok: false, error: 'Le montant doit être supérieur à 0.' };
    }
    if (amount >= LIMITS.EXPENSE_MAX_AMOUNT) {
      return { ok: false, error: 'Le montant doit être inférieur à ' + LIMITS.EXPENSE_MAX_AMOUNT + ' €.' };
    }
    if (EXPENSE_CATEGORIES.indexOf(e.cat) === -1) {
      return { ok: false, error: 'Catégorie invalide.' };
    }
    if (typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
      return { ok: false, error: 'Date invalide (format YYYY-MM-DD attendu).' };
    }
    if (e.desc !== null && e.desc !== undefined) {
      if (typeof e.desc !== 'string') {
        return { ok: false, error: 'Description invalide.' };
      }
      if (e.desc.length > LIMITS.EXPENSE_DESC) {
        return { ok: false, error: 'La description ne doit pas dépasser ' + LIMITS.EXPENSE_DESC + ' caractères.' };
      }
    }
    if (EXPENSE_PERSONS.indexOf(e.paidBy) === -1) {
      return { ok: false, error: 'Le payeur doit être Tom ou Chloé.' };
    }
    return { ok: true };
  }

  // Valide un texte de journal. Retourne {ok, error?}.
  // - Vide autorisé (permet l'effacement d'une entrée).
  // - Max 5000 caractères.
  function validateJournal(text){
    if (text === null || text === undefined) return { ok: true };
    if (typeof text !== 'string') {
      return { ok: false, error: 'Entrée de journal invalide.' };
    }
    if (text.length > LIMITS.JOURNAL_TEXT) {
      return { ok: false, error: 'L\'entrée ne doit pas dépasser ' + LIMITS.JOURNAL_TEXT + ' caractères.' };
    }
    return { ok: true };
  }

  // Quota RTDB Firebase : limite du plan gratuit (1 Go).
  var RTDB_QUOTA_BYTES = 1024 * 1024 * 1024;

  // Estime la taille (octets décodés) d'un arbre photos Firebase.
  // Entrée : { [stage]: { [photoId]: base64String } } — structure exacte de `photos/` en RTDB.
  // Pour chaque string base64, octets décodés ≈ length * 0.75 (ignore un éventuel préfixe data:...).
  // Fonction pure, testable, sans dépendance Firebase.
  function computeQuotaBytes(photosTree){
    var count = 0;
    var bytes = 0;
    if (!photosTree || typeof photosTree !== 'object') return { count: 0, bytes: 0 };
    Object.keys(photosTree).forEach(function(stage){
      var stageObj = photosTree[stage];
      if (!stageObj || typeof stageObj !== 'object') return;
      Object.keys(stageObj).forEach(function(id){
        var v = stageObj[id];
        if (typeof v !== 'string') return;
        count++;
        var b64 = v;
        var comma = b64.indexOf(',');
        if (comma !== -1) b64 = b64.slice(comma + 1);
        bytes += Math.floor(b64.length * 0.75);
      });
    });
    return { count: count, bytes: bytes };
  }

  // Formate un nombre d'octets en chaîne lisible (B, KB, MB, GB).
  function formatBytes(bytes){
    if (!isFinite(bytes) || bytes < 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  // Niveau d'alerte quota : 'ok' < 70% ≤ 'warn' < 85% ≤ 'high' < 90% ≤ 'block'.
  function quotaLevel(bytes, quota){
    var q = quota || RTDB_QUOTA_BYTES;
    var pct = bytes / q;
    if (pct >= 0.90) return 'block';
    if (pct >= 0.85) return 'high';
    if (pct >= 0.70) return 'warn';
    return 'ok';
  }

  // Wrapper fetch durci : timeout (AbortController) + retries avec backoff exponentiel.
  // - cfg.retries  : nombre de retries après le premier essai (défaut 2 → 3 tentatives max)
  // - cfg.timeout  : ms avant abort (défaut 15000)
  // - cfg.backoff  : délai initial entre retries (défaut 1000 → 1s, 2s, 4s...)
  // - cfg.onError  : callback(err, nextAttempt) appelé entre chaque retry (ex. toast UI)
  // - cfg.fetch    : injection pour tests (sinon globalThis.fetch)
  // Résout avec la Response si r.ok, rejette sinon (erreur HTTP XXX ou réseau).
  // L'appelant reste responsable du .json() / .text().
  function safeFetch(url, opts, cfg){
    opts = opts || {};
    cfg = cfg || {};
    var retries = (cfg.retries !== null && cfg.retries !== undefined) ? cfg.retries : 2;
    var timeout = cfg.timeout || 15000;
    var backoff = (cfg.backoff !== null && cfg.backoff !== undefined) ? cfg.backoff : 1000;
    var onError = cfg.onError;
    var fetchImpl = ('fetch' in cfg) ? cfg.fetch : (typeof globalThis !== 'undefined' ? globalThis.fetch : null);
    if (typeof fetchImpl !== 'function') {
      return Promise.reject(new Error('fetch indisponible'));
    }
    function attempt(n){
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function(){ ctrl.abort(); }, timeout) : null;
      var o = Object.assign({}, opts);
      if (ctrl && !o.signal) o.signal = ctrl.signal;
      return fetchImpl(url, o).then(function(r){
        if (timer) clearTimeout(timer);
        if (!r.ok) {
          var err = new Error('HTTP ' + r.status);
          err.status = r.status;
          throw err;
        }
        return r;
      }, function(err){
        if (timer) clearTimeout(timer);
        throw err;
      }).catch(function(err){
        if (n < retries) {
          if (typeof onError === 'function') {
            try { onError(err, n + 1); } catch (_) { /* callback ne doit pas casser la chaîne */ }
          }
          var delay = backoff * Math.pow(2, n);
          return new Promise(function(res){ setTimeout(res, delay); }).then(function(){ return attempt(n + 1); });
        }
        throw err;
      });
    }
    return attempt(0);
  }

  // Agrège un objet de dépenses {id: {amount, cat, date, desc, paidBy}} en un résumé.
  // Retourne {total, days, perDay, byCat, byDate, byPerson, balance}.
  // - byCat : { [cat]: total }
  // - byDate : { [yyyy-mm-dd]: [{id, expense}] } (ordre d'insertion)
  // - byPerson : { [person]: total } — uniquement les dépenses avec paidBy renseigné
  // - balance : (Tom - Chloé) / 2 → positif : Chloé doit à Tom ; négatif : Tom doit à Chloé
  // - days : nombre de jours distincts (>=1 pour éviter les divisions par zéro)
  function summarizeExpenses(expenses){
    var ids = Object.keys(expenses || {});
    var total = 0, byCat = {}, byDate = {}, byPerson = {};
    ids.forEach(function(id){
      var e = expenses[id];
      var amt = Number(e.amount) || 0;
      total += amt;
      byCat[e.cat] = (byCat[e.cat] || 0) + amt;
      if (!byDate[e.date]) byDate[e.date] = [];
      byDate[e.date].push({ id: id, expense: e });
      if (e.paidBy && EXPENSE_PERSONS.indexOf(e.paidBy) !== -1) {
        byPerson[e.paidBy] = (byPerson[e.paidBy] || 0) + amt;
      }
    });
    var days = Object.keys(byDate).length || 1;
    var tomTotal = byPerson['Tom'] || 0;
    var chloeTotal = byPerson['Chloé'] || 0;
    var balance = (tomTotal - chloeTotal) / 2;
    return {
      total: total,
      days: days,
      perDay: total / days,
      byCat: byCat,
      byDate: byDate,
      byPerson: byPerson,
      balance: balance
    };
  }

  // Calcule les km parcourus aujourd'hui (différence avec la veille la plus récente).
  function computeKmDay(kmTotal, stages, todayISO) {
    var dates = Object.keys(stages || {}).filter(function(d) { return d < todayISO; }).sort();
    if (!dates.length) return Math.max(0, Math.round(kmTotal));
    var prev = stages[dates[dates.length - 1]];
    var prevKm = (prev && prev.kmTotal) || 0;
    return Math.max(0, Math.round(kmTotal - prevKm));
  }

  // Filter tracks to only include entries with dates matching existing stages.
  // Orphan tracks (without a corresponding stage date) are excluded.
  // If stages are not loaded yet, return tracks unchanged.
  function filterTracksByStages(tracks, stages){
    if(!tracks || typeof tracks !== 'object') return {};
    if(!stages || typeof stages !== 'object') return tracks;
    var stageDates = Object.keys(stages);
    if(!stageDates.length) return tracks;
    return stageDates.reduce(function(acc, date){
      if(tracks[date]) acc[date] = tracks[date];
      return acc;
    }, {});
  }

  // Indique si un write peut passer par la queue offline.
  function isOfflineable(path) {
    if (typeof path !== 'string') return false;
    if (path === 'current') return true;
    if (path.indexOf('stages/') === 0) return true;
    if (path.indexOf('journals/') === 0) return true;
    return false;
  }

  // Label humain pour une path Firebase (pour toasts, queue summary).
  function actionLabel(path) {
    if (typeof path !== 'string') return 'élément';
    if (path === 'current') return 'position';
    if (path.indexOf('stages/') === 0) {
      var seg = path.split('/').pop();
      if (seg === 'note') return 'note';
      if (seg === 'published') return 'publication';
      if (seg === 'journalDeleted') return 'suppression';
      return 'étape';
    }
    if (path.indexOf('journals/') === 0) return 'journal';
    if (path.indexOf('photos/') === 0) return 'photo';
    if (path.indexOf('comments/') === 0) return 'commentaire';
    if (path.indexOf('bravos/') === 0) return 'bravo';
    if (path.indexOf('expenses/') === 0) return 'dépense';
    return 'élément';
  }

  // Valide un nom de visiteur (prénom ou prénom + nom).
  // Format accepté : lettre(s)/tiret/apostrophe, une seule espace entre prénom et nom.
  // Longueur : 2 à LIMITS.COMMENT_NAME caractères.
  function validateVisitorName(name){
    if(!name||typeof name!=='string'){
      return{ok:false,error:'Le prénom est requis.'};
    }
    var n=name.trim();
    if(!n)return{ok:false,error:'Le prénom est requis.'};
    if(n.length<2)return{ok:false,error:'Le prénom est trop court (2 caractères minimum).'};
    if(n.length>LIMITS.COMMENT_NAME){
      return{ok:false,error:'Le nom ne doit pas dépasser '+LIMITS.COMMENT_NAME+' caractères.'};
    }
    // Prénom ou Prénom Nom (lettres, tirets, apostrophes, une seule espace entre les deux mots)
    var re=/^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'-]*( [A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'-]*)?$/;
    if(!re.test(n)){
      return{ok:false,error:'Format invalide. Utilise ton prénom ou prénom + nom (lettres uniquement).'};
    }
    return{ok:true};
  }

  // Durée du cooldown entre deux commentaires consécutifs sur la même étape (ms).
  var COMMENT_COOLDOWN_MS = 30 * 1000;

  // Retourne true si l'utilisateur est encore en période de cooldown.
  // - lastSentTs : timestamp (ms) du dernier commentaire envoyé (0 si jamais envoyé).
  // - nowTs      : timestamp courant (ms), injectable pour les tests.
  // - cooldownMs : durée du cooldown (défaut COMMENT_COOLDOWN_MS).
  function isCommentOnCooldown(lastSentTs, nowTs, cooldownMs) {
    if (!lastSentTs || lastSentTs <= 0) return false;
    var cd = (cooldownMs !== null && cooldownMs !== undefined) ? cooldownMs : COMMENT_COOLDOWN_MS;
    var now = (nowTs !== null && nowTs !== undefined) ? nowTs : Date.now();
    return (now - lastSentTs) < cd;
  }

  // Nombre de secondes restantes avant la fin du cooldown (0 si aucun cooldown actif).
  function commentCooldownRemaining(lastSentTs, nowTs, cooldownMs) {
    if (!lastSentTs || lastSentTs <= 0) return 0;
    var cd = (cooldownMs !== null && cooldownMs !== undefined) ? cooldownMs : COMMENT_COOLDOWN_MS;
    var now = (nowTs !== null && nowTs !== undefined) ? nowTs : Date.now();
    var remaining = cd - (now - lastSentTs);
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  // Dates à afficher dans le carnet. Visiteur : published=true seulement.
  function filterVisibleJournalDates(stages, isAdmin) {
    if (!stages || typeof stages !== 'object') return [];
    return Object.keys(stages)
      .filter(function(d) {
        var s = stages[d];
        if (!s || s.journalDeleted) return false;
        if (isAdmin) return true;
        return s.published === true;
      })
      .sort()
      .reverse();
  }

  var api = {
    escAttr: escAttr,
    escHtml: escHtml,
    formatTime: formatTime,
    summarizeExpenses: summarizeExpenses,
    validateComment: validateComment,
    validateExpense: validateExpense,
    validateJournal: validateJournal,
    EXPENSE_CATEGORIES: EXPENSE_CATEGORIES,
    EXPENSE_PERSONS: EXPENSE_PERSONS,
    LIMITS: LIMITS,
    computeQuotaBytes: computeQuotaBytes,
    formatBytes: formatBytes,
    quotaLevel: quotaLevel,
    RTDB_QUOTA_BYTES: RTDB_QUOTA_BYTES,
    safeFetch: safeFetch,
    computeKmDay: computeKmDay,
    filterTracksByStages: filterTracksByStages,
    isOfflineable: isOfflineable,
    actionLabel: actionLabel,
    filterVisibleJournalDates: filterVisibleJournalDates,
    COMMENT_COOLDOWN_MS: COMMENT_COOLDOWN_MS,
    isCommentOnCooldown: isCommentOnCooldown,
    commentCooldownRemaining: commentCooldownRemaining,
    validateVisitorName: validateVisitorName
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.Utils = api;
})();
