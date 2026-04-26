// comments.js
// Stage comments: rendering, posting, deletion, cooldown,
// admin likes and admin replies.

// Tracks which comment reply forms are currently open.
// Key: "date/commentId", value: true
var _replyOpen = {};

function renderStageCommentsHtml(i){
  var stageCmts=comments[i]||{};
  var stageLikes=commentLikes[i]||{};
  var stageReplies=commentReplies[i]||{};
  var ids=Object.keys(stageCmts).sort(function(a,b){return (stageCmts[a].ts||0)-(stageCmts[b].ts||0);});
  var ei=escAttr(i);
  var html='<div class="stage-comments" id="scmts-'+ei+'">';
  if(ids.length){
    html+='<div class="m-sec-t comments-title">&#x1f4ac; Commentaires</div>';
    ids.forEach(function(id){
      var c=stageCmts[id];
      var eid=escAttr(id);
      var liked=!!(stageLikes[id]);
      var reply=stageReplies[id]||null;
      var replyOpen=!!_replyOpen[i+'/'+id];
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
        if(reply){
          adminExtraHtml+=
            '<div class="comment-reply">'+
              '<span class="comment-reply-label">&#x21b3; Tom\u00a0:</span> '+
              '<span class="comment-reply-text">'+escHtml(reply.text)+'</span>'+
              '<button class="comment-reply-del" data-action="deleteReply" data-arg="'+ei+'" data-arg2="'+eid+'" title="Supprimer la r\u00e9ponse">&#x1f5d1;</button>'+
            '</div>';
        }
        if(replyOpen){
          var prefill=reply?escHtml(reply.text):'';
          adminExtraHtml+=
            '<div class="comment-reply-form" id="reply-form-'+ei+'-'+eid+'">'+
              '<textarea id="reply-txt-'+ei+'-'+eid+'" class="comment-reply-ta" placeholder="Ta r\u00e9ponse..." maxlength="'+Utils.LIMITS.COMMENT_TEXT+'">'+prefill+'</textarea>'+
              '<button class="btn btn-p comment-reply-send" data-action="postReply" data-arg="'+ei+'" data-arg2="'+eid+'">Envoyer &#x1f4e8;</button>'+
            '</div>';
        }
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
    var visitorName=getVisitorName();
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
  var id='c'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
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
  var key=date+'/'+id;
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
  var data={text:text,ts:Date.now()};
  if(!commentReplies[date])commentReplies[date]={};
  commentReplies[date][id]=data;
  delete _replyOpen[date+'/'+id];
  patchStageComments(date);
  tryWrite('set','commentReplies/'+date+'/'+id,data).catch(function(err){
    console.error('[postReply]',err);
  });
}

function deleteReply(date,id){
  if(!isAdmin)return;
  if(commentReplies[date])delete commentReplies[date][id];
  delete _replyOpen[date+'/'+id];
  patchStageComments(date);
  tryWrite('remove','commentReplies/'+date+'/'+id).catch(function(err){
    console.error('[deleteReply]',err);
  });
}

function patchStageComments(i){
  var container=document.getElementById('scmts-'+i);
  if(!container)return;
  var tmp=document.createElement('div');
  tmp.innerHTML=renderStageCommentsHtml(i);
  container.replaceWith(tmp.firstChild);
}
