// photos.js
// Photo compression, upload (Firebase Storage), deletion, and rendering.

var photoUploadInput = null;
var photoUploadPendingDate = '';
// { [date]: { queue: File[], processed: number, total: number, failures: number, running: boolean } }
var photoUploadStateByDate = {};
var PHOTO_UPLOAD_MAX_DIMENSION = 960;
var PHOTO_UPLOAD_INITIAL_QUALITY = 0.65;

// Compresse une image (redimensionne + encode JPEG) et appelle cb(blob).
// Appelle cb(null) en cas d'erreur.
function compressImage(file,cb){
  var img=new Image();
  var url=URL.createObjectURL(file);
  img.onload=function(){
    URL.revokeObjectURL(url);
    var w=img.width,h=img.height;
    if(w>PHOTO_UPLOAD_MAX_DIMENSION){h=Math.round(h*PHOTO_UPLOAD_MAX_DIMENSION/w);w=PHOTO_UPLOAD_MAX_DIMENSION;}
    if(h>PHOTO_UPLOAD_MAX_DIMENSION){w=Math.round(w*PHOTO_UPLOAD_MAX_DIMENSION/h);h=PHOTO_UPLOAD_MAX_DIMENSION;}
    var canvas=document.createElement('canvas');
    canvas.width=w;canvas.height=h;
    var ctx=canvas.getContext('2d');
    if(!ctx){
      console.error('[compressImage] canvas context unavailable');
      showToast('Impossible de préparer cette photo pour l\'upload.','error',5000);
      cb(null);
      return;
    }
    ctx.drawImage(img,0,0,w,h);
    canvas.toBlob(function(blob){
      if(!blob){
        console.error('[compressImage] canvas.toBlob failed');
        showToast('Impossible de préparer cette photo pour l\'upload.','error',5000);
        cb(null);
        return;
      }
      cb(blob);
    },'image/jpeg',PHOTO_UPLOAD_INITIAL_QUALITY);
  };
  img.onerror=function(err){
    URL.revokeObjectURL(url);
    console.error('[compressImage] image load failed',err);
    showToast('Impossible de lire une des photos sélectionnées. Réessaye avec une autre image.','error',5000);
    cb(null);
  };
  img.src=url;
}

function uploadPhoto(date){
  if(!isAdmin)return;
  if(!isOnline){alert('Upload impossible hors-ligne. Les photos ne sont pas mises en cache (taille). Réessaie au retour du réseau.');return;}
  if(_quotaState.level==='block'){
    alert('Quota Firebase atteint (≥ 90%). Upload bloqué. Supprime d\'anciennes photos avant d\'en ajouter.');
    return;
  }
  var input=_ensurePhotoUploadInput();
  photoUploadPendingDate=date;
  input.value='';
  input.click();
}

function _ensurePhotoUploadInput(){
  if(photoUploadInput)return photoUploadInput;
  var input=document.createElement('input');
  input.type='file';
  input.accept='image/*';
  input.multiple=true;
  input.hidden=true;
  input.addEventListener('change',function(){
    var date=photoUploadPendingDate;
    var files=Array.from(input.files||[]);
    photoUploadPendingDate='';
    if(!date||!files.length)return;
    _enqueuePhotoUpload(date,files);
  });
  document.body.appendChild(input);
  photoUploadInput=input;
  return input;
}

function _enqueuePhotoUpload(date,files){
  var state=photoUploadStateByDate[date];
  if(!state){
    state={queue:[],processed:0,total:0,failures:0,running:false};
    photoUploadStateByDate[date]=state;
  }
  state.queue=state.queue.concat(files);
  state.total+=files.length;
  _syncPhotoUploadUi(date);
  _processPhotoUploadQueue(date);
}

function _processPhotoUploadQueue(date){
  var state=photoUploadStateByDate[date];
  if(!state||state.running)return;
  var file=state.queue.shift();
  if(!file){
    delete photoUploadStateByDate[date];
    _syncPhotoUploadUi(date);
    refreshQuotaState();
    if(state.failures)showToast(_photoUploadFailureLabel(state.failures),'warn',5000);
    return;
  }
  state.running=true;
  _syncPhotoUploadUi(date);
  compressImage(file,function(blob){
    if(!blob){
      state.failures++;
      state.processed++;
      state.running=false;
      _syncPhotoUploadUi(date);
      _processPhotoUploadQueue(date);
      return;
    }
    var id='p'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
    var storagePath='photos/'+date+'/'+id+'.jpg';
    var sRef=window._fbStorageRef(window._fbStorage,storagePath);
    var uploadTask=window._fbUploadResumable(sRef,blob);
    uploadTask.on('state_changed',
      function(snapshot){
        var pct=Math.round(snapshot.bytesTransferred/snapshot.totalBytes*100);
        var addBtn=document.getElementById('photos-add-'+date);
        var label=addBtn?addBtn.querySelector('span:last-child'):null;
        if(label)label.textContent='Upload '+state.processed+'/'+state.total+' ('+pct+'%)';
      },
      function(err){
        state.failures++;
        state.processed++;
        console.error('[uploadPhoto] storage upload failed',err);
        state.running=false;
        _syncPhotoUploadUi(date);
        _processPhotoUploadQueue(date);
      },
      function(){
        window._fbGetDownloadURL(uploadTask.snapshot.ref)
          .then(function(url){
            var meta={url:url,path:storagePath,ts:Date.now()};
            return window._fbSet(window._fbRef(window._fbDb,'photos/'+date+'/'+id),meta)
              .then(function(){return meta;});
          })
          .then(function(meta){
            if(!photos[date])photos[date]={};
            photos[date][id]=meta;
            state.processed++;
            patchMedia(date);
          })
          .catch(function(err){
            state.failures++;
            state.processed++;
            console.error('[uploadPhoto] post-upload failed',err);
          })
          .then(function(){
            state.running=false;
            _syncPhotoUploadUi(date);
            _processPhotoUploadQueue(date);
          });
      }
    );
  });
}

function _syncPhotoUploadUi(date){
  var addBtn=document.getElementById('photos-add-'+date);
  if(!addBtn)return;
  var label=addBtn.querySelector('span:last-child');
  var state=photoUploadStateByDate[date];
  if(state){
    addBtn.classList.add('j-uploading');
    if(label)label.textContent='Upload '+state.processed+'/'+state.total;
    return;
  }
  addBtn.classList.remove('j-uploading');
  if(label)label.textContent='Photo';
}

function _photoUploadFailureLabel(count){
  return count===1 ? '1 photo non uploadée.' : count+' photos non uploadées.';
}

function deletePhoto(i,id){
  if(!isAdmin)return;
  confirmDialog({
    title:'Supprimer la photo',
    message:'Cette photo sera définitivement supprimée. Action irréversible.'
  }).then(function(ok){
    if(!ok)return;
    var photo=photos[i]&&photos[i][id];
    var storagePath=Utils.getPhotoPath(photo);
    if(storagePath){
      var sRef=window._fbStorageRef(window._fbStorage,storagePath);
      window._fbDeleteObject(sRef)
        .catch(function(err){
          console.error('[deletePhoto] storage delete failed',err);
          showToast('Erreur lors de la suppression du fichier Storage. Le fichier peut rester orphelin.','error',4000);
        });
    }
    window._fbRemove(window._fbRef(window._fbDb,'photos/'+i+'/'+id))
      .then(function(){refreshQuotaState();})
      .catch(function(err){console.error('[deletePhoto] remove failed',err);});
    if(photos[i])delete photos[i][id];
    patchMedia(i);
  });
}

function renderMediaHtml(date){
  var stagePhotos=photos[date]||{};
  var stageVideos=videos[date]||{};
  var ed=escAttr(date);
  var items=[];
  Object.keys(stagePhotos).forEach(function(id){
    var src=Utils.getPhotoUrl(stagePhotos[id]);
    if(src)items.push({id:id,type:'photo',src:src});
  });
  Object.keys(stageVideos).forEach(function(id){
    items.push({id:id,type:'video',src:stageVideos[id]});
  });
  items.sort(function(a,b){return a.id<b.id?-1:a.id>b.id?1:0;});
  var html='<div class="j-photos" id="photos-'+ed+'">';
  items.forEach(function(item){
    var eid=escAttr(item.id);
    if(item.type==='photo'){
      html+='<div class="j-photo-wrap">'+
        '<img src="'+escAttr(item.src)+'" data-action="openLightbox" data-arg="'+eid+'" data-arg2="'+ed+'">'+
        (isAdmin?'<button class="j-photo-del" data-action="deletePhoto" data-arg="'+ed+'" data-arg2="'+eid+'">&#x2715;</button>':'')+
        '</div>';
    }else{
      html+='<div class="j-photo-wrap j-video-wrap">'+
        '<video src="'+escAttr(item.src)+'#t=0.001" preload="metadata" muted playsinline></video>'+
        '<button class="j-video-play" data-action="openLightbox" data-arg="'+eid+'" data-arg2="'+ed+'">&#x25B6;</button>'+
        (isAdmin?'<button class="j-photo-del" data-action="deleteVideo" data-arg="'+ed+'" data-arg2="'+eid+'">&#x2715;</button>':'')+
        '</div>';
    }
  });
  if(isAdmin){
    html+='<div class="j-photo-add" id="photos-add-'+ed+'" data-action="uploadPhoto" data-arg="'+ed+'">'+
      '<span class="j-photo-add-icon">&#x1f4f7;</span><span>Photo</span></div>';
    html+='<div class="j-photo-add" id="videos-add-'+ed+'" data-action="uploadVideo" data-arg="'+ed+'">'+
      '<span class="j-photo-add-icon">&#x1f3a5;</span><span>Vidéo</span></div>';
  }
  html+='</div>';
  return html;
}
function patchMedia(date){
  var container=document.getElementById('photos-'+date);
  if(!container)return;
  var tmp=document.createElement('div');
  tmp.innerHTML=renderMediaHtml(date);
  container.replaceWith(tmp.firstChild);
  _syncPhotoUploadUi(date);
}
