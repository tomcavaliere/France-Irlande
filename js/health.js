// health.js
// Admin-only daily health tracker with per-metric timeline graphs.

var HEALTH_METRICS=[
  {key:'sleep',label:'Sommeil ressenti',unit:'/10',min:0,max:10,step:0.1},
  {key:'form',label:'Forme ressentie',unit:'/10',min:0,max:10,step:0.1},
  {key:'meals',label:'Qualité des repas',unit:'/10',min:0,max:10,step:0.1},
  {key:'soreness',label:'Courbatures',unit:'/10',min:0,max:10,step:0.1},
  {key:'hrAvg',label:'FC moy vélo',unit:' bpm',min:0,max:250,step:1},
  {key:'hrMax',label:'FC max vélo',unit:' bpm',min:0,max:250,step:1},
  {key:'tempMin',label:'Température min',unit:' °C',min:-30,max:60,step:0.1},
  {key:'tempMax',label:'Température max',unit:' °C',min:-30,max:60,step:0.1},
  {key:'tempAvg',label:'Température moy',unit:' °C',min:-30,max:60,step:0.1}
];

function _roundByStep(v,step){
  if(!Number.isFinite(step)||step<=0)return Number(v)||0;
  var rounded=Math.round(v/step)*step;
  var decimals=(String(step).split('.')[1]||'').length;
  return Number(rounded.toFixed(Math.min(6,decimals)));
}

function _clampMetric(def,v){
  var n=Number(v);
  if(!Number.isFinite(n))return 0;
  if(n<def.min)return def.min;
  if(n>def.max)return def.max;
  return _roundByStep(n,def.step);
}

function _normalizeHealthEntry(raw){
  raw=raw&&typeof raw==='object'?raw:{};
  var tsNum=Number(raw.ts);
  var out={ts:(Number.isFinite(tsNum)&&tsNum>0)?tsNum:Date.now()};
  HEALTH_METRICS.forEach(function(def){
    out[def.key]=_clampMetric(def,raw[def.key]);
  });
  return out;
}

function _fmtHealthValue(def,val){
  if(def.step===1)return String(Math.round(val))+def.unit;
  return val.toFixed(1)+def.unit;
}

function _linePathHealth(values,minY,maxY){
  if(!values.length)return '';
  var rawRange=maxY-minY;
  var range=Math.abs(rawRange)<0.01?1:rawRange;
  if(values.length===1){
    var ySolo=Math.round(62-((values[0]-minY)/range)*54);
    return 'M 4 '+ySolo+' L 96 '+ySolo;
  }
  var path='';
  values.forEach(function(v,idx){
    var x=Math.round((idx/(values.length-1))*92)+4;
    var y=Math.round(62-((v-minY)/range)*54);
    path+=(idx===0?'M ':' L ')+x+' '+y;
  });
  return path;
}

function _healthDailySeries(def){
  return Object.keys(health||{}).sort().map(function(date){
    var entry=_normalizeHealthEntry(health[date]);
    return {date:date,val:entry[def.key]};
  });
}

function _healthInputId(key){
  return 'health'+key.charAt(0).toUpperCase()+key.slice(1);
}

function _renderHealthSummary(){
  var html='<div class="health-cards">';
  HEALTH_METRICS.forEach(function(def){
    var series=_healthDailySeries(def);
    var avg=0;
    if(series.length){
      var sum=series.reduce(function(acc,it){return acc+it.val;},0);
      avg=sum/series.length;
    }
    var latest=series.length?series[series.length-1].val:0;
    html+='<div class="health-card">'+
      '<div class="health-title"><b>'+def.label+'</b>'+
      '<span>Dernier: '+_fmtHealthValue(def,latest)+' · Moy: '+_fmtHealthValue(def,avg)+'</span></div>'+
    '</div>';
  });
  html+='</div>';
  var el=document.getElementById('healthSummary');
  if(el)el.innerHTML=html;
}

function _renderHealthGraphs(){
  var html='';
  HEALTH_METRICS.forEach(function(def){
    var series=_healthDailySeries(def);
    var vals=series.map(function(it){return it.val;});
    var path=_linePathHealth(vals,def.min,def.max);
    var latest=series.length?series[series.length-1]:null;
    var subtitle=latest
      ? 'Dernier jour : '+latest.date+' · '+_fmtHealthValue(def,latest.val)
      : 'Aucune donnée pour le moment.';
    html+='<div class="health-card">'+
      '<div class="health-title"><b>'+def.label+'</b><span>Plage : '+def.min+' à '+def.max+def.unit+'</span></div>'+
      '<div class="health-graph">'+
        '<svg viewBox="0 0 100 68" role="img" aria-label="Graphique '+def.label+'">'+
          '<line x1="4" y1="62" x2="96" y2="62" stroke="#ddd" stroke-width="1"></line>'+
          '<path d="'+path+'" fill="none" stroke="#1a5e1f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>'+
        '</svg>'+
        '<div class="health-graph-label">'+subtitle+'</div>'+
      '</div>'+
    '</div>';
  });
  var el=document.getElementById('healthGraphs');
  if(el)el.innerHTML=html;
}

function renderHealth(){
  if(!isAdmin)return;
  _renderHealthSummary();
  _renderHealthGraphs();
}

function addHealthEntry(){
  if(!isAdmin)return;
  var dateEl=document.getElementById('healthDate');
  if(!dateEl)return;
  var date=(dateEl.value||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){
    showToast('Date santé invalide.','warn');
    return;
  }
  var entry={ts:Date.now()};
  var existing=_normalizeHealthEntry(health[date]||{});
  var hasValue=false;
  for(var i=0;i<HEALTH_METRICS.length;i++){
    var def=HEALTH_METRICS[i];
    var input=document.getElementById(_healthInputId(def.key));
    if(!input){
      showToast('Formulaire santé indisponible.','error');
      return;
    }
    var raw=(input.value||'').trim();
    if(raw!==''&&Number.isFinite(Number(raw))){
      hasValue=true;
      entry[def.key]=_clampMetric(def,raw);
    }else{
      entry[def.key]=existing[def.key];
    }
  }
  if(!hasValue){
    showToast('Ajoute au moins une valeur santé.','warn');
    return;
  }
  health[date]=_normalizeHealthEntry(entry);
  renderHealth();
  HEALTH_METRICS.forEach(function(def){
    var input=document.getElementById(_healthInputId(def.key));
    if(input)input.value='';
  });
  tryWrite('set','health/'+date,health[date]);
}

function initHealth(){
  var dateEl=document.getElementById('healthDate');
  if(dateEl&&!dateEl.value)dateEl.value=new Date().toISOString().slice(0,10);
  if(_unsubHealth)_unsubHealth();
  _unsubHealth=window._fbOnValue(
    window._fbRef(window._fbDb,'health'),
    function(snap){
      health=snap.val()||{};
      renderHealth();
    },
    function(err){
      console.error('[health] listen failed',err);
      showToast('Impossible de charger la santé.','error');
    }
  );
}
