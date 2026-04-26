// journal.js
// Journal rendering, save/flush, Firebase subscriptions,
// lazy content loading, bravos, and visitor ID.

// ==== JOURNAL SAVE ====
// Called via event delegation on <textarea data-event="input">.
// Signature: (arg, _arg2, el) — reads the current value from the element.
function onJournalInput(date, _arg2, el){
  if(!isAdmin)return;
  var text=el?el.value:'';
  journals[date]=text;
  clearTimeout(_journalSaveTimers[date]);
  _journalSaveTimers[date]=setTimeout(function(){
    if(isOnline&&window._fbDb){
      window._fbSet(window._fbRef(window._fbDb,'journals/'+date),text)
        .catch(function(err){
          console.error('[onJournalInput]',err);
          showToast('Journal non sauvé — nouvelle tentative au prochain retour réseau','error',6000);
          queueWrite('journals/'+date,text);
        });
    } else {
      queueWrite('journals/'+date,text);
    }
  },60000);
}

function flushJournals(){
  Object.keys(_journalSaveTimers).forEach(function(date){
    clearTimeout(_journalSaveTimers[date]);
    if(isOnline&&window._fbDb){
      window._fbSet(window._fbRef(window._fbDb,'journals/'+date),journals[date]||'')
        .catch(function(err){
          console.error('[flushJournals]',err);
          queueWrite('journals/'+date,journals[date]||'');
        });
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
    patchMedia(date);
  });
}

// ==== FIREBASE SUBSCRIPTIONS ====
function initFirebase(){
  if(!window._fbDb)return;
  if(_unsubCurrent)_unsubCurrent();
  _unsubCurrent=window._fbOnValue(window._fbRef(window._fbDb,'current'),function(snap){
    current=snap.val();
    Events.emit('state:current-changed');
    saveLocalCache();
    setSyncDot(isOnline?'online':'offline');
  });
  // Charger /tracks dès le bootstrap pour afficher les tracés GPX
  // sur la carte sans devoir ouvrir l'onglet Carnet.
  if(_unsubTracks)_unsubTracks();
  _unsubTracks=window._fbOnValue(window._fbRef(window._fbDb,'tracks'),function(snap){
    tracks=snap.val()||{};
    Events.emit('state:tracks-changed');
  });
}

function openCarnetTab(){
  if(_unsubStages)return;
  if(!window._fbDb)return;
  _unsubStages=window._fbOnValue(window._fbRef(window._fbDb,'stages'),function(snap){
    stages=snap.val()||{};
    saveLocalCache();
    Events.emit('state:stages-changed');
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

function _saveVisitorProfile(vid){
  if(!window._fbDb||!window._fbSet||!window._fbRef)return;
  if(!vid)return;
  var name=getVisitorName();
  if(!name){
    console.warn('[visitorProfiles/set] missing visitor name');
    return;
  }
  var payload={name:name,ts:Date.now()};
  visitorProfiles[vid]=payload;
  window._fbSet(window._fbRef(window._fbDb,'visitorProfiles/'+vid),payload).catch(function(err){
    console.error('[visitorProfiles/set]',err);
  });
}

function _visitorIdFallbackLabel(visitorId){
  return 'ID '+String(visitorId||'').slice(0,8);
}

function _resolveVisitorNameById(visitorId){
  var known=visitorProfiles[visitorId];
  if(known&&typeof known.name==='string'&&known.name.trim()){
    return Promise.resolve(known.name.trim());
  }
  if(!window._fbDb||!window._fbGet||!window._fbRef){
    return Promise.resolve(_visitorIdFallbackLabel(visitorId));
  }
  return window._fbGet(window._fbRef(window._fbDb,'visitorProfiles/'+visitorId))
    .then(function(snap){
      var data=snap&&snap.exists()?snap.val():null;
      var name=data&&typeof data.name==='string'?data.name.trim():'';
      if(name){
        visitorProfiles[visitorId]={name:name,ts:data&&data.ts?data.ts:0};
        return name;
      }
      return _visitorIdFallbackLabel(visitorId);
    })
    .catch(function(err){
      console.error('[visitorProfiles/get]',err);
      return _visitorIdFallbackLabel(visitorId);
    });
}

function addBravo(date){
  var vid=getVisitorId();
  _saveVisitorProfile(vid);
  window._fbSet(window._fbRef(window._fbDb,'bravos/'+date+'/'+vid),true).catch(function(err){
    console.error('[addBravo]',err);
  });
}

function showBravosList(date){
  if(!isAdmin)return;
  var bravos=bravosByDate[date]||{};
  var ids=Object.keys(bravos);
  if(!ids.length){
    showToast('Aucun bravo pour cette étape.','info');
    return;
  }
  Promise.all(ids.map(_resolveVisitorNameById)).then(function(names){
    showToast('👏 '+names.length+' bravo'+(names.length>1?'s':'')+' : '+names.join(', '),'info',7000);
  }).catch(function(err){
    console.error('[showBravosList]',err);
    showToast('Impossible de charger la liste des bravos.','error');
  });
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
  bravosByDate[date]=bravosData||{};
  var count=JournalCore.countBravos(bravosData);
  var voted=JournalCore.hasVoted(bravosData,getVisitorId());
  var countEl=entry.querySelector('.j-bravo-count');
  var btn=entry.querySelector('.j-bravo-btn');
  var adminBtn=entry.querySelector('.j-bravo-admin-btn');
  if(countEl)countEl.textContent=isAdmin?'\uD83D\uDC4F '+count:count;
  if(btn)btn.disabled=voted;
  if(adminBtn){
    adminBtn.textContent='👏 '+count;
    adminBtn.disabled=!count;
  }
}

function _removeSkeleton(date){
  var sk=document.querySelector('.j-skeleton[data-skeleton-for="'+date+'"]');
  if(sk&&sk.parentNode)sk.parentNode.removeChild(sk);
}

function loadStageContent(date){
  if(journalsUnsub[date])return;
  if(!window._fbDb)return;

  journalsUnsub[date]=window._fbOnValue(window._fbRef(window._fbDb,'journals/'+date),function(snap){
    journals[date]=snap.val()||'';
    saveLocalCache();
    patchJournalText(date);
    _removeSkeleton(date);
  });

  photosUnsub[date]=window._fbOnValue(window._fbRef(window._fbDb,'photos/'+date),function(snap){
    photos[date]=snap.val()||{};
    patchMedia(date);
    _removeSkeleton(date);
  });

  videosUnsub[date]=window._fbOnValue(window._fbRef(window._fbDb,'videos/'+date),function(snap){
    videos[date]=snap.val()||{};
    patchMedia(date);
    _removeSkeleton(date);
  });

  commentsUnsub[date]=window._fbOnValue(window._fbRef(window._fbDb,'comments/'+date),function(snap){
    comments[date]=snap.val()||{};
    saveCommentsCache(date,comments[date]);
    patchStageComments(date);
    _removeSkeleton(date);
  });

  bravosUnsub[date]=window._fbOnValue(window._fbRef(window._fbDb,'bravos/'+date),function(snap){
    patchBravos(date,snap.val()||{});
    _removeSkeleton(date);
  });

  // Visitor-visible: display comments liked by Tom (likes are admin-written).
  commentLikesUnsub[date]=window._fbOnValue(window._fbRef(window._fbDb,'commentLikes/'+date),function(snap){
    commentLikes[date]=snap.val()||{};
    patchStageComments(date);
  });
  if(isAdmin){
    commentRepliesUnsub[date]=window._fbOnValue(window._fbRef(window._fbDb,'commentReplies/'+date),function(snap){
      commentReplies[date]=snap.val()||{};
      patchStageComments(date);
    });
  }
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
  [journalsUnsub, photosUnsub, videosUnsub, commentsUnsub, bravosUnsub, commentLikesUnsub, commentRepliesUnsub].forEach(function(map){
    Object.values(map).forEach(function(unsub){
      if(typeof unsub==='function')unsub();
    });
  });
  journalsUnsub={};photosUnsub={};videosUnsub={};commentsUnsub={};bravosUnsub={};
  commentLikesUnsub={};commentRepliesUnsub={};
  photos={};videos={};comments={};commentLikes={};commentReplies={};
  bravosByDate={};
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
    var dateLabel=JournalCore.formatJournalDateLabel(date);
    var kmInfo=JournalCore.buildKmInfoLabel(d);
    var edate=escAttr(date);
    var pub=!!(stages[date]&&stages[date].published);
    var adminActionsHtml='';
    if(isAdmin){
      adminActionsHtml=
        '<div class="j-actions">'+
          '<span class="'+(pub?'j-badge-pub':'j-badge-draft')+' j-pub-badge">'+(pub?'\u2713 Publié':'Brouillon')+'</span>'+
          '<button class="btn btn-o j-pub-btn" data-action="publishDay" data-arg="'+edate+'">'+
            (pub?'Dépublier':'Publier')+
          '</button>'+
          '<button class="btn btn-danger" data-action="deleteJournalEntry" data-arg="'+edate+'">&#x1f5d1; Supprimer</button>'+
        '</div>';
    }
    var taAttr=isAdmin?' data-action="onJournalInput" data-event="input" data-arg="'+edate+'"':' readonly';
    var taHtml='';
    if(isAdmin){
      taHtml='<textarea class="j-ta" placeholder="Raconte ta journée..."'+taAttr+'>'+Utils.escHtml(txt)+'</textarea>';
    } else if(txt){
      taHtml='<textarea class="j-ta"'+taAttr+'>'+Utils.escHtml(txt)+'</textarea>';
    }
    var bravosHtml=isAdmin
      ?'<div class="j-bravos"><button class="j-bravo-admin-btn" data-action="showBravosList" data-arg="'+edate+'" disabled>👏 0</button></div>'
      :'<div class="j-bravos"><button class="j-bravo-btn" data-action="addBravo" data-arg="'+edate+'">Maith sibh! \uD83D\uDC4F</button><span class="j-bravo-count"></span></div>';
    var skeletonHtml='<div class="j-skeleton" data-skeleton-for="'+edate+'">'+
      '<div class="j-skeleton-row"></div>'+
      '<div class="j-skeleton-row"></div>'+
      '<div class="j-skeleton-media"></div>'+
    '</div>';
    entry.innerHTML=
      '<div class="j-date">'+dateLabel+'</div>'+
      (kmInfo?'<div class="j-stage">'+kmInfo+'</div>':'')+
      taHtml+
      skeletonHtml+
      renderMediaHtml(date)+
      bravosHtml+
      adminActionsHtml+
      renderStageCommentsHtml(date);
    c.appendChild(entry);
  });
  if(!hasAny){
    c.innerHTML='<div class="empty-state empty-state-lg">'+
      'Le journal appara\u00eetra ici apr\u00e8s la mise \u00e0 jour de position.</div>';
  }
  observeJournalEntries();
}
