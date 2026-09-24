(function(){
  function countBravos(bravosData){
    return Object.keys(bravosData||{}).length;
  }
  function hasVoted(bravosData,visitorId){
    return !!(bravosData&&bravosData[visitorId]);
  }
  function buildKmInfoLabel(stage){
    if(!stage||!stage.kmDay)return '';
    var elevGain=Math.max(0,Math.round(Number(stage.elevGain)||0));
    return '\uD83D\uDEB4 '+Math.round(stage.kmDay)+' km'+(elevGain?' \u00b7 \u26f0\ufe0f D+ '+elevGain+' m':'');
  }
  function formatJournalDateLabel(dateISO,locale){
    return new Date(dateISO+'T12:00:00').toLocaleDateString(locale||'fr-FR',{weekday:'long',day:'numeric',month:'long'});
  }
  /**
   * Fusionne un snapshot distant des journaux avec les brouillons admin pas
   * encore confirmés par Firebase : un brouillon en attente gagne toujours sur
   * la valeur distante (sinon le listener temps réel écraserait la saisie).
   * Brouillon non-string → repli sur la valeur locale, sinon ''.
   * @param {Object<string,string>|null} remote   snapshot journals/ (peut être null)
   * @param {Object<string,*>|null} drafts        brouillons en attente par date
   * @param {Object<string,string>|null} local    journaux locaux courants
   * @returns {Object<string,string>} nouvel objet (aucune entrée n'est mutée)
   */
  function mergeRemoteWithDrafts(remote,drafts,local){
    var merged=Object.assign({},(remote&&typeof remote==='object')?remote:{});
    var pending=(drafts&&typeof drafts==='object')?drafts:{};
    var current=(local&&typeof local==='object')?local:{};
    Object.keys(pending).forEach(function(date){
      merged[date]=typeof pending[date]==='string'
        ?pending[date]
        :(typeof current[date]==='string'?current[date]:'');
    });
    return merged;
  }
  var api={
    countBravos:countBravos,
    hasVoted:hasVoted,
    buildKmInfoLabel:buildKmInfoLabel,
    formatJournalDateLabel:formatJournalDateLabel,
    mergeRemoteWithDrafts:mergeRemoteWithDrafts
  };
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.JournalCore=api;
})();
