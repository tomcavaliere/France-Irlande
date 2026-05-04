// journal.js
// Journal rendering, save/flush, Firebase subscriptions,
// text preloading, lazy media loading, bravos, and visitor ID.

// ==== JOURNAL SAVE ====
// Called via event delegation on <textarea data-event="input">.
// Signature: (arg, _arg2, el) — reads the current value from the element.
var MIN_JOURNAL_TEXTAREA_HEIGHT=70;
var COLLECTION_SNAPSHOT_TTL_MS=2*60*1000;
var STAGE_CONTENT_SNAPSHOT_TTL_MS=10*60*1000;
var STAGE_CONTENT_KEYS=['photos','videos','comments','bravos','commentLikes','commentReplies'];
var _stagesFetchedAt=0;
var _journalsFetchedAt=0;
var _stagesFetchPromise=null;
var _journalsFetchPromise=null;
var _stageContentFetchedAt={};
var _stageContentPending={};

/**
 * Autosize a journal textarea so all text stays visible without inner scrolling.
 * @param {HTMLTextAreaElement|null|undefined} ta
 * @returns {void}
 */
function resizeJournalTextarea(ta){
  if(!ta)return;
  ta.style.height='auto';
  ta.style.height=Math.max(ta.scrollHeight,MIN_JOURNAL_TEXTAREA_HEIGHT)+'px';
}

function _persistPendingJournal(date){
  if(_journalSaveInflight[date])return _journalSaveInflight[date];
  if(!Object.prototype.hasOwnProperty.call(_journalSaveTimers,date))return Promise.resolve();
  if(!isOnline||!window._fbDb||!window._fbSet||!window._fbRef)return Promise.resolve();
  var text=typeof _journalSaveTimers[date]==='string'?_journalSaveTimers[date]:'';
  _journalSaveInflight[date]=window._fbSet(window._fbRef(window._fbDb,'journals/'+date),text)
    .catch(function(err){
      console.error('[persistJournal]',err);
      showToast('Journal non sauvé — nouvelle tentative au prochain retour réseau','error',6000);
      queueWrite('journals/'+date,text);
    })
    .finally(function(){
      delete _journalSaveInflight[date];
      if(_journalSaveTimers[date]===text)delete _journalSaveTimers[date];
      if(Object.prototype.hasOwnProperty.call(_journalSaveTimers,date))_persistPendingJournal(date);
    });
  return _journalSaveInflight[date];
}

function onJournalInput(date, _arg2, el){
  if(!isAdmin)return;
  resizeJournalTextarea(el);
  var text=el&&typeof el.value==='string'?el.value:'';
  journals[date]=text;
  saveLocalCache();
  _journalSaveTimers[date]=text;
  if(!isOnline||!window._fbDb||!window._fbSet||!window._fbRef)return;
  _persistPendingJournal(date);
}

function flushJournals(){
  Object.keys(_journalSaveTimers).forEach(function(date){
    if(!isOnline||!window._fbDb||_journalSaveInflight[date]){
      queueWrite('journals/'+date,journals[date]||'');
      return;
    }
    _persistPendingJournal(date);
  });
}

function patchJournal(){
  var entries=document.querySelectorAll('#journalList .journal-entry');
  entries.forEach(function(entry){
    var date=entry.dataset.date;
    if(!date)return;
    var ta=entry.querySelector('.j-ta');
    if(ta&&document.activeElement!==ta){
      ta.value=journals[date]||'';
      resizeJournalTextarea(ta);
    }
    patchMedia(date);
  });
}

function _isFreshFetch(lastTs, ttlMs){
  return Number.isFinite(lastTs)&&lastTs>0&&(Date.now()-lastTs)<ttlMs;
}

function _mergeRemoteJournalsWithPendingDrafts(remoteData){
  var source=(remoteData&&typeof remoteData==='object')?remoteData:{};
  var merged=Object.assign({},source);
  Object.keys(_journalSaveTimers||{}).forEach(function(date){
    merged[date]=typeof _journalSaveTimers[date]==='string'
      ?_journalSaveTimers[date]
      :(typeof journals[date]==='string'?journals[date]:'');
  });
  return merged;
}

function _ensureStageContentMeta(date){
  if(!_stageContentFetchedAt[date])_stageContentFetchedAt[date]={};
  return _stageContentFetchedAt[date];
}

function _ensureStageContentPending(date){
  if(!_stageContentPending[date])_stageContentPending[date]={};
  return _stageContentPending[date];
}

function _markStageContentFetched(date, key){
  _ensureStageContentMeta(date)[key]=Date.now();
}

function _isStageContentLoaded(date, key){
  var meta=_stageContentFetchedAt[date];
  return !!(meta&&meta[key]);
}

function _isStageContentFresh(date, key){
  var meta=_stageContentFetchedAt[date];
  return !!(meta&&_isFreshFetch(meta[key],STAGE_CONTENT_SNAPSHOT_TTL_MS));
}

function _setStageContentPending(date, key, promise){
  _ensureStageContentPending(date)[key]=promise;
}

function _getStageContentPending(date, key){
  var pending=_stageContentPending[date];
  return pending?pending[key]:null;
}

function _clearStageContentPending(date, key){
  var pending=_stageContentPending[date];
  if(!pending)return;
  delete pending[key];
  if(!Object.keys(pending).length)delete _stageContentPending[date];
}

function _isStageFullyHydrated(date){
  return STAGE_CONTENT_KEYS.every(function(key){
    return _isStageContentLoaded(date,key);
  });
}

function _cleanupRemovedStageContent(){
  var knownDates=stages&&typeof stages==='object'?stages:{};
  Object.keys(_stageContentFetchedAt).forEach(function(date){
    if(Object.prototype.hasOwnProperty.call(knownDates,date))return;
    [photosUnsub, videosUnsub, commentsUnsub, bravosUnsub, commentLikesUnsub, commentRepliesUnsub].forEach(function(map){
      var unsub=map[date];
      if(typeof unsub==='function')unsub();
      delete map[date];
    });
    delete photos[date];
    delete videos[date];
    delete comments[date];
    delete commentLikes[date];
    delete commentReplies[date];
    delete bravosByDate[date];
    delete _stageContentFetchedAt[date];
    delete _stageContentPending[date];
  });
}

function teardownStageContentSubscriptions(){
  [photosUnsub, videosUnsub, commentsUnsub, bravosUnsub, commentLikesUnsub, commentRepliesUnsub].forEach(function(map){
    Object.values(map).forEach(function(unsub){
      if(typeof unsub==='function')unsub();
    });
  });
  photosUnsub={};
  videosUnsub={};
  commentsUnsub={};
  bravosUnsub={};
  commentLikesUnsub={};
  commentRepliesUnsub={};
}

function _mergePendingComments(date, incoming){
  var merged=Object.assign({},incoming&&typeof incoming==='object'?incoming:{});
  var existing=comments[date];
  if(!existing||typeof existing!=='object')return merged;
  Object.keys(existing).forEach(function(id){
    var comment=existing[id];
    if(comment&&comment._pending&&!merged[id]){
      merged[id]=comment;
    }
  });
  return merged;
}

function _fetchStagesSnapshot(force){
  if(!window._fbDb||!window._fbGet||!window._fbRef)return Promise.resolve(stages);
  if(_stagesFetchPromise)return _stagesFetchPromise;
  if(!force&&Object.keys(stages||{}).length&&_isFreshFetch(_stagesFetchedAt,COLLECTION_SNAPSHOT_TTL_MS)){
    return Promise.resolve(stages);
  }
  _stagesFetchPromise=window._fbGet(window._fbRef(window._fbDb,'stages'))
    .then(function(snap){
      stages=snap.val()||{};
      _stagesFetchedAt=Date.now();
      saveLocalCache();
      Events.emit('state:stages-changed');
      return stages;
    })
    .catch(function(err){
      console.error('[get/stages]',err);
      showToast('Impossible de charger les étapes.','error');
      return stages;
    })
    .finally(function(){
      _stagesFetchPromise=null;
    });
  return _stagesFetchPromise;
}

function _fetchJournalsSnapshot(force){
  if(!window._fbDb||!window._fbGet||!window._fbRef)return Promise.resolve(journals);
  if(_journalsFetchPromise)return _journalsFetchPromise;
  if(!force&&Object.keys(journals||{}).length&&_isFreshFetch(_journalsFetchedAt,COLLECTION_SNAPSHOT_TTL_MS)){
    return Promise.resolve(journals);
  }
  _journalsFetchPromise=window._fbGet(window._fbRef(window._fbDb,'journals'))
    .then(function(snap){
      journals=_mergeRemoteJournalsWithPendingDrafts(snap.val());
      _journalsFetchedAt=Date.now();
      saveLocalCache();
      Events.emit('state:journal-changed');
      return journals;
    })
    .catch(function(err){
      console.error('[get/journals]',err);
      showToast('Impossible de charger les textes du journal.','error');
      return journals;
    })
    .finally(function(){
      _journalsFetchPromise=null;
    });
  return _journalsFetchPromise;
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
  if(!window._fbDb)return;
  if(isAdmin){
    if(!_unsubStages){
      _unsubStages=window._fbOnValue(window._fbRef(window._fbDb,'stages'),function(snap){
        stages=snap.val()||{};
        _stagesFetchedAt=Date.now();
        saveLocalCache();
        Events.emit('state:stages-changed');
      });
    }
    if(!_unsubJournals){
      _unsubJournals=window._fbOnValue(window._fbRef(window._fbDb,'journals'),function(snap){
        journals=_mergeRemoteJournalsWithPendingDrafts(snap.val());
        _journalsFetchedAt=Date.now();
        saveLocalCache();
        Events.emit('state:journal-changed');
      },function(err){
        console.error('[onValue/journals]',err);
        showToast('Impossible de charger les textes du journal.','error');
      });
    }
    return;
  }
  if(_unsubStages){_unsubStages();_unsubStages=null;}
  if(_unsubJournals){_unsubJournals();_unsubJournals=null;}
  teardownStageContentSubscriptions();
  _fetchStagesSnapshot(false);
  _fetchJournalsSnapshot(false);
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
  if(!bravosByDate[date])bravosByDate[date]={};
  if(bravosByDate[date][vid]){
    patchBravos(date,bravosByDate[date]);
    return;
  }
  bravosByDate[date][vid]=true;
  _markStageContentFetched(date,'bravos');
  patchBravos(date,bravosByDate[date]);
  window._fbSet(window._fbRef(window._fbDb,'bravos/'+date+'/'+vid),true).catch(function(err){
    console.error('[addBravo]',err);
    if(bravosByDate[date])delete bravosByDate[date][vid];
    patchBravos(date,bravosByDate[date]||{});
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

function _applyStageContentSnapshot(date, key, snap){
  var raw=snap&&snap.exists()?snap.val():null;
  if(key==='photos'){
    photos[date]=raw||{};
    patchMedia(date);
  }else if(key==='videos'){
    videos[date]=raw||{};
    patchMedia(date);
  }else if(key==='comments'){
    comments[date]=_mergePendingComments(date,raw);
    saveCommentsCache(date,comments[date]);
    patchStageComments(date);
  }else if(key==='bravos'){
    patchBravos(date,Object.assign({},raw||{},bravosByDate[date]||{}));
  }else if(key==='commentLikes'){
    commentLikes[date]=raw||{};
    patchStageComments(date);
  }else if(key==='commentReplies'){
    commentReplies[date]=raw||{};
    patchStageComments(date);
  }
  _markStageContentFetched(date,key);
  if(_isStageFullyHydrated(date))_removeSkeleton(date);
}

function _stageUnsubMap(key){
  if(key==='photos')return photosUnsub;
  if(key==='videos')return videosUnsub;
  if(key==='comments')return commentsUnsub;
  if(key==='bravos')return bravosUnsub;
  if(key==='commentLikes')return commentLikesUnsub;
  if(key==='commentReplies')return commentRepliesUnsub;
  return null;
}

function _loadStageNode(date, key, path, errContext){
  if(!window._fbDb)return;
  if(isAdmin){
    var unsubMap=_stageUnsubMap(key);
    if(unsubMap&&unsubMap[date])return;
    if(unsubMap){
      unsubMap[date]=window._fbOnValue(window._fbRef(window._fbDb,path),function(snap){
        _applyStageContentSnapshot(date,key,snap);
      },function(err){
        console.error(errContext,err);
      });
    }
    return;
  }
  if(_isStageContentFresh(date,key))return;
  var pending=_getStageContentPending(date,key);
  if(pending)return;
  var promise=window._fbGet(window._fbRef(window._fbDb,path))
    .then(function(snap){
      _applyStageContentSnapshot(date,key,snap);
    })
    .catch(function(err){
      console.error(errContext,err);
    })
    .finally(function(){
      _clearStageContentPending(date,key);
    });
  _setStageContentPending(date,key,promise);
}

function loadStageContent(date){
  if(!window._fbDb)return;
  if(_isStageFullyHydrated(date)&&STAGE_CONTENT_KEYS.every(function(key){
    return _isStageContentFresh(date,key);
  })){
    _removeSkeleton(date);
    return;
  }
  _loadStageNode(date,'photos','photos/'+date,'[get/photos]');
  _loadStageNode(date,'videos','videos/'+date,'[get/videos]');
  _loadStageNode(date,'comments','comments/'+date,'[get/comments]');
  _loadStageNode(date,'bravos','bravos/'+date,'[get/bravos]');
  _loadStageNode(date,'commentLikes','commentLikes/'+date,'[get/commentLikes]');
  _loadStageNode(date,'commentReplies','commentReplies/'+date,'[get/commentReplies]');
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

function showMoreJournalEntries(){
  journalVisibleCount=Number.MAX_SAFE_INTEGER;
  renderJournal();
}

// ==== JOURNAL RENDER ====
function renderJournal(){
  if(photoObserver)photoObserver.disconnect();
  _cleanupRemovedStageContent();
  var c=document.getElementById('journalList');c.innerHTML='';
  var dates=filterVisibleJournalDates(stages,isAdmin);
  var visibleCount=journalVisibleCount;
  var visibleDates=dates.slice(0,visibleCount);
  var hasAny=false;
  visibleDates.forEach(function(date){
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
    var skeletonHtml=_isStageFullyHydrated(date)?'':(
      '<div class="j-skeleton" data-skeleton-for="'+edate+'">'+
        '<div class="j-skeleton-row"></div>'+
        '<div class="j-skeleton-row"></div>'+
        '<div class="j-skeleton-media"></div>'+
      '</div>'
    );
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
  } else {
    c.querySelectorAll('.j-ta').forEach(function(ta){
      resizeJournalTextarea(ta);
    });
    if(dates.length>visibleDates.length){
      var remaining=dates.length-visibleDates.length;
      var moreWrap=document.createElement('div');
      moreWrap.className='load-more-wrap';
      moreWrap.innerHTML='<button class="btn btn-o" data-action="showMoreJournalEntries">Afficher les '+remaining+' jours précédents</button>';
      c.appendChild(moreWrap);
    }
  }
  observeJournalEntries();
}
