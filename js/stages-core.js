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
  function isValidStageDate(dateISO){
    if(typeof dateISO!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(dateISO))return false;
    var parts=dateISO.split('-').map(function(v){return Number(v);});
    var dt=new Date(Date.UTC(parts[0],parts[1]-1,parts[2]));
    return dt.getUTCFullYear()===parts[0]&&dt.getUTCMonth()===(parts[1]-1)&&dt.getUTCDate()===parts[2];
  }
  function normalizeStageSource(source){
    if(!source||typeof source!=='object')return null;
    var lat=Number(source.lat);
    var lon=Number(source.lon);
    var kmTotal=Number(source.kmTotal);
    if(!isFinite(lat)||!isFinite(lon)||!isFinite(kmTotal))return null;
    return {lat:lat,lon:lon,kmTotal:Math.round(kmTotal*10)/10};
  }
  function findStageAnchor(dateISO,stages){
    var dates=Object.keys(stages||{}).sort();
    for(var i=dates.length-1;i>=0;i--){
      if(dates[i]<dateISO)return normalizeStageSource(stages[dates[i]]);
    }
    for(var j=0;j<dates.length;j++){
      if(dates[j]>dateISO)return normalizeStageSource(stages[dates[j]]);
    }
    return null;
  }
  function buildManualStage(dateISO,stages,current,nowTs){
    if(!isValidStageDate(dateISO))return {ok:false,error:'Choisis une date valide.'};
    stages=stages||{};
    if(stages[dateISO])return {ok:false,error:'Une étape existe déjà pour cette date.'};
    var refNow=(typeof nowTs==='number'&&isFinite(nowTs)&&nowTs>0)?nowTs:Date.now();
    var todayISO=new Date(refNow).toISOString().slice(0,10);
    if(dateISO>todayISO)return {ok:false,error:'Impossible de créer une étape dans le futur.'};
    var anchor=findStageAnchor(dateISO,stages)||normalizeStageSource(current);
    if(!anchor)return {ok:false,error:'Aucune position de référence disponible pour créer cette étape.'};
    return {
      ok:true,
      stageData:{
        lat:anchor.lat,
        lon:anchor.lon,
        kmTotal:anchor.kmTotal,
        kmDay:0,
        elevGain:0,
        note:'',
        published:false,
        ts:refNow
      }
    };
  }
  var api={
    countryFlag:countryFlag,
    formatStageDateLabel:formatStageDateLabel,
    computeRecapTotals:computeRecapTotals,
    isValidStageDate:isValidStageDate,
    buildManualStage:buildManualStage
  };
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.StagesCore=api;
})();
