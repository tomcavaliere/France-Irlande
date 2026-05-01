// comments.js
// Stage comments: rendering, posting, deletion, cooldown,
// admin likes and admin replies.

// Tracks which comment reply forms are currently open.
// Key: "date/commentId", value: true
var _replyOpen = {};
var _replyThreadOpen = {};
var DEFAULT_ADMIN_REPLY_AUTHOR = 'Tom';
var ADMIN_NAME_MAPPINGS = [
  {match:'chloe',label:'Chloé'},
  {match:'tom',label:'Tom'}
];

function _makeCommentEntityId(prefix){
  return prefix+Date.now()+'_'+Math.random().toString(36).slice(2,6);
}

function _copyNonEmptyObject(source,key){
  var value=source&&source[key];
  return value&&typeof value==='object'&&Object.keys(value).length
    ? Object.assign({},value)
    : null;
}

function _deleteEmptyChild(obj,key){
  if(obj&&obj[key]&&typeof obj[key]==='object'&&!Object.keys(obj[key]).length){
    delete obj[key];
  }
}

function _replyKey(date,id){
  return date+'/'+id;
}

function _replyCooldownKey(date,id){
  return 'ev1-reply-last-'+date+'-'+id;
}

function _getLastReplyTs(date,id){
  return parseInt(localStorage.getItem(_replyCooldownKey(date,id)),10)||0;
}

function _setLastReplyTs(date,id){
  localStorage.setItem(_replyCooldownKey(date,id),String(Date.now()));
}

function _normalizeAdminReplyAuthorName(value){
  var raw=typeof value==='string'?value.trim():'';
  if(!raw)return 'Admin';
  var normalized=raw;
  try{
    normalized=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }catch(_err){}
  var lowered=normalized.toLowerCase();
  var mapped=ADMIN_NAME_MAPPINGS.find(function(entry){
    return lowered.indexOf(entry.match)!==-1;
  });
  if(mapped)return mapped.label;
  if(raw.indexOf('@')!==-1)raw=raw.split('@')[0];
  raw=raw.replace(/[._-]+/g,' ').trim();
  if(!raw)return 'Admin';
  return raw.split(/\s+/).map(function(part){
    return part.charAt(0).toUpperCase()+part.slice(1).toLowerCase();
  }).join(' ');
}

/**
 * Résout le nom à afficher pour la réponse admin courante.
 * Priorité: displayName Firebase, puis email, puis fallback normalisé "Admin".
 * @returns {string}
 */
function _getCurrentAdminReplyAuthorName(){
  var user=window._fbAuth&&window._fbAuth.currentUser;
  var candidate=user&&typeof user.displayName==='string'&&user.displayName.trim()
    ? user.displayName
    : (user&&typeof user.email==='string'?user.email:'');
  return _normalizeAdminReplyAuthorName(candidate);
}

function _normalizeCommentReply(raw){
  if(!raw||typeof raw!=='object')return null;
  var text=typeof raw.text==='string'?raw.text.trim():'';
  if(!text)return null;
  return {
    text:text,
    ts:typeof raw.ts==='number'?raw.ts:0,
    authorName:_normalizeAdminReplyAuthorName(raw.authorName||DEFAULT_ADMIN_REPLY_AUTHOR),
    likes:(raw.likes&&typeof raw.likes==='object')?raw.likes:{},
    replies:(raw.replies&&typeof raw.replies==='object')?raw.replies:{}
  };
}

function _ensureLocalCommentReply(date,id){
  var current=_normalizeCommentReply(commentReplies[date]&&commentReplies[date][id]);
  var next={
    text:current&&current.text?current.text:'',
    ts:current&&current.ts?current.ts:0,
    authorName:current?current.authorName:DEFAULT_ADMIN_REPLY_AUTHOR
  };
  var likesCopy=_copyNonEmptyObject(current,'likes');
  var repliesCopy=_copyNonEmptyObject(current,'replies');
  if(likesCopy)next.likes=likesCopy;
  if(repliesCopy)next.replies=repliesCopy;
  if(!commentReplies[date])commentReplies[date]={};
  commentReplies[date][id]=next;
  return commentReplies[date][id];
}

function _renderReplyThreadRepliesHtml(date,id,reply){
  var replyIds=Object.keys(reply.replies||{}).sort(function(a,b){
    var aa=reply.replies[a]||{};
    var bb=reply.replies[b]||{};
    return (aa.ts||0)-(bb.ts||0);
  });
  var html='';
  if(replyIds.length){
    html+='<div class="comment-reply-thread-list">';
    replyIds.forEach(function(replyId){
      var item=reply.replies[replyId];
      if(!item||typeof item!=='object')return;
      html+='<div class="comment-reply-thread-item">'+
        '<div class="comment-reply-thread-head">'+
          '<span class="comment-reply-thread-name">'+escHtml(item.name||'Visiteur')+'</span>'+
          '<span class="comment-reply-thread-time">'+formatTime(item.ts)+'</span>'+
          (isAdmin?'<button class="comment-reply-thread-del" data-action="deleteReplyThreadItem" data-arg="'+escAttr(date)+'" data-arg2="'+escAttr(id)+'" data-arg3="'+escAttr(replyId)+'" title="Supprimer la réponse visiteur">&#x1f5d1;</button>':'')+
        '</div>'+
        '<div class="comment-reply-thread-text">'+escHtml(item.text||'')+'</div>'+
        '</div>';
    });
    html+='</div>';
  }
  return html;
}

function renderStageCommentsHtml(i){
  var stageCmts=comments[i]||{};
  var stageLikes=commentLikes[i]||{};
  var stageReplies=commentReplies[i]||{};
  var visitorName=!isAdmin?getVisitorName():'';
  var visitorId=(!isAdmin&&visitorName)?getVisitorId():'';
  var ids=Object.keys(stageCmts).sort(function(a,b){return (stageCmts[a].ts||0)-(stageCmts[b].ts||0);});
  var ei=escAttr(i);
  var html='<div class="stage-comments" id="scmts-'+ei+'">';
  if(ids.length){
    html+='<div class="m-sec-t comments-title">&#x1f4ac; Commentaires</div>';
    ids.forEach(function(id){
      var c=stageCmts[id];
      var eid=escAttr(id);
      var liked=!!(stageLikes[id]);
      var reply=_normalizeCommentReply(stageReplies[id]);
      var replyKey=_replyKey(i,id);
      var replyOpen=!!_replyOpen[replyKey];
      var replyThreadOpen=!!_replyThreadOpen[replyKey];
      var likeBadgeHtml=liked?'<div class="comment-like-view">❤️ Aimé</div>':'';
      var adminExtraHtml='';
      if(isAdmin){
        adminExtraHtml+=
          '<div class="comment-admin-actions">'+
            '<button class="comment-like-btn'+(liked?' comment-liked':'')+'" data-action="likeComment" data-arg="'+ei+'" data-arg2="'+eid+'" title="'+(liked?'Retirer le like':'Aimer ce commentaire')+'" aria-label="'+(liked?'Retirer le like':'Aimer ce commentaire')+'">'+
              (liked?'&#x2764;&#xfe0f;':'&#x1f90d;')+
            '</button>'+
            '<button class="comment-reply-toggle" data-action="toggleReplyForm" data-arg="'+ei+'" data-arg2="'+eid+'" aria-label="'+(replyOpen?'Annuler la r\u00e9ponse':'R\u00e9pondre au commentaire')+'">'+
              (replyOpen?'Annuler':'&#x1f4ac; R\u00e9pondre')+
            '</button>'+
          '</div>';
      }
      if(reply){
        var replyLikes=reply.likes||{};
        var replyLikeCount=Object.keys(replyLikes).length;
        var replyLiked=!!(visitorId&&replyLikes[visitorId]);
        var replyReplies=reply.replies||{};
        var replyRepliesCount=Object.keys(replyReplies).length;
        adminExtraHtml+=
          '<div class="comment-reply">'+
            '<span class="comment-reply-label">&#x21b3; '+escHtml(reply.authorName)+'\u00a0:</span> '+
            '<span class="comment-reply-text">'+escHtml(reply.text)+'</span>'+
            (isAdmin?'<button class="comment-reply-del" data-action="deleteReply" data-arg="'+ei+'" data-arg2="'+eid+'" title="Supprimer la r\u00e9ponse">&#x1f5d1;</button>':'')+
            '<div class="comment-reply-meta">'+
              (replyLikeCount?'<span class="comment-reply-like-count">❤️ '+replyLikeCount+'</span>':'')+
              (replyRepliesCount?'<span class="comment-reply-thread-count">&#x1f4ac; '+replyRepliesCount+'</span>':'')+
            '</div>'+
            (!isAdmin?
              '<div class="comment-reply-actions">'+
                '<button class="comment-reply-like-btn'+(replyLiked?' comment-reply-like-btn-liked':'')+'" data-action="likeReply" data-arg="'+ei+'" data-arg2="'+eid+'" aria-label="'+(replyLiked?'Retirer le like':'Aimer la réponse')+'">'+
                  (replyLiked?'&#x2764;&#xfe0f; Aimé':'&#x1f90d; Aimer')+
                '</button>'+
                '<button class="comment-reply-toggle" data-action="toggleReplyThreadForm" data-arg="'+ei+'" data-arg2="'+eid+'" aria-label="'+(replyThreadOpen?'Annuler la réponse':'Répondre à la réponse admin')+'">'+
                  (replyThreadOpen?'Annuler':'&#x1f4ac; Répondre')+
                '</button>'+
              '</div>':'')+
            _renderReplyThreadRepliesHtml(i,id,reply)+
            (!isAdmin&&replyThreadOpen?
              '<div class="comment-reply-form comment-reply-thread-form" id="reply-thread-form-'+ei+'-'+eid+'">'+
                '<textarea id="reply-thread-txt-'+ei+'-'+eid+'" class="comment-reply-ta" placeholder="Ta réponse..." maxlength="'+Utils.LIMITS.COMMENT_TEXT+'"></textarea>'+
                '<button class="btn btn-p comment-reply-send" data-action="postReplyThread" data-arg="'+ei+'" data-arg2="'+eid+'">Envoyer &#x1f4e8;</button>'+
              '</div>':'')+
          '</div>';
      }
      if(isAdmin&&replyOpen){
        var prefill=reply?escHtml(reply.text):'';
        adminExtraHtml+=
          '<div class="comment-reply-form" id="reply-form-'+ei+'-'+eid+'">'+
            '<textarea id="reply-txt-'+ei+'-'+eid+'" class="comment-reply-ta" placeholder="Ta r\u00e9ponse..." maxlength="'+Utils.LIMITS.COMMENT_TEXT+'">'+prefill+'</textarea>'+
            '<button class="btn btn-p comment-reply-send" data-action="postReply" data-arg="'+ei+'" data-arg2="'+eid+'">Envoyer &#x1f4e8;</button>'+
          '</div>';
      }
      html+='<div class="comment-card">'+
        '<span class="comment-name">'+escHtml(c.name)+'</span>'+
        '<span class="comment-time">'+formatTime(c.ts)+(c._pending?' ⏳':'')+'</span>'+
        (isAdmin?'<button class="comment-del" data-action="deleteComment" data-arg="'+ei+'" data-arg2="'+eid+'">&#x1f5d1;</button>':'')+
        '<div class="comment-text">'+escHtml(c.text)+'</div>'+
        likeBadgeHtml+
        adminExtraHtml+
        '</div>';
    });
  }
  if(!isAdmin){
    html+='<div class="comment-form comment-form-visitor comment-form-spaced" data-stage-date="'+ei+'">';
    if(visitorName){
      html+='<div class="comment-as">En tant que <strong>'+escHtml(visitorName)+'</strong>'+
        ' <button class="comment-change-name" data-action="showVisitorGate">Changer</button></div>';
    }
    html+='<textarea id="ctxt-'+ei+'" placeholder="Laisse un commentaire..." maxlength="'+Utils.LIMITS.COMMENT_TEXT+'"></textarea>'+
      '<button class="btn btn-p comment-send" data-action="postComment" data-arg="'+ei+'">Envoyer &#x1f4e8;</button>'+
      '</div>';
  }
  html+='</div>';
  return html;
}

function _commentCooldownKey(date){return'ev1-cmt-last-'+date;}
function _getLastCommentTs(date){return parseInt(localStorage.getItem(_commentCooldownKey(date)))||0;}
function _setLastCommentTs(date){localStorage.setItem(_commentCooldownKey(date),String(Date.now()));}

function postComment(i){
  var name=getVisitorName();
  var txtEl=document.getElementById('ctxt-'+i);
  var sendBtn=document.querySelector('#scmts-'+i+' .comment-send');
  var text=txtEl?txtEl.value.trim():'';
  var v=Utils.validateComment({name:name,text:text});
  if(!v.ok){
    if(!name){
      showToast('Identifie-toi pour poster un commentaire.','warn');
      showVisitorGate();
      return;
    }
    if(!text&&txtEl){txtEl.focus();}
    return;
  }
  // Cooldown anti-spam : 30s entre deux commentaires sur la même étape
  var lastSent=_getLastCommentTs(i);
  if(Utils.isCommentOnCooldown(lastSent)){
    var secs=Utils.commentCooldownRemaining(lastSent);
    showToast('Merci ! Attends encore '+secs+' seconde'+(secs>1?'s':'')+' avant de commenter à nouveau.','warn');
    return;
  }
  // Verrou anti-double-clic
  if(sendBtn)sendBtn.disabled=true;
  var id=_makeCommentEntityId('c');
  var data={name:name,text:text,ts:Date.now()};
  // Optimistic UI
  if(!comments[i])comments[i]={};
  comments[i][id]=Object.assign({},data,{_pending:true});
  patchStageComments(i);
  if(txtEl)txtEl.value='';
  _setLastCommentTs(i);
  tryWrite('set','comments/'+i+'/'+id,data).then(function(){
    if(sendBtn)sendBtn.disabled=false;
  }).catch(function(){
    if(sendBtn)sendBtn.disabled=false;
  });
}

function deleteComment(i,id){
  if(!isAdmin)return;
  confirmDialog({
    title:'Supprimer le commentaire',
    message:'Ce commentaire sera définitivement supprimé. Action irréversible.'
  }).then(function(ok){
    if(!ok)return;
    if(comments[i]){delete comments[i][id];patchStageComments(i);}
    tryWrite('remove','comments/'+i+'/'+id);
    // Cleanup associated like and reply
    if(commentLikes[i])delete commentLikes[i][id];
    tryWrite('remove','commentLikes/'+i+'/'+id);
    if(commentReplies[i])delete commentReplies[i][id];
    tryWrite('remove','commentReplies/'+i+'/'+id);
  });
}

function likeComment(date,id){
  if(!isAdmin)return;
  var liked=!!(commentLikes[date]&&commentLikes[date][id]);
  if(liked){
    if(commentLikes[date])delete commentLikes[date][id];
    tryWrite('remove','commentLikes/'+date+'/'+id).catch(function(err){
      console.error('[likeComment] remove failed',err);
    });
  }else{
    if(!commentLikes[date])commentLikes[date]={};
    commentLikes[date][id]=true;
    tryWrite('set','commentLikes/'+date+'/'+id,true).catch(function(err){
      console.error('[likeComment] set failed',err);
    });
  }
  patchStageComments(date);
}

function toggleReplyForm(date,id){
  if(!isAdmin)return;
  var key=_replyKey(date,id);
  _replyOpen[key]=!_replyOpen[key];
  patchStageComments(date);
  // Auto-focus textarea when opening
  if(_replyOpen[key]){
    setTimeout(function(){
      var ta=document.getElementById('reply-txt-'+date+'-'+id);
      if(ta)ta.focus();
    },0);
  }
}

function postReply(date,id){
  if(!isAdmin)return;
  var txtEl=document.getElementById('reply-txt-'+date+'-'+id);
  var text=txtEl?txtEl.value.trim():'';
  if(!text){if(txtEl)txtEl.focus();return;}
  var current=_normalizeCommentReply(commentReplies[date]&&commentReplies[date][id]);
  var data={text:text,ts:Date.now(),authorName:_getCurrentAdminReplyAuthorName()};
  // Préserver les interactions visiteurs existantes quand un admin modifie sa réponse.
  var likesCopy=_copyNonEmptyObject(current,'likes');
  var repliesCopy=_copyNonEmptyObject(current,'replies');
  if(likesCopy)data.likes=likesCopy;
  if(repliesCopy)data.replies=repliesCopy;
  if(!commentReplies[date])commentReplies[date]={};
  commentReplies[date][id]=data;
  delete _replyOpen[_replyKey(date,id)];
  patchStageComments(date);
  tryWrite('set','commentReplies/'+date+'/'+id,data).catch(function(err){
    console.error('[postReply]',err);
  });
}

function deleteReply(date,id){
  if(!isAdmin)return;
  if(commentReplies[date])delete commentReplies[date][id];
  delete _replyOpen[_replyKey(date,id)];
  delete _replyThreadOpen[_replyKey(date,id)];
  patchStageComments(date);
  tryWrite('remove','commentReplies/'+date+'/'+id).catch(function(err){
    console.error('[deleteReply]',err);
  });
}

function likeReply(date,id){
  if(isAdmin)return;
  var name=getVisitorName();
  if(!name){
    showToast('Identifie-toi pour aimer une réponse.','warn');
    showVisitorGate();
    return;
  }
  var reply=_normalizeCommentReply(commentReplies[date]&&commentReplies[date][id]);
  if(!reply)return;
  var target=_ensureLocalCommentReply(date,id);
  var vid=getVisitorId();
  _saveVisitorProfile(vid);
  if(!target.likes||typeof target.likes!=='object')target.likes={};
  if(target.likes[vid]){
    delete target.likes[vid];
    _deleteEmptyChild(target,'likes');
    tryWrite('remove','commentReplies/'+date+'/'+id+'/likes/'+vid).catch(function(err){
      console.error('[likeReply] remove failed',err);
    });
  }else{
    target.likes[vid]=true;
    tryWrite('set','commentReplies/'+date+'/'+id+'/likes/'+vid,true).catch(function(err){
      console.error('[likeReply] set failed',err);
    });
  }
  patchStageComments(date);
}

function toggleReplyThreadForm(date,id){
  if(isAdmin)return;
  var reply=_normalizeCommentReply(commentReplies[date]&&commentReplies[date][id]);
  if(!reply)return;
  var key=_replyKey(date,id);
  _replyThreadOpen[key]=!_replyThreadOpen[key];
  patchStageComments(date);
  if(_replyThreadOpen[key]){
    setTimeout(function(){
      var ta=document.getElementById('reply-thread-txt-'+date+'-'+id);
      if(ta)ta.focus();
    },0);
  }
}

function postReplyThread(date,id){
  if(isAdmin)return;
  var name=getVisitorName();
  var txtEl=document.getElementById('reply-thread-txt-'+date+'-'+id);
  var text=txtEl?txtEl.value.trim():'';
  var validation=Utils.validateComment({name:name,text:text});
  if(!validation.ok){
    if(!name){
      showToast('Identifie-toi pour répondre à l’admin.','warn');
      showVisitorGate();
      return;
    }
    if(!text&&txtEl)txtEl.focus();
    return;
  }
  var reply=_normalizeCommentReply(commentReplies[date]&&commentReplies[date][id]);
  if(!reply)return;
  var lastSent=_getLastReplyTs(date,id);
  if(Utils.isCommentOnCooldown(lastSent)){
    var secs=Utils.commentCooldownRemaining(lastSent);
    showToast('Merci ! Attends encore '+secs+' seconde'+(secs>1?'s':'')+' avant de répondre à nouveau à cette réponse.','warn');
    return;
  }
  var vid=getVisitorId();
  var replyId=_makeCommentEntityId('vr');
  var data={name:name,text:text,ts:Date.now()};
  var target=_ensureLocalCommentReply(date,id);
  _saveVisitorProfile(vid);
  if(!target.replies||typeof target.replies!=='object')target.replies={};
  target.replies[replyId]=data;
  delete _replyThreadOpen[_replyKey(date,id)];
  patchStageComments(date);
  if(txtEl)txtEl.value='';
  _setLastReplyTs(date,id);
  tryWrite('set','commentReplies/'+date+'/'+id+'/replies/'+replyId,data).catch(function(err){
    console.error('[postReplyThread]',err);
  });
}

function deleteReplyThreadItem(date,id,replyId){
  if(!isAdmin)return;
  var stageReplies=commentReplies[date];
  var entry=stageReplies&&stageReplies[id];
  var normalized=_normalizeCommentReply(entry);
  if(!normalized||!normalized.replies||!normalized.replies[replyId])return;
  var target=_ensureLocalCommentReply(date,id);
  if(target.replies)delete target.replies[replyId];
  _deleteEmptyChild(target,'replies');
  patchStageComments(date);
  tryWrite('remove','commentReplies/'+date+'/'+id+'/replies/'+replyId).catch(function(err){
    console.error('[deleteReplyThreadItem]',err);
  });
}

function patchStageComments(i){
  var container=document.getElementById('scmts-'+i);
  if(!container)return;
  var tmp=document.createElement('div');
  tmp.innerHTML=renderStageCommentsHtml(i);
  container.replaceWith(tmp.firstChild);
}
