// comments-core.js
// Logique pure des réponses admin aux commentaires : nom d'auteur affiché,
// normalisation d'une réponse brute RTDB.
// Pas de DOM, pas d'I/O. Double export navigateur/CommonJS pour les tests.

(function(){
  var DEFAULT_ADMIN_REPLY_AUTHOR = 'Tom';
  // Comptes admin reconnus (comparaison sans accents ni casse).
  var ADMIN_NAME_MAPPINGS = [
    { match: 'chloe', label: 'Chloé' },
    { match: 'tom', label: 'Tom' }
  ];

  /**
   * Nom d'auteur affiché pour une réponse admin, à partir d'un displayName,
   * d'un email ou d'un nom déjà stocké.
   * - contient « chloe »/« tom » (sans accents ni casse) → « Chloé »/« Tom »
   * - email → partie locale ; séparateurs . _ - → espaces ; Casse Des Mots
   * - vide → « Admin »
   * @param {*} value
   * @returns {string}
   */
  function normalizeAdminReplyAuthorName(value){
    var raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return 'Admin';
    var normalized = raw;
    try {
      normalized = raw.normalize('NFD').replace(/[̀-ͯ]/g, '');
    } catch (_err) { /* normalize() absent : comparaison sur la valeur brute */ }
    var lowered = normalized.toLowerCase();
    for (var i = 0; i < ADMIN_NAME_MAPPINGS.length; i++){
      if (lowered.indexOf(ADMIN_NAME_MAPPINGS[i].match) !== -1) return ADMIN_NAME_MAPPINGS[i].label;
    }
    if (raw.indexOf('@') !== -1) raw = raw.split('@')[0];
    raw = raw.replace(/[._-]+/g, ' ').trim();
    if (!raw) return 'Admin';
    return raw.split(/\s+/).map(function(part){
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join(' ');
  }

  /**
   * Normalise une réponse admin brute RTDB ; null si absente ou sans texte.
   * @param {*} raw
   * @returns {{text:string, ts:number, authorName:string, likes:Object, replies:Object}|null}
   */
  function normalizeCommentReply(raw){
    if (!raw || typeof raw !== 'object') return null;
    var text = typeof raw.text === 'string' ? raw.text.trim() : '';
    if (!text) return null;
    return {
      text: text,
      ts: typeof raw.ts === 'number' ? raw.ts : 0,
      authorName: normalizeAdminReplyAuthorName(raw.authorName || DEFAULT_ADMIN_REPLY_AUTHOR),
      likes: (raw.likes && typeof raw.likes === 'object') ? raw.likes : {},
      replies: (raw.replies && typeof raw.replies === 'object') ? raw.replies : {}
    };
  }

  var api = {
    DEFAULT_ADMIN_REPLY_AUTHOR: DEFAULT_ADMIN_REPLY_AUTHOR,
    normalizeAdminReplyAuthorName: normalizeAdminReplyAuthorName,
    normalizeCommentReply: normalizeCommentReply
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.CommentsCore = api;
})();
