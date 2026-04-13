// photos.js
// Photo compression, upload, deletion, and rendering.

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
    canvas.getContext('2d').drawImage(img,0,0,w,h);
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
  img.src=url;
}

function uploadPhoto(i){
  if(!isAdmin)return;
  if(!isOnline){alert('Upload impossible hors-ligne. Les photos ne sont pas mises en cache (taille). Réessaie au retour du réseau.');return;}
  if(_quotaState.level==='block'){
    alert('Quota Firebase atteint (≥ 90%). Upload bloqué. Supprime d\'anciennes photos avant d\'en ajouter.');
    return;
  }
  var input=document.createElement('input');
  input.type='file';input.accept='image/*';input.multiple=true;
  input.onchange=function(){
    var files=Array.from(input.files);
    var addBtn=document.getElementById('photos-add-'+i);
    function uploadNext(idx){
      if(idx>=files.length){
        if(addBtn)addBtn.classList.remove('j-uploading');
        return;
      }
      if(addBtn)addBtn.classList.add('j-uploading');
      compressImage(files[idx],function(b64){
        if(!b64){uploadNext(idx+1);return;}
        var id='p'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
        window._fbSet(window._fbRef(window._fbDb,'photos/'+i+'/'+id),b64)
          .then(function(){
            if(!photos[i])photos[i]={};
            photos[i][id]=b64;
            patchMedia(i);
            refreshQuotaState();
            uploadNext(idx+1);
          })
          .catch(function(err){
            console.error('[uploadPhoto] set failed',err);
            uploadNext(idx+1);
          });
      });
    }
    uploadNext(0);
  };
  input.click();
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
        '<video src="'+escAttr(item.src)+'" preload="metadata" muted playsinline></video>'+
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
}
