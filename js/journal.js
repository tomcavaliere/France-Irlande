// journal.js
// Journal rendering, save/flush, Firebase subscriptions,
// lazy content loading, bravos, and visitor ID.

// ==== JOURNAL SAVE ====
function onJournalInput(date, text){
  if(!isAdmin)return;
  journals[date]=text;
  clearTimeout(_journalSaveTimers[date]);
  _journalSaveTimers[date]=setTimeout(function(){
    if(isOnline&&window._fbDb){
      window._fbSet(window._fbRef(window._fbDb,'journals/'+date),text);
    } else {
      queueWrite('journals/'+date,text);
    }
  },60000);
}

function flushJournals(){
  Object.keys(_journalSaveTimers).forEach(function(date){
    clearTimeout(_journalSaveTimers[date]);
    if(isOnline&&window._fbDb){
      window._fbSet(window._fbRef(window._fbDb,'journals/'+date),journals[date]||'');
    } else {
      queueWrite('journals/'+date,journals[date]||'');
    }
  });
  _journalSaveTimers={};
}

function patchJournal(){
  var entries=document.querySelectorAll('#journalList .journal-entry');
  entries.forEach(function(entry){
    var date=entry.dataset.date;
    if(!date)return;
    var ta=entry.querySelector('.j-ta');
    if(ta&&document.activeElement!==ta){ta.value=journals[date]||'';}
    patchPhotos(date);
  });
}

// ==== FIREBASE SUBSCRIPTIONS ====
function initFirebase(){
  if(!window._fbDb)return;
  if(_unsubCurrent)_unsubCurrent();
  _unsubCurrent=window._fbOnValue(window._fbRef(window._fbDb,'current'),function(snap){
    current=snap.val();
    updateMap();
    updatePositionBadge();
    saveLocalCache();
    setSyncDot(isOnline?'online':'offline');
  });
}

function openCarnetTab(){
  if(_unsubStages)return;
  if(!window._fbDb)return;
  _unsubStages=window._fbOnValue(window._fbRef(window._fbDb,'stages'),function(snap){
    stages=snap.val()||{};
    saveLocalCache();
    var countChanged=Object.keys(stages).length!==lastCompletedCount;
    renderStages();
    if(!fbInitialized){
      renderJournal();fbInitialized=true;journalDirty=false;
    } else if(countChanged){
      if(activeTab()==='journal'){renderJournal();journalDirty=false;}
      else{journalDirty=true;}
    }
    lastCompletedCount=Object.keys(stages).length;
  });
}

// ==== BRAVOS ====
function getVisitorId(){
  var k='ev1_visitor_id';
  var id=localStorage.getItem(k);
  if(!id){
    id=crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
    localStorage.setItem(k,id);
  }
  return id;
}

function addBravo(date){
  var vid=getVisitorId();
  window._fbSet(window._fbRef(window._fbDb,'bravos/'+date+'/'+vid),true).catch(function(err){
    console.error('[addBravo]',err);
  });
}

function loadBravos(date){
  if(!window._fbDb||!window._fbOnValue)return;
  var ref=window._fbRef(window._fbDb,'bravos/'+date);
  var unsub=window._fbOnValue(ref,function(snap){
    var data=snap.val()||{};
    var count=Object.keys(data).length;
    var vid=getVisitorId();
    var voted=!!data[vid];
    var entry=document.querySelector('.journal-entry[data-date="'+date+'"]');
    if(!entry)return;
    var countEl=entry.querySelector('.j-bravo-count');
    var btn=entry.querySelector('.j-bravo-btn');
    if(countEl)countEl.textContent=isAdmin?'\uD83D\uDC4F '+count:count;
    if(btn)btn.disabled=voted;
  });
  bravosUnsub[date] = unsub;
}

function patchJournalText(date){
  var entry=document.querySelector('#journalList .journal-entry[data-date="'+date+'"]');
  if(!entry)return;
  var ta=entry.querySelector('.j-ta');
  if(ta&&document.activeElement!==ta){ta.value=journals[date]||'';}
}

function patchBravos(date, bravosData){
  var entry=document.querySelector('#journalList .journal-entry[data-date="'+date+'"]');
  if(!entry)return;
  var count=Object.keys(bravosData).length;
  var voted=!!bravosData[getVisitorId()];
  var countEl=entry.querySelector('.j-bravo-count');
  var btn=entry.querySelector('.j-bravo-btn');
  if(countEl)countEl.textContent=isAdmin?'\uD83D\uDC4F '+count:count;
  if(btn)btn.disabled=voted;
}

function loadStageContent(date){
  if(journalsUnsub[date])return;
  if(!window._fbDb)return;

  journalsUnsub[date]=window._fbOnValue(window._fbRef(window._fbDb,'journals/'+date),function(snap){
    journals[date]=snap.val()||'';
    saveLocalCache();
    patchJournalText(date);
  });

  photosUnsub[date]=window._fbOnValue(window._fbRef(window._fbDb,'photos/'+date),function(snap){
    photos[date]=snap.val()||{};
    patchPhotos(date);
  });

  commentsUnsub[date]=window._fbOnValue(window._fbRef(window._fbDb,'comments/'+date),function(snap){
    comments[date]=snap.val()||{};
    saveCommentsCache(date,comments[date]);
    patchStageComments(date);
  });

  bravosUnsub[date]=window._fbOnValue(window._fbRef(window._fbDb,'bravos/'+date),function(snap){
    patchBravos(date,snap.val()||{});
  });
}

function observeJournalEntries(){
  if(!('IntersectionObserver' in window)){
    document.querySelectorAll('#journalList .journal-entry').forEach(function(entry){
      if(entry.dataset.date)loadStageContent(entry.dataset.date);
    });
    return;
  }
  photoObserver=new IntersectionObserver(function(entries){
    entries.forEach(function(obs){
      if(obs.isIntersecting){
        var date=obs.target.dataset.date;
        if(date)loadStageContent(date);
      }
    });
  },{rootMargin:'200px'});
  document.querySelectorAll('#journalList .journal-entry').forEach(function(entry){
    photoObserver.observe(entry);
  });
}

// ==== JOURNAL RENDER ====
function renderJournal(){
  if(photoObserver)photoObserver.disconnect();
  // Teardown all lazy listeners
  [journalsUnsub, photosUnsub, commentsUnsub, bravosUnsub].forEach(function(map){
    Object.values(map).forEach(function(unsub){
      if(typeof unsub==='function')unsub();
    });
  });
  journalsUnsub={};photosUnsub={};commentsUnsub={};bravosUnsub={};
  photos={};comments={};
  // (journals NOT cleared — needed for admin editing)
  var c=document.getElementById('journalList');c.innerHTML='';
  var dates=filterVisibleJournalDates(stages,isAdmin);
  var hasAny=false;
  dates.forEach(function(date){
    var d=stages[date];
    hasAny=true;
    var entry=document.createElement('div');
    entry.className='journal-entry';
    entry.dataset.date=date;
    var txt=journals[date]||'';
    var dateLabel=new Date(date+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
    var kmInfo=d.kmDay?'\uD83D\uDEB4 '+Math.round(d.kmDay)+' km \u2014 total '+Math.round(d.kmTotal)+' km':'';
    var edate=escAttr(date);
    var pub=!!(stages[date]&&stages[date].published);
    var adminActionsHtml='';
    if(isAdmin){
      adminActionsHtml=
        '<div class="j-actions">'+
          '<span class="'+(pub?'j-badge-pub':'j-badge-draft')+' j-pub-badge">'+(pub?'\u2713 Publié':'Brouillon')+'</span>'+
          '<button class="btn btn-o j-pub-btn" onclick="publishDay(\''+edate+'\')">'+
            (pub?'Dépublier':'Publier')+
          '</button>'+
          '<button class="btn btn-danger" onclick="deleteJournalEntry(\''+edate+'\')">&#x1f5d1; Supprimer</button>'+
        '</div>';
    }
    var taAttr=isAdmin?' oninput="onJournalInput(\''+edate+'\',this.value)"':' readonly';
    var taHtml='';
    if(isAdmin){
      taHtml='<textarea class="j-ta" placeholder="Raconte ta journée..."'+taAttr+'>'+Utils.escHtml(txt)+'</textarea>';
    } else if(txt){
      taHtml='<textarea class="j-ta"'+taAttr+'>'+Utils.escHtml(txt)+'</textarea>';
    }
    var bravosHtml=isAdmin
      ?'<div class="j-bravos"><span class="j-bravo-count"></span></div>'
      :'<div class="j-bravos"><button class="j-bravo-btn" onclick="addBravo(\''+edate+'\')">Maith sibh! \uD83D\uDC4F</button><span class="j-bravo-count"></span></div>';
    entry.innerHTML=
      '<div class="j-date">'+dateLabel+'</div>'+
      (kmInfo?'<div class="j-stage">'+kmInfo+'</div>':'')+
      taHtml+
      renderPhotosHtml(date)+
      bravosHtml+
      adminActionsHtml+
      renderStageCommentsHtml(date);
    c.appendChild(entry);
  });
  if(!hasAny){
    c.innerHTML='<div style="text-align:center;color:var(--text-light);font-size:13px;padding:32px 0">'+
      'Le journal appara\u00eetra ici apr\u00e8s la mise \u00e0 jour de position.</div>';
  }
  observeJournalEntries();
}
