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
  var api={countBravos:countBravos,hasVoted:hasVoted,buildKmInfoLabel:buildKmInfoLabel,formatJournalDateLabel:formatJournalDateLabel};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.JournalCore=api;
})();
