// comments.js
// Stage comments: rendering, posting, deletion, cooldown.

function renderStageCommentsHtml(i){
  var stageCmts=comments[i]||{};
  var ids=Object.keys(stageCmts).sort(function(a,b){return (stageCmts[a].ts||0)-(stageCmts[b].ts||0);});
  var ei=escAttr(i);
  var html='<div class="stage-comments" id="scmts-'+ei+'">';
  if(ids.length){
    html+='<div class="m-sec-t" style="margin:10px 0 6px">&#x1f4ac; Commentaires</div>';
    ids.forEach(function(id){
      var c=stageCmts[id];
      var eid=escAttr(id);
      html+='<div class="comment-card">'+
        '<span class="comment-name">'+escHtml(c.name)+'</span>'+
        '<span class="comment-time">'+formatTime(c.ts)+(c._pending?' ⏳':'')+'</span>'+
        (isAdmin?'<button class="comment-del" data-action="deleteComment" data-arg="'+ei+'" data-arg2="'+eid+'">&#x1f5d1;</button>':'')+
        '<div class="comment-text">'+escHtml(c.text)+'</div>'+
        '</div>';
    });
  }
  if(!isAdmin){
    var visitorName=getVisitorName();
    html+='<div class="comment-form comment-form-visitor" data-stage-date="'+ei+'" style="margin-top:10px">';
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
    if(!name){showVisitorGate();return;}
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
  });
}

function patchStageComments(i){
  var container=document.getElementById('scmts-'+i);
  if(!container)return;
  var tmp=document.createElement('div');
  tmp.innerHTML=renderStageCommentsHtml(i);
  container.replaceWith(tmp.firstChild);
}
