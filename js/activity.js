// activity.js
// Admin-only activity dashboard + connection event tracking.

// Logique pure (normalisation, filtres, séries, classement) : js/activity-core.js.

function _activityRandomToken(){
  if(window.crypto&&typeof window.crypto.randomUUID==='function')return window.crypto.randomUUID();
  if(window.crypto&&typeof window.crypto.getRandomValues==='function'){
    var arr=new Uint32Array(4);
    window.crypto.getRandomValues(arr);
    return Array.from(arr).map(function(v){return v.toString(16).padStart(8,'0');}).join('');
  }
  return Date.now()+'_'+Math.random().toString(36).slice(2,12);
}

function _activitySafeISODate(dateStr){
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? dateStr
    : Utils.localISODate();
}

function showMoreActivityEntries(){
  activityVisibleCount+=ACTIVITY_INITIAL_EVENTS;
  renderActivity();
}

function renderActivity(){
  if(!isAdmin)return;
  var summaryEl=document.getElementById('activitySummary');
  var timelineEl=document.getElementById('activityTimeline');
  var usersEl=document.getElementById('activityUsers');
  var listEl=document.getElementById('activityList');
  if(!summaryEl||!timelineEl||!usersEl||!listEl)return;

  var entries=ActivityCore.prepareEntries(activity);

  if(!entries.length){
    summaryEl.innerHTML='<div class="empty-state">Aucune activité enregistrée pour le moment.</div>';
    timelineEl.innerHTML='';
    usersEl.innerHTML='';
    listEl.innerHTML='';
    return;
  }

  var stats=ActivityCore.summarize(entries);

  summaryEl.innerHTML=
    '<div class="activity-summary-grid">'+
      '<div class="activity-card"><div class="activity-num">'+stats.total+'</div><div class="activity-lbl">Connexions totales</div></div>'+
      '<div class="activity-card"><div class="activity-num">'+stats.visitors+'</div><div class="activity-lbl">Visiteurs</div></div>'+
      '<div class="activity-card"><div class="activity-num">'+stats.suspicious+'</div><div class="activity-lbl">Alertes suspectes</div></div>'+
      '<div class="activity-card"><div class="activity-num">'+stats.uniqueUsers+'</div><div class="activity-lbl">Utilisateurs uniques</div></div>'+
    '</div>';

  var series=ActivityCore.lastDaysSeries(entries,7,Utils.localISODate);
  var maxCount=series.reduce(function(m,it){return Math.max(m,it.count);},0);
  var bars=series.map(function(it){
    var iso=_activitySafeISODate(it.date);
    var d=new Date(iso+'T00:00:00Z');
    if(!Number.isFinite(d.getTime()))d=new Date();
    var short=d.toLocaleDateString('fr-FR',{weekday:'short'}).replace('.','');
    var height=maxCount>0?Math.max(8,Math.round((it.count/maxCount)*56)):8;
    return '<div class="activity-bar-item">'+
      '<div class="activity-bar-track"><div class="activity-bar-fill" style="height:'+height+'px"></div></div>'+
      '<div class="activity-bar-count">'+it.count+'</div>'+
      '<div class="activity-bar-date">'+escHtml(short)+'</div>'+
    '</div>';
  }).join('');
  timelineEl.innerHTML=
    '<div class="activity-panel">'+
      '<div class="activity-panel-title">Connexions des 7 derniers jours</div>'+
      '<div class="activity-bars">'+bars+'</div>'+
    '</div>';

  var topUsers=ActivityCore.topUsers(entries,30);
  usersEl.innerHTML=
    '<div class="activity-panel">'+
      '<div class="activity-panel-title">Noms d’utilisateurs</div>'+
      '<div class="activity-user-list">'+
        topUsers.map(function(u){
          return '<span class="activity-user-chip">'+escHtml(u.name)+' · '+u.count+'</span>';
        }).join('')+
      '</div>'+
    '</div>';

  var recentLimit=activityVisibleCount;
  var recentEntries=entries.slice(0,recentLimit);
  var remaining=entries.length-recentEntries.length;
  listEl.innerHTML=
    '<div class="activity-panel">'+
      '<div class="activity-panel-title">Dernières connexions</div>'+
      '<div class="activity-event-list">'+
        recentEntries.map(function(e){
          return '<div class="activity-event">'+
            '<div class="activity-event-top"><b>'+escHtml(e.name)+'</b><span>'+escHtml(ActivityCore.typeLabel(e.type))+'</span></div>'+
            '<div class="activity-event-meta">'+formatTime(e.ts)+'</div>'+
          '</div>';
        }).join('')+
        (remaining>0
          ?'<div class="load-more-wrap"><button class="btn btn-o" data-action="showMoreActivityEntries">Afficher davantage ('+remaining+')</button></div>'
          :'')+
      '</div>'+
    '</div>';
}

function initActivity(){
  if(!isAdmin)return;
  if(_unsubActivity){_unsubActivity();_unsubActivity=null;}
  if(!Db.ready())return;
  _unsubActivity=Db.on('activity',
    function(snap){
      activity=snap.val()||{};
      renderActivity();
    },
    function(err){
      console.error('[activity] listen failed',err);
      showToast('Impossible de charger l’activité.','error');
    }
  );
}

function trackActivityEvent(type,payload){
  if(!Db.ready())return;
  var cleanType=ActivityCore.normalizeType(type);
  if(cleanType==='other')return;
  // Carnet archivé : plus de suivi des connexions visiteurs (écriture refusée).
  if(cleanType!=='admin_login'&&visitorWritesDisabled())return;
  payload=payload&&typeof payload==='object'?payload:{};
  var fallback=cleanType==='admin_login'?'Admin':'Visiteur';
  var name=ActivityCore.safeString(payload.name,60,fallback);
  if(!name)return;
  var id='a_'+_activityRandomToken();
  var eventData={
    type:cleanType,
    name:name,
    ts:Date.now()
  };
  Db.set('activity/'+id,eventData).catch(function(err){
    console.error('[activity/track]',err);
  });
}
