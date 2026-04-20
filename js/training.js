// training.js
// Admin-only training tracker: weekly goals + cumulative graphs per exercise.

var TRAINING_EXERCISES=[
  {key:'squats',label:'Squats',goal:100,unit:''},
  {key:'pushups',label:'Pompes',goal:100,unit:''},
  {key:'absMin',label:'Abdos',goal:10,unit:' min'},
  {key:'runKm',label:'Course',goal:5,unit:' km'}
];

function _toNumber(v){
  var n=Number(v);
  return Number.isFinite(n)&&n>0?n:0;
}

function _normalizeTrainingEntry(raw){
  raw=raw&&typeof raw==='object'?raw:{};
  return {
    squats:Math.round(Math.max(0,_toNumber(raw.squats))),
    pushups:Math.round(Math.max(0,_toNumber(raw.pushups))),
    absMin:Math.max(0,_toNumber(raw.absMin)),
    runKm:Math.max(0,_toNumber(raw.runKm)),
    ts:Math.max(0,Number(raw.ts)||Date.now())
  };
}

function _addDaysISO(iso,days){
  var d=new Date(iso+'T12:00:00');
  d.setDate(d.getDate()+days);
  return d.toISOString().slice(0,10);
}

function _weekStartISO(iso){
  var d=new Date(iso+'T12:00:00');
  var jsDay=d.getDay(); // 0 dimanche, 1 lundi...
  var diff=(jsDay+6)%7; // lundi => 0
  d.setDate(d.getDate()-diff);
  return d.toISOString().slice(0,10);
}

function _fmtTrainingValue(ex,val){
  if(ex.key==='runKm')return val.toFixed(1);
  if(ex.key==='absMin'){
    var decimals=(val%1===0)?0:1;
    return val.toFixed(decimals);
  }
  return String(Math.round(val));
}

function _linePath(points,maxY){
  if(!points.length)return '';
  if(points.length===1){
    var ySolo=maxY<=0?62:Math.round(62-(points[0]/maxY)*54);
    return 'M 4 '+ySolo+' L 96 '+ySolo;
  }
  var path='';
  points.forEach(function(p,idx){
    var x=Math.round((idx/(points.length-1))*92)+4;
    var y=maxY<=0?62:Math.round(62-(p/maxY)*54);
    path+=(idx===0?'M ':' L ')+x+' '+y;
  });
  return path;
}

function _aggregateDaily(ex){
  var sums={};
  Object.keys(training||{}).forEach(function(date){
    var e=_normalizeTrainingEntry(training[date]);
    sums[date]=(sums[date]||0)+e[ex.key];
  });
  return Object.keys(sums).sort().map(function(date){return {date:date,val:sums[date]};});
}

function _weekTotal(ex,weekStart){
  var total=0;
  for(var i=0;i<7;i++){
    var d=_addDaysISO(weekStart,i);
    if(!training[d])continue;
    total+=_normalizeTrainingEntry(training[d])[ex.key];
  }
  return total;
}

function _renderWeeklyCards(weekStart){
  var html='<div class="training-week">';
  TRAINING_EXERCISES.forEach(function(ex){
    var done=_weekTotal(ex,weekStart);
    var pct=Math.min(100,(done/ex.goal)*100);
    var reached=done>=ex.goal;
    html+='<div class="training-card">'+
      '<div class="training-title"><b>'+ex.label+'</b>'+
      '<span class="'+(reached?'ok':'')+'">'+_fmtTrainingValue(ex,done)+ex.unit+' / '+_fmtTrainingValue(ex,ex.goal)+ex.unit+(reached?' ✅':'')+'</span></div>'+
      '<div class="training-progress"><div class="training-progress-fill" style="width:'+pct.toFixed(1)+'%"></div></div>'+
    '</div>';
  });
  html+='</div>';
  var box=document.getElementById('trainingWeek');
  if(box)box.innerHTML=html;
}

function _renderGraphs(){
  var html='';
  TRAINING_EXERCISES.forEach(function(ex){
    var daily=_aggregateDaily(ex);
    var cum=0;
    var cumVals=daily.map(function(d){cum+=d.val;return cum;});
    var maxY=cumVals.reduce(function(m,v){return Math.max(m,v);},0);
    var path=_linePath(cumVals,maxY);
    var latest=daily.length?daily[daily.length-1]:null;
    var subtitle=daily.length
      ? 'Dernier jour : '+latest.date+' · +'+_fmtTrainingValue(ex,latest.val)+ex.unit
      : 'Aucune donnée pour le moment.';
    html+='<div class="training-card">'+
      '<div class="training-title"><b>'+ex.label+'</b><span>Total cumulé : '+_fmtTrainingValue(ex,cum)+ex.unit+'</span></div>'+
      '<div class="training-graph">'+
        '<svg viewBox="0 0 100 68" role="img" aria-label="Graphique '+ex.label+'">'+
          '<line x1="4" y1="62" x2="96" y2="62" stroke="#ddd" stroke-width="1"></line>'+
          '<path d="'+path+'" fill="none" stroke="#1a5e1f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>'+
        '</svg>'+
        '<div class="training-graph-label">'+subtitle+'</div>'+
      '</div>'+
    '</div>';
  });
  var box=document.getElementById('trainingGraphs');
  if(box)box.innerHTML=html;
}

function renderTraining(){
  if(!isAdmin)return;
  var todayISO=new Date().toISOString().slice(0,10);
  _renderWeeklyCards(_weekStartISO(todayISO));
  _renderGraphs();
}

function addTrainingEntry(){
  if(!isAdmin)return;
  var dateEl=document.getElementById('trainingDate');
  if(!dateEl)return;
  var date=(dateEl.value||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){
    showToast('Date invalide.','warn');
    return;
  }
  var squatsEl=document.getElementById('trainingSquats');
  var pushupsEl=document.getElementById('trainingPushups');
  var absMinEl=document.getElementById('trainingAbsMin');
  var runKmEl=document.getElementById('trainingRunKm');
  if(!squatsEl||!pushupsEl||!absMinEl||!runKmEl){
    showToast('Formulaire training indisponible.','error');
    return;
  }
  var add={
    squats:_toNumber(squatsEl.value),
    pushups:_toNumber(pushupsEl.value),
    absMin:_toNumber(absMinEl.value),
    runKm:_toNumber(runKmEl.value)
  };
  if(add.squats===0&&add.pushups===0&&add.absMin===0&&add.runKm===0){
    showToast('Ajoute au moins une valeur.','warn');
    return;
  }
  var currentEntry=_normalizeTrainingEntry(training[date]||{});
  var next=_normalizeTrainingEntry({
    squats:currentEntry.squats+add.squats,
    pushups:currentEntry.pushups+add.pushups,
    absMin:currentEntry.absMin+add.absMin,
    runKm:currentEntry.runKm+add.runKm,
    ts:Date.now()
  });
  training[date]=next;
  renderTraining();
  ['trainingSquats','trainingPushups','trainingAbsMin','trainingRunKm'].forEach(function(id){
    var el=document.getElementById(id);
    if(el)el.value='';
  });
  tryWrite('set','training/'+date,next);
}

function initTraining(){
  var dateEl=document.getElementById('trainingDate');
  if(dateEl&&!dateEl.value)dateEl.value=new Date().toISOString().slice(0,10);
  if(_unsubTraining)_unsubTraining();
  _unsubTraining=window._fbOnValue(
    window._fbRef(window._fbDb,'training'),
    function(snap){
      training=snap.val()||{};
      renderTraining();
    },
    function(err){
      console.error('[training] listen failed',err);
      showToast('Impossible de charger le training.','error');
    }
  );
}
