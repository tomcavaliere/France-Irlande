// admin.js
// Admin authentication, inactivity timeout, profile modal,
// RTDB quota management, journal export.

function refreshQuotaState(callback){
  if(!window._fbDb||!window._fbGet){if(callback)callback();return;}
  window._fbGet(window._fbRef(window._fbDb,'photos'))
    .then(function(snap){
      var photosTree=snap.exists()?snap.val():{};
      var r=Utils.computeQuotaBytes(photosTree);
      var lvl=Utils.quotaLevel(r.bytes);
      _quotaState={count:r.count,bytes:r.bytes,level:lvl};
      if(callback)callback();
    })
    .catch(function(err){
      console.error('[quota] refresh failed',err);
      if(callback)callback();
    });
}

function setAdminUI(on){
  document.getElementById('adminBtn').classList.toggle('on',on);
  document.getElementById('adminBtn').textContent=on?'🔓 Admin':'🔒 Admin';
  var tabDep=document.getElementById('tabDepenses');
  if(tabDep)tabDep.classList.toggle('vis',on);
  var tabStages=document.getElementById('tabStages');
  if(tabStages)tabStages.classList.toggle('vis',on);
  var tabInfo=document.getElementById('tabInfo');
  if(tabInfo)tabInfo.classList.toggle('vis',on);
  var tabTraining=document.getElementById('tabTraining');
  if(tabTraining)tabTraining.classList.toggle('vis',on);
  var tabHealth=document.getElementById('tabHealth');
  if(tabHealth)tabHealth.classList.toggle('vis',on);
  var adminBar=document.getElementById('mapAdminBar');
  if(adminBar)adminBar.classList.toggle('hidden',!on);
  var posBar=document.getElementById('posAdminBar');
  if(posBar)posBar.classList.toggle('vis',on);
  if(on){
    refreshQuotaState(function(){
      if(_quotaState.level==='block'){
        showToast('🚨 Quota RTDB critique (≥ 90%) ! Upload de photos bloqué. Supprime des photos.','error',8000);
      } else if(_quotaState.level==='high'){
        showToast('🔴 Quota RTDB élevé (≥ 85%). Pense à supprimer d\'anciennes photos.','warn',6000);
      } else if(_quotaState.level==='warn'){
        showToast('🟡 Quota RTDB à '+Utils.formatBytes(_quotaState.bytes)+' (≥ 70% utilisé).','warn',5000);
      }
    });
  }
  if(!on){
    if(campingsVisible)toggleCampings();
    if(campspaceVisible)toggleCampspace();
    if(waterVisible)toggleWater();
    if(activeTab()==='depenses'||activeTab()==='stages'||activeTab()==='info'||activeTab()==='training'||activeTab()==='health')switchTab('map');
  }
}
function exportJournal(fmt){
  try{
    var stamp=new Date().toISOString().slice(0,10);
    var blob,filename;
    if(fmt==='json'){
      var payload={exportedAt:new Date().toISOString(),stages:stages,journals:journals,comments:comments,expenses:expenses};
      blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
      filename='carnet-eurovelo1-'+stamp+'.json';
    }else{
      var dates=Object.keys(stages).sort();
      var lines=['# Carnet de voyage — EuroVelo 1','','_Exporté le '+stamp+'_',''];
      dates.forEach(function(d){
        lines.push('## '+d);
        var dd=stages[d];
        if(dd){
          var meta=[];
          if(dd.kmDay!==null&&dd.kmDay!==undefined)meta.push(dd.kmDay+' km');
          if(dd.kmTotal!==null&&dd.kmTotal!==undefined)meta.push('total '+dd.kmTotal+' km');
          if(dd.elevGain!==null&&dd.elevGain!==undefined&&Number(dd.elevGain)>0)meta.push('D+ '+Math.round(Number(dd.elevGain))+' m');
          if(meta.length)lines.push('_'+meta.join(' · ')+'_');
        }
        if(journals[d])lines.push('',journals[d]);
        lines.push('');
      });
      blob=new Blob([lines.join('\n')],{type:'text/markdown'});
      filename='carnet-eurovelo1-'+stamp+'.md';
    }
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');a.href=url;a.download=filename;a.click();
    URL.revokeObjectURL(url);
  }catch(err){console.error('[export]',err);}
}
function logoutAdmin(){
  clearTimeout(inactivityTimer);
  clearTimeout(inactivityWarnTimer);
  closeAdminDropdown();
  flushJournals();
  saveExpensesCache();
  if(_unsubExpenses){_unsubExpenses();_unsubExpenses=null;}
  if(_unsubTraining){_unsubTraining();_unsubTraining=null;}
  if(_unsubHealth){_unsubHealth();_unsubHealth=null;}
  expenses={};
  training={};
  health={};
  if(window._fbAuth)window._fbSignOut(window._fbAuth);
}
function resetInactivity(){
  _lastActivity=Date.now();
  if(!isAdmin)return;
  clearTimeout(inactivityTimer);
  clearTimeout(inactivityWarnTimer);
  inactivityTimer=setTimeout(logoutAdmin,INACTIVITY_MS);
  if(INACTIVITY_MS>INACTIVITY_WARN_BEFORE_MS){
    inactivityWarnTimer=setTimeout(function(){
      if(isAdmin)showToast('⚠️ Session admin : déconnexion automatique dans '+Math.round(INACTIVITY_WARN_BEFORE_MS/1000)+' secondes. Effectuez une action pour rester connecté.','warn',INACTIVITY_WARN_BEFORE_MS);
    }, INACTIVITY_MS-INACTIVITY_WARN_BEFORE_MS);
  }
}
function toggleAdmin(){
  if(isAdmin){
    var dd=document.getElementById('adminDropdown');
    if(dd.classList.contains('vis')){dd.classList.remove('vis');return;}
    dd.classList.add('vis');
    setTimeout(function(){
      document.addEventListener('click',closeAdminDropdown,{capture:true});
    },0);
    return;
  }
  document.getElementById('pwEmail').value='';
  document.getElementById('pwInput').value='';
  document.getElementById('pwErr').classList.remove('vis');
  document.getElementById('pwModal').classList.add('vis');
  setTimeout(function(){document.getElementById('pwEmail').focus();},100);
}
function closeAdminDropdown(e){
  if(e&&document.getElementById('adminDropdown').contains(e.target))return;
  document.removeEventListener('click',closeAdminDropdown,{capture:true});
  var dd=document.getElementById('adminDropdown');
  if(dd)dd.classList.remove('vis');
}

function openProfileModal(){
  closeAdminDropdown();
  var u=window._fbAuth&&window._fbAuth.currentUser;
  document.getElementById('profileEmail').textContent=u?u.email:'—';
  document.getElementById('profileStatStages').textContent=Object.keys(stages).length;
  var published=Object.values(stages).filter(function(d){return d.published===true;}).length;
  document.getElementById('profileStatJournal').textContent=published;
  document.getElementById('profileStatComments').textContent='…';
  if(window._fbDb&&window._fbGet){
    window._fbGet(window._fbRef(window._fbDb,'comments'))
      .then(function(snap){
        var count=0;
        if(snap.exists()){
          var commentsData=snap.val();
          Object.values(commentsData).forEach(function(dateComments){
            if(dateComments)count+=Object.keys(dateComments).length;
          });
        }
        document.getElementById('profileStatComments').textContent=count;
      })
      .catch(function(err){console.error('[profile] comments count failed',err);});
  }
  refreshProfileQuota();
  var authErrEl=document.getElementById('profileVisitorPwErr');
  if(authErrEl)authErrEl.classList.remove('vis');
  var authPw=document.getElementById('profileVisitorPwNew');
  var authPw2=document.getElementById('profileVisitorPwConfirm');
  if(authPw)authPw.value='';
  if(authPw2)authPw2.value='';
  _sessionCountdown=setInterval(function(){
    var el=document.getElementById('profileSession');
    if(!el){clearInterval(_sessionCountdown);return;}
    var elapsed=Date.now()-(_lastActivity||Date.now());
    var remaining=Math.max(0,INACTIVITY_MS-elapsed);
    var m=Math.floor(remaining/60000);
    var s=Math.floor((remaining%60000)/1000);
    el.textContent=m+':'+(s<10?'0':'')+s;
  },1000);
  document.getElementById('profileModal').classList.add('vis');
}

function closeProfileModal(){
  document.getElementById('profileModal').classList.remove('vis');
  clearInterval(_sessionCountdown);
  _sessionCountdown=null;
}

function closePwModal(){
  document.getElementById('pwModal').classList.remove('vis');
}

function refreshProfileQuota(){
  document.getElementById('profileQuotaText').innerHTML='<span>Chargement…</span>';
  refreshQuotaState(function(){
    var r=_quotaState;
    var pct=(r.bytes/Utils.RTDB_QUOTA_BYTES*100);
    var pctStr=pct.toFixed(1);
    var fill=document.getElementById('profileQuotaFill');
    fill.style.width=Math.min(pct,100)+'%';
    fill.className='quota-progress-fill'+(r.level!=='ok'?' '+r.level:'');
    document.getElementById('profileQuotaText').innerHTML=
      '<span>'+r.count+' photos · '+Utils.formatBytes(r.bytes)+'</span>'+
      '<span>'+pctStr+'% / 1 Go</span>';
  });
}
function checkPw(){
  var email=document.getElementById('pwEmail').value.trim();
  var password=document.getElementById('pwInput').value;
  var errEl=document.getElementById('pwErr');
  errEl.classList.remove('vis');
  if(!email||!password)return;
  if(!window._fbAuth){errEl.textContent='Firebase non disponible';errEl.classList.add('vis');return;}
  window._fbSignIn(window._fbAuth,email,password)
    .then(function(){
      document.getElementById('pwModal').classList.remove('vis');
      document.getElementById('pwInput').value='';
    })
    .catch(function(){
      errEl.textContent='Email ou mot de passe incorrect';
      errEl.classList.add('vis');
      document.getElementById('pwInput').value='';
    });
}
// Réinitialise le timer sur toute interaction
['touchstart','mousedown','keydown'].forEach(function(ev){
  document.addEventListener(ev,resetInactivity,{passive:true});
});

// Raccourcis clavier du modal de login admin (Enter pour valider / naviguer)
function _initPwModalKeys(){
  var emailEl=document.getElementById('pwEmail');
  var pwEl=document.getElementById('pwInput');
  if(emailEl)emailEl.addEventListener('keydown',function(e){
    if(e.key==='Enter'&&pwEl)pwEl.focus();
  });
  if(pwEl)pwEl.addEventListener('keydown',function(e){
    if(e.key==='Enter')checkPw();
  });
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',_initPwModalKeys);
}else{
  _initPwModalKeys();
}
// Observer l'état d'authentification Firebase
function initAuth(){
  if(!window._fbOnAuth||!window._fbAuth)return;
  window._fbOnAuth(window._fbAuth,function(user){
    isAdmin=!!user;
    setAdminUI(isAdmin);
    if(isAdmin){resetInactivity();initExpenses();initTraining();initHealth();}
    else{clearTimeout(inactivityTimer);}
    Events.emit('admin:toggled');
  });
}

// ==== POSITION GPS ====
function updatePosition(){
  if(!isAdmin)return;
  var statusEl=document.getElementById('posGpsStatus');
  if(statusEl)statusEl.textContent='Localisation...';
  if(!navigator.geolocation){
    if(statusEl)statusEl.textContent='GPS non disponible';
    return;
  }
  navigator.geolocation.getCurrentPosition(function(pos){
    var lat=pos.coords.latitude,lon=pos.coords.longitude;
    var accuracy=Math.round(pos.coords.accuracy);
    var todayISO=new Date().toISOString().slice(0,10);
    var snapped=snapToRoute(lat,lon);
    var kmTotal=Math.round(snapped.kmTotal);
    var kmDay=computeKmDay(kmTotal,stages,todayISO);
    var nowTs=Date.now();

    // Écriture 1 : /current (pointeur live)
    var currentData={lat:lat,lon:lon,kmTotal:kmTotal,kmDay:kmDay,date:todayISO,ts:nowTs};

    // Écriture 2 : /stages/{today} — préserve les champs existants
    // et recrée l'entrée du jour si elle n'existe plus (ex: suppression admin).
    var existingStage=stages[todayISO]||{};
    var stageData=Object.assign({},existingStage,{
      lat:lat,lon:lon,kmTotal:kmTotal,kmDay:kmDay,
      note:typeof existingStage.note==='string'?existingStage.note:'',
      published:existingStage.published===true,
      ts:nowTs
    });
    if(stageData.journalDeleted===true)delete stageData.journalDeleted;

    // Optimistic local state to keep the GPS button flow responsive,
    // even if /stages is lazy-loaded or has just been deleted/recreated.
    current=currentData;
    stages=Object.assign({},stages);
    stages[todayISO]=Object.assign({},stageData);

    window._fbSet(window._fbRef(window._fbDb,'current'),currentData)
      .catch(function(err){ console.error('[updatePosition/current]',err); });

    window._fbSet(window._fbRef(window._fbDb,'stages/'+todayISO),stageData)
      .catch(function(err){ console.error('[updatePosition/stage]',err); });

    Events.emit('state:current-changed');
    Events.emit('state:stages-changed');
    fetchWeather();
    if(campingsVisible)loadCampings();
    if(campspaceVisible)loadCampspace();
    if(waterVisible)loadWater();
    if(statusEl)statusEl.textContent='±'+accuracy+'m · '+Math.round(GPSCore.sumTrackKm(getEffectiveTracks()))+' km GPX';
    if(map)map.setView([lat,lon],12);
  },function(err){
    var msg=err.code===1?'Permission refusée':err.code===2?'Position indisponible':'Timeout';
    var statusEl=document.getElementById('posGpsStatus');
    if(statusEl)statusEl.textContent=msg;
  },{enableHighAccuracy:true,timeout:15000});
}
