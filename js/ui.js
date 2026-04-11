// ui.js
// UI utilities: toast notifications, confirm dialog, lightbox,
// modal, sync dot/popover, tab switching.

function activeTab(){
  var p=document.querySelector('.page.active');
  return p?p.id.replace('page-',''):'';
}

function switchTab(t){
  document.querySelectorAll('.tab').forEach(function(e){e.classList.toggle('active',e.dataset.page===t)});
  document.querySelectorAll('.page').forEach(function(e){e.classList.toggle('active',e.id==='page-'+t)});
  if(t==='journal'||t==='stages')openCarnetTab();
  if(t==='map'&&map)setTimeout(function(){map.invalidateSize()},100);
  if(t==='journal'&&journalDirty){renderJournal();journalDirty=false;}
  if(t==='depenses')renderExpenses();
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
  var src=(photos[i]&&photos[i][id])||id;
  document.getElementById('lightboxImg').src=src;
  document.getElementById('lightbox').classList.add('vis');
}
function closeLightbox(){document.getElementById('lightbox').classList.remove('vis');}

// ==== SYNC DOT ====
function setSyncDot(mode){
  // mode: 'online' | 'offline' | 'syncing' | 'queued'
  var dot=document.getElementById('syncDot');
  if(!dot)return;
  dot.style.display='inline-block';
  dot.classList.toggle('offline', mode==='offline');
  dot.classList.toggle('syncing', mode==='syncing');
  dot.classList.toggle('queued', mode==='queued');
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
  var dur=(durationMs!=null)?durationMs:4000;
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

function toggleSyncPopover(e){
  e.stopPropagation();
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
document.addEventListener('click',function(){
  var pop=document.getElementById('syncPopover');
  if(pop)pop.classList.remove('visible');
});
