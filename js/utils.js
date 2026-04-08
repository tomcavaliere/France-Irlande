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
    if (e.desc != null) {
      if (typeof e.desc !== 'string') {
        return { ok: false, error: 'Description invalide.' };
      }
      if (e.desc.length > LIMITS.EXPENSE_DESC) {
        return { ok: false, error: 'La description ne doit pas dépasser ' + LIMITS.EXPENSE_DESC + ' caractères.' };
      }
    }
    return { ok: true };
  }

  // Valide un texte de journal. Retourne {ok, error?}.
  // - Vide autorisé (permet l'effacement d'une entrée).
  // - Max 5000 caractères.
  function validateJournal(text){
    if (text == null) return { ok: true };
    if (typeof text !== 'string') {
      return { ok: false, error: 'Entrée de journal invalide.' };
    }
    if (text.length > LIMITS.JOURNAL_TEXT) {
      return { ok: false, error: 'L\'entrée ne doit pas dépasser ' + LIMITS.JOURNAL_TEXT + ' caractères.' };
    }
    return { ok: true };
  }

  // Agrège un objet de dépenses {id: {amount, cat, date, desc}} en un résumé.
  // Retourne {total, days, perDay, byCat, byDate}.
  // - byCat : { [cat]: total }
  // - byDate : { [yyyy-mm-dd]: [{id, expense}] } (ordre d'insertion)
  // - days : nombre de jours distincts (>=1 pour éviter les divisions par zéro)
  function summarizeExpenses(expenses){
    var ids = Object.keys(expenses || {});
    var total = 0, byCat = {}, byDate = {};
    ids.forEach(function(id){
      var e = expenses[id];
      var amt = Number(e.amount) || 0;
      total += amt;
      byCat[e.cat] = (byCat[e.cat] || 0) + amt;
      if (!byDate[e.date]) byDate[e.date] = [];
      byDate[e.date].push({ id: id, expense: e });
    });
    var days = Object.keys(byDate).length || 1;
    return {
      total: total,
      days: days,
      perDay: total / days,
      byCat: byCat,
      byDate: byDate
    };
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
    LIMITS: LIMITS
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.Utils = api;
})();
