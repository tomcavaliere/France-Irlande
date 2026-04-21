// stages.js
// Stage cards rendering, recap summary, stage CRUD operations.

function renderStages(){
  var c=document.getElementById('stagesList');
  if(!c)return;
  c.innerHTML='';
  var dates=Object.keys(stages).sort();
  if(!dates.length){
    c.innerHTML='<div class="empty-state">'+
      'Les étapes apparaîtront ici après la mise à jour de position chaque soir.</div>';
    updateRecap();return;
  }
  dates.forEach(function(date,idx){
    var d=stages[date];
    var card=document.createElement('div');
    card.className='stage-card';
    var kmDay=d.kmDay||0;
    var kmTotal=d.kmTotal||0;
    var elevGain=Math.max(0,Math.round(Number(d.elevGain)||0));
    var seg=d.lat&&d.lon?StagesCore.countryFlag(snapToRoute(d.lat,d.lon).idx,FRANCE_END_IDX):'';
    var dateLabel=StagesCore.formatStageDateLabel(date);
    var edate=escAttr(date);
    var hasTrack=!!(tracks&&tracks[date]);
    var gpxHtml='';
    if(isAdmin){
      gpxHtml=hasTrack
        ?'<button class="s-gpx s-gpx-ok" data-action="uploadGPX" data-arg="'+edate+'" data-stop="1" title="Re-uploader le tracé GPX">&#x1f4ce; GPX &#x2713;</button>'+
          '<button class="s-gpx-del" data-action="deleteGPX" data-arg="'+edate+'" data-stop="1" title="Supprimer le tracé GPX">&#x1f5d1;&#xfe0f;</button>'
        :'<button class="s-gpx" data-action="uploadGPX" data-arg="'+edate+'" data-stop="1" title="Uploader le tracé GPX">&#x1f4ce; GPX</button>';
    }
    var adminStageHtml=isAdmin?
      '<button class="s-del" data-action="deleteStage" data-arg="'+edate+'" data-stop="1">&#x2715;</button>'+
      '<button class="s-write" data-action="openJournalEntry" data-arg="'+edate+'" data-stop="1">&#x1f4dd; Écrire</button>'+
      gpxHtml
      :'';
    card.innerHTML=
      '<div class="s-hdr"><div>'+
        '<div class="s-day">'+seg+' J'+(idx+1)+' — '+dateLabel+'</div>'+
        '<div class="s-title">'+escHtml(d.note||'Étape du jour')+'</div>'+
        adminStageHtml+
      '</div></div>'+
      '<div class="s-stats">'+
        '<span class="s-stat">&#x1f6b4; '+Math.round(kmDay)+' km/jour</span>'+
        '<span class="s-stat">&#x1f4cd; '+Math.round(kmTotal)+' km total</span>'+
        (elevGain?'<span class="s-stat">&#x26f0;&#xfe0f; D+ '+elevGain+' m</span>':'')+
      '</div>';
    if(!isAdmin)card.onclick=function(){switchTab('journal');};
    c.appendChild(card);
  });
  updateRecap();
}

// Ouvre le sélecteur de fichier GPX pour la date donnée.
function uploadGPX(date){
  if(!isAdmin)return;
  var input=document.createElement('input');
  input.type='file';
  input.accept='.gpx';
  input.addEventListener('change',function(){
    var file=input.files&&input.files[0];
    if(!file)return;
    _processGPXFile(date,file);
  });
  input.click();
}

// Lit, parse et enregistre un fichier GPX pour une étape.
function _processGPXFile(date,file){
  // Désactiver le bouton pendant l'upload
  var btn=document.querySelector('.s-gpx[data-arg="'+date+'"],.s-gpx-ok[data-arg="'+date+'"]');
  if(btn){btn.disabled=true;btn.textContent='Upload...';}

  var reader=new FileReader();
  reader.onload=function(e){
    var gpxData=GPSCore.parseGPX(e.target.result);
    if(!gpxData){
      showToast('Fichier GPX invalide','error');
      if(btn){btn.disabled=false;renderStages();}
      return;
    }
    // Écriture dans /tracks/{date}
    var trackData={coords:gpxData.coords,kmDay:gpxData.kmDay,elevGain:gpxData.elevGain,ts:Date.now()};
    window._fbSet(window._fbRef(window._fbDb,'tracks/'+date),trackData)
      .then(function(){
        return _applyKmRecompute();
      })
      .then(function(){
        showToast('Tracé GPX ajouté — '+gpxData.kmDay+' km · D+ '+gpxData.elevGain+' m','ok');
      })
      .catch(function(err){
        console.error('[uploadGPX]',err);
        showToast('Erreur lors de l\'upload GPX','error');
        if(btn){btn.disabled=false;renderStages();}
      });
  };
  reader.onerror=function(){
    showToast('Fichier GPX invalide','error');
    if(btn){btn.disabled=false;renderStages();}
  };
  reader.readAsText(file);
}

// Supprime le tracé GPX d'une étape et recalcule les km.
function deleteGPX(date){
  if(!isAdmin)return;
  window._fbRemove(window._fbRef(window._fbDb,'tracks/'+date))
    .then(function(){
      return _applyKmRecompute();
    })
    .then(function(){
      showToast('Tracé GPX supprimé','ok');
    })
    .catch(function(err){
      console.error('[deleteGPX]',err);
      showToast('Erreur lors de la suppression GPX','error');
    });
}

// Recalcule kmDay/kmTotal de toutes les étapes et écrit les mises à jour
// dans /stages/{date} et /current.
function _applyKmRecompute(){
  var result=GPSCore.recomputeAllKm(stages,tracks,ALL_ROUTE_PTS,CUM_KM);
  var writes=[];
  Object.keys(result.stageUpdates).forEach(function(d){
    var upd=result.stageUpdates[d];
      writes.push(
        window._fbSet(window._fbRef(window._fbDb,'stages/'+d+'/kmDay'),upd.kmDay),
        window._fbSet(window._fbRef(window._fbDb,'stages/'+d+'/kmTotal'),upd.kmTotal),
        window._fbSet(window._fbRef(window._fbDb,'stages/'+d+'/elevGain'),upd.elevGain)
      );
  });
  if(current){
    writes.push(
      window._fbSet(window._fbRef(window._fbDb,'current/kmTotal'),result.currentKmTotal)
    );
  }
  return Promise.all(writes);
}

function updateRecap(){
  var dates=Object.keys(stages).sort();
  var kmD=GPSCore.sumTrackKm(tracks);
  var kmL=current?GPSCore.haversineKm(current.lat,current.lon,GPSCore.SLIGO_COORDS.lat,GPSCore.SLIGO_COORDS.lon):TOTAL_KM;
  var nbDays=dates.length;
  var totals=StagesCore.computeRecapTotals(kmD,kmL,nbDays,TOTAL_KM);
  document.getElementById('rKmD').textContent=Math.round(kmD);
  document.getElementById('rKmL').textContent=Math.round(kmL);
  document.getElementById('rDays').textContent=nbDays;
  document.getElementById('rAvg').textContent=totals.avgKmPerDay||'—';
  document.getElementById('rBar').style.width=totals.pct+'%';
  document.getElementById('mapDays').textContent='J'+nbDays;
}

function deleteStage(date){
  if(!isAdmin)return;
  confirmDialog({
    title:'Supprimer l\'étape',
    message:'Cette étape et son entrée journal seront définitivement supprimées.',
    okLabel:'Supprimer'
  }).then(function(ok){
    if(!ok)return;
    Promise.all([
      window._fbRemove(window._fbRef(window._fbDb,'stages/'+date)),
      window._fbRemove(window._fbRef(window._fbDb,'journals/'+date)),
      window._fbRemove(window._fbRef(window._fbDb,'photos/'+date)),
      window._fbRemove(window._fbRef(window._fbDb,'comments/'+date)),
      window._fbRemove(window._fbRef(window._fbDb,'bravos/'+date))
    ])
      .then(function(){
        Events.emit('state:stages-changed');
        Events.emit('state:journal-changed');
        Events.emit('state:current-changed');
      })
      .catch(function(err){console.error('[deleteStage]',err);});
  });
}
function openJournalEntry(date){
  if(!isAdmin)return;
  if(stages[date]&&stages[date].journalDeleted){
    window._fbRemove(window._fbRef(window._fbDb,'stages/'+date+'/journalDeleted'))
      .catch(function(err){ console.error('[openJournalEntry]',err); });
  }
  switchTab('journal');
  Events.emit('state:journal-changed');
  setTimeout(function(){
    var entry=document.querySelector('#journalList .journal-entry[data-date="'+date+'"]');
    if(entry)entry.scrollIntoView({behavior:'smooth',block:'start'});
  },50);
}
function publishDay(date){
  if(!isAdmin)return;
  var pub=stages[date]&&stages[date].published;
  window._fbSet(window._fbRef(window._fbDb,'stages/'+date+'/published'),!pub)
    .catch(function(err){ console.error('[publishDay]',err); });
  // Optimistic UI
  if(stages[date])stages[date].published=!pub;
  var entry=document.querySelector('#journalList .journal-entry[data-date="'+date+'"]');
  if(!entry)return;
  var badge=entry.querySelector('.j-pub-badge');
  var btn=entry.querySelector('.j-pub-btn');
  var newPub=!pub;
  if(badge){badge.className=newPub?'j-badge-pub':'j-badge-draft';badge.textContent=newPub?'✓ Publié':'Brouillon';}
  if(btn){btn.textContent=newPub?'Dépublier':'Publier';}
}
function deleteJournalEntry(date){
  if(!isAdmin)return;
  confirmDialog({
    title:'Supprimer l\'entrée journal',
    message:'Le texte sera effacé. La progression (km, carte) reste intacte.',
    okLabel:'Supprimer'
  }).then(function(ok){
    if(!ok)return;
    Promise.all([
      window._fbRemove(window._fbRef(window._fbDb,'journals/'+date)),
      window._fbSet(window._fbRef(window._fbDb,'stages/'+date+'/journalDeleted'),true)
    ]).then(function(){ Events.emit('state:journal-changed'); })
      .catch(function(err){ console.error('[deleteJournalEntry]',err); });
  });
}
