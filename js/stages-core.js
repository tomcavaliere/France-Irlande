(function(){
  function countryFlag(idx,franceEndIdx){
    if(!isFinite(idx)||idx<0)return '';
    return idx<=franceEndIdx?'\uD83C\uDDEB\uD83C\uDDF7':'\uD83C\uDDEE\uD83C\uDDEA';
  }
  function formatStageDateLabel(dateISO){
    return new Date(dateISO+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
  }
  function computeRecapTotals(kmDone,kmLeft,nbDays,totalKm){
    var pct=Math.max(0,Math.min(100,Math.round((kmDone/totalKm)*100)));
    var avgKmPerDay=nbDays>0?Math.round(kmDone/nbDays):0;
    return {pct:pct,avgKmPerDay:avgKmPerDay};
  }
  var api={countryFlag:countryFlag,formatStageDateLabel:formatStageDateLabel,computeRecapTotals:computeRecapTotals};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.StagesCore=api;
})();
