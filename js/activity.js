// activity.js
// Admin-only activity dashboard + connection event tracking.

var _activityIdCounter = 0;

function _activitySafeString(v,maxLen,fallback){
  var s=typeof v==='string'?v.trim():'';
  if(!s)s=fallback||'';
  if(maxLen&&s.length>maxLen)s=s.slice(0,maxLen);
  return s;
}

function _activityNormalizeType(type){
  return type==='admin_login'||type==='visitor_login'?type:'other';
}

function _activityNormalizeEntry(raw){
  raw=raw&&typeof raw==='object'?raw:{};
  var tsNum=Number(raw.ts);
  return {
    type:_activityNormalizeType(raw.type),
    name:_activitySafeString(raw.name,60,'Inconnu'),
    ts:Number.isFinite(tsNum)&&tsNum>0?tsNum:0
  };
}

function _activityTypeLabel(type){
  if(type==='admin_login')return 'Connexion admin';
  if(type==='visitor_login')return 'Connexion visiteur';
  return 'Événement';
}

function _activityDayISO(ts){
  if(!Number.isFinite(ts)||ts<=0)return '';
  return new Date(ts).toISOString().slice(0,10);
}

function _activityLastDaysSeries(entries,nbDays){
  var days=Math.max(1,Math.round(nbDays||7));
  var base=new Date();
  base.setHours(12,0,0,0);
  var counts={};
  entries.forEach(function(e){
    var day=_activityDayISO(e.ts);
    if(day)counts[day]=(counts[day]||0)+1;
  });
  var out=[];
  for(var i=days-1;i>=0;i--){
    var d=new Date(base);
    d.setDate(base.getDate()-i);
    var iso=d.toISOString().slice(0,10);
    out.push({date:iso,count:counts[iso]||0});
  }
  return out;
}

function _activityTopUsers(entries,maxUsers){
  var counts={};
  entries.forEach(function(e){
    var key=_activitySafeString(e.name,60,'Inconnu');
    counts[key]=(counts[key]||0)+1;
  });
  return Object.keys(counts)
    .map(function(name){return {name:name,count:counts[name]};})
    .sort(function(a,b){
      if(b.count!==a.count)return b.count-a.count;
      return a.name.localeCompare(b.name);
    })
    .slice(0,Math.max(1,Math.round(maxUsers||20)));
}

function renderActivity(){
  if(!isAdmin)return;
  var summaryEl=document.getElementById('activitySummary');
  var timelineEl=document.getElementById('activityTimeline');
  var usersEl=document.getElementById('activityUsers');
  var listEl=document.getElementById('activityList');
  if(!summaryEl||!timelineEl||!usersEl||!listEl)return;

  var entries=Object.keys(activity||{})
    .map(function(id){return _activityNormalizeEntry(activity[id]);})
    .filter(function(e){return e.ts>0;})
    .sort(function(a,b){return b.ts-a.ts;});

  if(!entries.length){
    summaryEl.innerHTML='<div class="empty-state">Aucune activité enregistrée pour le moment.</div>';
    timelineEl.innerHTML='';
    usersEl.innerHTML='';
    listEl.innerHTML='';
    return;
  }

  var total=entries.length;
  var admins=entries.filter(function(e){return e.type==='admin_login';}).length;
  var visitors=entries.filter(function(e){return e.type==='visitor_login';}).length;
  var uniqueUsers={};
  entries.forEach(function(e){uniqueUsers[e.name]=true;});
  var uniqueCount=Object.keys(uniqueUsers).length;

  summaryEl.innerHTML=
    '<div class="activity-summary-grid">'+
      '<div class="activity-card"><div class="activity-num">'+total+'</div><div class="activity-lbl">Connexions totales</div></div>'+
      '<div class="activity-card"><div class="activity-num">'+visitors+'</div><div class="activity-lbl">Visiteurs</div></div>'+
      '<div class="activity-card"><div class="activity-num">'+admins+'</div><div class="activity-lbl">Admins</div></div>'+
      '<div class="activity-card"><div class="activity-num">'+uniqueCount+'</div><div class="activity-lbl">Utilisateurs uniques</div></div>'+
    '</div>';

  var series=_activityLastDaysSeries(entries,7);
  var maxCount=series.reduce(function(m,it){return Math.max(m,it.count);},0);
  var bars=series.map(function(it){
    var iso=/^\d{4}-\d{2}-\d{2}$/.test(it.date)?it.date:new Date().toISOString().slice(0,10);
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

  var topUsers=_activityTopUsers(entries,30);
  usersEl.innerHTML=
    '<div class="activity-panel">'+
      '<div class="activity-panel-title">Noms d\'utilisateurs</div>'+
      '<div class="activity-user-list">'+
        topUsers.map(function(u){
          return '<span class="activity-user-chip">'+escHtml(u.name)+' · '+u.count+'</span>';
        }).join('')+
      '</div>'+
    '</div>';

  listEl.innerHTML=
    '<div class="activity-panel">'+
      '<div class="activity-panel-title">Dernières connexions</div>'+
      '<div class="activity-event-list">'+
        entries.slice(0,80).map(function(e){
          return '<div class="activity-event">'+
            '<div class="activity-event-top"><b>'+escHtml(e.name)+'</b><span>'+escHtml(_activityTypeLabel(e.type))+'</span></div>'+
            '<div class="activity-event-meta">'+formatTime(e.ts)+'</div>'+
          '</div>';
        }).join('')+
      '</div>'+
    '</div>';
}

function initActivity(){
  if(!isAdmin)return;
  if(_unsubActivity){_unsubActivity();_unsubActivity=null;}
  if(!window._fbDb||!window._fbOnValue||!window._fbRef)return;
  _unsubActivity=window._fbOnValue(
    window._fbRef(window._fbDb,'activity'),
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
  if(!window._fbDb||!window._fbSet||!window._fbRef)return;
  var cleanType=_activityNormalizeType(type);
  if(cleanType==='other')return;
  payload=payload&&typeof payload==='object'?payload:{};
  var fallback=cleanType==='admin_login'?'Admin':'Visiteur';
  var name=_activitySafeString(payload.name,60,fallback);
  if(!name)return;
  _activityIdCounter=(_activityIdCounter+1)%1000000;
  var id='a_'+(crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now()+'_'+_activityIdCounter+'_'+Math.random().toString(36).slice(2,12));
  var eventData={
    type:cleanType,
    name:name,
    ts:Date.now()
  };
  window._fbSet(window._fbRef(window._fbDb,'activity/'+id),eventData).catch(function(err){
    console.error('[activity/track]',err);
  });
}
