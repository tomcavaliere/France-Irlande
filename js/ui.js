// ui.js
// UI utilities: toast notifications, confirm dialog, lightbox,
// modal, sync dot/popover, tab switching.
//
// Also hosts the event-delegation layer : a single set of document-level
// listeners dispatches click / change / input events to functions declared
// via `data-action="fnName"` (with optional `data-event="change|input"`,
// `data-arg`, `data-arg2`, `data-stop`). Only functions listed in
// ACTION_NAMES are invocable — this is a whitelist, any other name logs a
// warning and is ignored (defence in depth against XSS pivots).
//
// Overlays use `data-close-on-self="fnName"` : the close action fires only
// when the overlay backdrop itself is the click target (not a descendant).

var ACTIONS={
  toggleSyncPopover:function(){toggleSyncPopover();},
  toggleAdmin:function(){toggleAdmin();},
  openProfileModal:function(){openProfileModal();},
  closeProfileModal:function(){closeProfileModal();},
  closePwModal:function(){closePwModal();},
  logoutAdmin:function(){logoutAdmin();},
  refreshProfileQuota:function(){refreshProfileQuota();},
  exportJournal:function(a){exportJournal(a);},
  updateVisitorPassword:function(){updateVisitorPassword();},
  confirmAccept:function(){confirmAccept();},
  confirmCancel:function(){confirmCancel();},
  checkPw:function(){checkPw();},
  toggleCampings:function(){toggleCampings();},
  toggleCampspace:function(){toggleCampspace();},
  toggleWater:function(){toggleWater();},
  onCampRangeChange:function(a,b,el,e){onCampRangeChange(a,b,el,e);},
  updatePosition:function(){updatePosition();},
  addExpense:function(){addExpense();},
  addTrainingEntry:function(){addTrainingEntry();},
  addHealthEntry:function(){addHealthEntry();},
  switchTab:function(a){switchTab(a);},
  closeLightbox:function(){closeLightbox();},
  closeModal:function(){closeModal();},
  publishDay:function(a){publishDay(a);},
  deleteJournalEntry:function(a){deleteJournalEntry(a);},
  onJournalInput:function(a,b,el,e){onJournalInput(a,b,el,e);},
  addBravo:function(a){addBravo(a);},
  deleteExpense:function(a){deleteExpense(a);},
  postComment:function(a){postComment(a);},
  deleteComment:function(a,b){deleteComment(a,b);},
  openLightbox:function(a,b){openLightbox(a,b);},
  deletePhoto:function(a,b){deletePhoto(a,b);},
  uploadPhoto:function(a){uploadPhoto(a);},
  uploadVideo:function(a){uploadVideo(a);},
  deleteVideo:function(a,b){deleteVideo(a,b);},
  deleteStage:function(a){deleteStage(a);},
  openJournalEntry:function(a){openJournalEntry(a);},
  cancelAllUploads:function(){cancelAllUploads();},
  uploadGPX:function(a){uploadGPX(a);},
  deleteGPX:function(a){deleteGPX(a);},
  checkVisitorPw:function(){checkVisitorPw();},
  showVisitorGate:function(){showVisitorGate();},
  closeVisitorGate:function(){closeVisitorGate();}
};

function invokeAction(name, args){
  var fn=ACTIONS[name];
  if(typeof fn!=='function'){
    console.warn('[ui] unknown action',name);
    return;
  }
  return fn.apply(null,args||[]);
}

function _delegateEvent(e){
  if(e.type==='click'){
    var ov=e.target.closest('[data-close-on-self]');
    if(ov&&e.target===ov){
      invokeAction(ov.dataset.closeOnSelf,[]);
      return;
    }
  }
  var el=e.target.closest('[data-action]');
  if(!el)return;
  var wanted=el.dataset.event||'click';
  if(wanted!==e.type)return;
  if(el.dataset.stop)e.stopPropagation();
  invokeAction(el.dataset.action,[el.dataset.arg,el.dataset.arg2,el,e]);
}

function initEventDelegation(){
  ['click','change','input'].forEach(function(ev){
    document.addEventListener(ev,_delegateEvent);
  });
}

function activeTab(){
  var p=document.querySelector('.page.active');
  return p?p.id.replace('page-',''):'';
}

function switchTab(t){
  if((t==='training'||t==='health')&&!isAdmin){
    showToast('Accès admin requis.','warn');
    t='map';
  }
  document.querySelectorAll('.tab').forEach(function(e){e.classList.toggle('active',e.dataset.page===t);});
  document.querySelectorAll('.page').forEach(function(e){e.classList.toggle('active',e.id==='page-'+t);});
  if(t==='journal'||t==='stages')openCarnetTab();
  if(t==='map'&&map)setTimeout(function(){map.invalidateSize();},100);
  if(t==='journal'&&journalDirty){renderJournal();journalDirty=false;}
  if(t==='depenses')renderExpenses();
  if(t==='training')renderTraining();
  if(t==='health')renderHealth();
  if(t==='stages')fetchWeather();
}

// ==== CONFIRM DIALOG ====
// Modal de confirmation custom (évite confirm() natif qui bloque l'UI iOS).
// Usage : confirmDialog({title, message, okLabel?}).then(ok => { if(ok) ... }).
function confirmDialog(opts){
  opts=opts||{};
  document.getElementById('confirmTitle').textContent=opts.title||'Confirmer';
  document.getElementById('confirmMsg').textContent=opts.message||'Action irréversible.';
  document.getElementById('confirmOk').textContent=opts.okLabel||'Supprimer';
  document.getElementById('confirmModal').classList.add('vis');
  return new Promise(function(resolve){_confirmResolve=resolve;});
}
function confirmAccept(){
  document.getElementById('confirmModal').classList.remove('vis');
  if(_confirmResolve){var r=_confirmResolve;_confirmResolve=null;r(true);}
}
function confirmCancel(){
  document.getElementById('confirmModal').classList.remove('vis');
  if(_confirmResolve){var r=_confirmResolve;_confirmResolve=null;r(false);}
}

// ==== MODAL ====
function closeModal(){document.getElementById('stageModal').classList.remove('vis');}

// ==== LIGHTBOX ====
function openLightbox(id,i){
  var isVideo=id&&id.charAt(0)==='v';
  var lb=document.getElementById('lightbox');
  var img=document.getElementById('lightboxImg');
  var vid=document.getElementById('lightboxVideo');
  var src;
  if(isVideo){
    src=(videos[i]&&videos[i][id])||'';
    vid.src=src;
    img.style.display='none';
    vid.style.display='block';
  }else{
    src=(photos[i]&&photos[i][id])||id;
    img.src=src;
    img.style.display='';
    vid.style.display='none';
    if(vid){vid.pause();vid.src='';}
  }
  lb.classList.add('vis');
}
function closeLightbox(){
  var vid=document.getElementById('lightboxVideo');
  if(vid){vid.pause();vid.src='';}
  document.getElementById('lightbox').classList.remove('vis');
}

// ==== SYNC DOT ====
function setSyncDot(mode){
  // mode: 'online' | 'offline' | 'syncing' | 'queued'
  var dot=document.getElementById('syncDot');
  if(!dot)return;
  dot.style.display='inline-block';
  dot.classList.toggle('offline', mode==='offline');
  dot.classList.toggle('syncing', mode==='syncing');
  dot.classList.toggle('queued', mode==='queued');
  var banner=document.getElementById('offlineBanner');
  if(banner)banner.hidden=(mode!=='offline');
}

// Affiche une notification temporaire non-bloquante.
// type : 'info' (défaut) | 'warn' | 'error' | 'success'
// durationMs : durée d'affichage en ms (défaut 4000).
function showToast(msg, type, durationMs){
  var container=document.getElementById('toastContainer');
  if(!container)return;
  var el=document.createElement('div');
  el.className='toast'+(type&&type!=='info'?' '+type:'');
  el.textContent=msg;
  container.appendChild(el);
  // Forcer un reflow avant d'ajouter .vis pour déclencher la transition CSS
  el.getBoundingClientRect();
  el.classList.add('vis');
  var dur=(durationMs!==null&&durationMs!==undefined)?durationMs:4000;
  setTimeout(function(){
    el.classList.remove('vis');
    setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},300);
  },dur);
}

function _queueSummary(){
  if(!offlineQueue.length) return null;
  var counts={};
  offlineQueue.forEach(function(item){
    var t=item.type||'élément';
    counts[t]=(counts[t]||0)+1;
  });
  var lines=Object.keys(counts).map(function(t){return counts[t]+' '+t+(counts[t]>1?'s':'');});
  return {total:offlineQueue.length, lines:lines};
}

function toggleSyncPopover(){
  var pop=document.getElementById('syncPopover');
  if(!pop)return;
  if(pop.classList.contains('visible')){pop.classList.remove('visible');return;}
  var summary=_queueSummary();
  if(!isOnline){
    pop.innerHTML='<strong>🔴 Hors-ligne</strong> Les modifications seront synchronisées au retour du réseau.';
  } else if(summary){
    pop.innerHTML='<strong>🟡 '+summary.total+' élément'+(summary.total>1?'s':'')+' en attente</strong>'+summary.lines.join('<br>');
  } else {
    pop.innerHTML='<strong>🟢 Synchronisé</strong>Toutes les données sont à jour.';
  }
  pop.classList.add('visible');
  setTimeout(function(){pop.classList.remove('visible');},4000);
}
document.addEventListener('click',function(e){
  if(e.target.closest('#syncDot'))return;
  var pop=document.getElementById('syncPopover');
  if(pop)pop.classList.remove('visible');
});
