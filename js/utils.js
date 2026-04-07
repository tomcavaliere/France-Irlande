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
    summarizeExpenses: summarizeExpenses
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.Utils = api;
})();
