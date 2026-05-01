// photos.js
// Photo compression, upload, deletion, and rendering.

var photoUploadInput = null;
var photoUploadPendingDate = '';
var photoUploadStateByDate = {};

function compressImage(file,cb){
  var img=new Image();
  var url=URL.createObjectURL(file);
  img.onload=function(){
    URL.revokeObjectURL(url);
    var MAX=1200;
    var w=img.width,h=img.height;
    if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}
    if(h>MAX){w=Math.round(w*MAX/h);h=MAX;}
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
    // Compression itérative : réduit la qualité jusqu'à passer sous 490 000 chars
    var quality=0.80;
    var b64;
    do{
      b64=canvas.toDataURL('image/jpeg',quality);
      quality=Math.round((quality-0.10)*100)/100;
    }while(b64.length>=490000&&quality>0);
    if(b64.length>=490000){
      alert('Photo trop lourde même après compression maximale. Essaie de la redimensionner avant upload.');
      cb(null);
      return;
    }
    cb(b64);
  };
  img.onerror=function(err){
    URL.revokeObjectURL(url);
    console.error('[compressImage] image load failed',err);
    showToast('Impossible de lire une des photos sélectionnées. Réessaye avec une autre image.','error',5000);
    cb(null);
  };
  img.src=url;
}

function uploadPhoto(i){
  if(!isAdmin)return;
  if(!isOnline){alert('Upload impossible hors-ligne. Les photos ne sont pas mises en cache (taille). Réessaie au retour du réseau.');return;}
  if(_quotaState.level==='block'){
    alert('Quota Firebase atteint (≥ 90%). Upload bloqué. Supprime d\'anciennes photos avant d\'en ajouter.');
    return;
  }
  var input=_ensurePhotoUploadInput();
  photoUploadPendingDate=i;
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
  compressImage(file,function(b64){
    if(!b64){
      state.failures++;
      state.processed++;
      state.running=false;
      _syncPhotoUploadUi(date);
      _processPhotoUploadQueue(date);
      return;
    }
    var id='p'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
    window._fbSet(window._fbRef(window._fbDb,'photos/'+date+'/'+id),b64)
      .then(function(){
        if(!photos[date])photos[date]={};
        photos[date][id]=b64;
        state.processed++;
        patchMedia(date);
      })
      .catch(function(err){
        state.failures++;
        state.processed++;
        console.error('[uploadPhoto] set failed',err);
      })
      .finally(function(){
        state.running=false;
        _syncPhotoUploadUi(date);
        _processPhotoUploadQueue(date);
      });
  });
}

function _syncPhotoUploadUi(date){
  var addBtn=document.getElementById('photos-add-'+date);
  if(!addBtn)return;
  var label=addBtn.querySelector('span:last-child');
  var state=photoUploadStateByDate[date];
  if(state){
    addBtn.classList.add('j-uploading');
    if(label)label.textContent=`Upload ${state.processed}/${state.total}`;
    return;
  }
  addBtn.classList.remove('j-uploading');
  if(label)label.textContent='Photo';
}

function _photoUploadFailureLabel(count){
  return count===1 ? '1 photo non uploadée.' : `${count} photos non uploadées.`;
}

function deletePhoto(i,id){
  if(!isAdmin)return;
  confirmDialog({
    title:'Supprimer la photo',
    message:'Cette photo sera définitivement supprimée. Action irréversible.'
  }).then(function(ok){
    if(!ok)return;
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
    items.push({id:id,type:'photo',src:stagePhotos[id]});
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
