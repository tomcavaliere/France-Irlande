// videos.js
// Video upload and deletion — Firebase Storage (file) + RTDB (URL).

var _videoUploadsInProgress = 0;

window.addEventListener('beforeunload', function(e){
  if(_videoUploadsInProgress > 0){
    e.preventDefault();
    e.returnValue = 'Un upload vidéo est en cours. Quitter la page annulera l\'upload.';
  }
});

function uploadVideo(date){
  if(!isAdmin)return;
  if(!isOnline){
    alert('Upload impossible hors-ligne. Les vidéos ne sont pas mises en cache. Réessaie au retour du réseau.');
    return;
  }
  if(_quotaState.level==='block'){
    alert('Quota Firebase atteint (≥ 90%). Upload bloqué. Supprime d\'anciennes photos avant d\'en ajouter.');
    return;
  }
  var input=document.createElement('input');
  input.type='file';input.accept='video/*';
  input.onchange=function(){
    var file=input.files[0];
    if(!file)return;
    var id='v'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
    var addBtn=document.getElementById('videos-add-'+date);
    var progressSpan=addBtn?addBtn.querySelector('span:last-child'):null;
    if(addBtn)addBtn.classList.add('j-uploading');
    var sRef=window._fbStorageRef(window._fbStorage,'videos/'+date+'/'+id);
    var uploadTask=window._fbUploadResumable(sRef,file);
    _videoUploadsInProgress++;
    uploadTask.on('state_changed',
      function(snapshot){
        var pct=Math.round(snapshot.bytesTransferred/snapshot.totalBytes*100);
        if(progressSpan)progressSpan.textContent=pct+'%';
      },
      function(err){
        _videoUploadsInProgress--;
        console.error('[uploadVideo] upload failed',err);
        if(addBtn)addBtn.classList.remove('j-uploading');
        if(progressSpan)progressSpan.textContent='Vidéo';
      },
      function(){
        var snapRef=uploadTask.snapshot.ref;
        window._fbGetDownloadURL(snapRef)
          .then(function(url){
            return window._fbSet(
              window._fbRef(window._fbDb,'videos/'+date+'/'+id),url
            ).then(function(){return url;});
          })
          .then(function(url){
            _videoUploadsInProgress--;
            if(!videos[date])videos[date]={};
            videos[date][id]=url;
            patchMedia(date);
            if(addBtn)addBtn.classList.remove('j-uploading');
            if(progressSpan)progressSpan.textContent='Vidéo';
          })
          .catch(function(err){
            _videoUploadsInProgress--;
            console.error('[uploadVideo] post-upload failed',err);
            if(addBtn)addBtn.classList.remove('j-uploading');
            if(progressSpan)progressSpan.textContent='Vidéo';
          });
      }
    );
  };
  input.click();
}

function deleteVideo(date,id){
  if(!isAdmin)return;
  confirmDialog({
    title:'Supprimer la vidéo',
    message:'Cette vidéo sera définitivement supprimée. Action irréversible.'
  }).then(function(ok){
    if(!ok)return;
    var sRef=window._fbStorageRef(window._fbStorage,'videos/'+date+'/'+id);
    window._fbDeleteObject(sRef)
      .catch(function(err){console.error('[deleteVideo] storage delete failed',err);});
    window._fbRemove(window._fbRef(window._fbDb,'videos/'+date+'/'+id))
      .catch(function(err){console.error('[deleteVideo] rtdb remove failed',err);});
    if(videos[date])delete videos[date][id];
    patchMedia(date);
  });
}
