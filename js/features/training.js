// training.js
// Admin-only training tracker: weekly goals + cumulative graphs per exercise.

var TRAINING_EXERCISES=[
  {key:'squats',label:'Squats',goal:100,unit:''},
  {key:'pushups',label:'Pompes',goal:100,unit:''},
  {key:'absMin',label:'Abdos',goal:10,unit:' min'},
  {key:'runKm',label:'Course',goal:5,unit:' km'}
];

// Normalisation, semaines, séries et tracé des courbes : js/core/dashboard-core.js.
function _toNumber(v){ return DashboardCore.positiveNumber(v); }
function _normalizeTrainingEntry(raw){ return DashboardCore.normalizeTrainingEntry(raw); }
function _fmtTrainingValue(ex,val){ return DashboardCore.formatTrainingValue(ex.key,val); }

function _renderWeeklyCards(weekStart){
  var html='<div class="training-week">';
  TRAINING_EXERCISES.forEach(function(ex){
    var done=DashboardCore.weekTotal(training,ex.key,weekStart);
    var pct=Math.min(100,(done/ex.goal)*100);
    var reached=done>=ex.goal;
    html+='<div class="training-card">'+
      '<div class="training-title"><b>'+ex.label+'</b>'+
      '<span class="'+(reached?'ok':'')+'">'+_fmtTrainingValue(ex,done)+ex.unit+' / '+_fmtTrainingValue(ex,ex.goal)+ex.unit+(reached?' ✅':'')+'</span></div>'+
      '<progress class="training-progress" max="100" value="'+pct.toFixed(1)+'"></progress>'+
    '</div>';
  });
  html+='</div>';
  var box=document.getElementById('trainingWeek');
  if(box)box.innerHTML=html;
}

function _renderGraphs(){
  var html='';
  TRAINING_EXERCISES.forEach(function(ex){
    var daily=DashboardCore.trainingSeries(training,ex.key);
    var cumVals=DashboardCore.cumulative(daily.map(function(d){return d.val;}));
    var cum=cumVals.length?cumVals[cumVals.length-1]:0;
    var maxY=cumVals.reduce(function(m,v){return Math.max(m,v);},0);
    var path=DashboardCore.linePath(cumVals,0,maxY);
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
  var todayISO=Utils.localISODate();
  _renderWeeklyCards(DashboardCore.weekStartISO(todayISO));
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
  if(dateEl&&!dateEl.value)dateEl.value=Utils.localISODate();
  if(_unsubTraining)_unsubTraining();
  _unsubTraining=Db.on('training',
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
