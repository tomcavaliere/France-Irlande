// stages.js
// Stage cards rendering, recap summary, stage CRUD operations.

function renderStages(){
  var c=document.getElementById('stagesList');
  if(!c)return;
  c.innerHTML='';
  var dates=Object.keys(stages).sort();
  if(!dates.length){
    c.innerHTML='<div style="text-align:center;color:var(--text-light);font-size:13px;padding:24px 0">'+
      'Les étapes apparaîtront ici après la mise à jour de position chaque soir.</div>';
    updateRecap();return;
  }
  dates.forEach(function(date,idx){
    var d=stages[date];
    var card=document.createElement('div');
    card.className='stage-card';
    card.style.position='relative';
    var kmDay=d.kmDay||0;
    var kmTotal=d.kmTotal||0;
    var seg=d.lat&&d.lon?(snapToRoute(d.lat,d.lon).idx<=FRANCE_END_IDX?'🇫🇷':'🇮🇪'):'';
    var dateLabel=new Date(date+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
    var edate=escAttr(date);
    var adminStageHtml=isAdmin?
      '<button class="s-del" data-action="deleteStage" data-arg="'+edate+'" data-stop="1">&#x2715;</button>'+
      '<button class="s-write" data-action="openJournalEntry" data-arg="'+edate+'" data-stop="1">&#x1f4dd; Écrire</button>'
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
      '</div>';
    if(!isAdmin)card.onclick=function(){switchTab('journal');};
    c.appendChild(card);
  });
  updateRecap();
}

function updateRecap(){
  var dates=Object.keys(stages).sort();
  var kmD=current?current.kmTotal:0;
  var pct=Math.round((kmD/TOTAL_KM)*100);
  var nbDays=dates.length;
  var avg=nbDays>0?Math.round(kmD/nbDays):0;
  document.getElementById('rKmD').textContent=Math.round(kmD);
  document.getElementById('rKmL').textContent=Math.round(TOTAL_KM-kmD);
  document.getElementById('rDays').textContent=nbDays;
  document.getElementById('rAvg').textContent=avg||'—';
  document.getElementById('rBar').style.width=pct+'%';
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
    window._fbRemove(window._fbRef(window._fbDb,'stages/'+date+'/journalDeleted'));
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


