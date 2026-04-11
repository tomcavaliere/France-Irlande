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
            patchPhotos(i);
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
    patchPhotos(i);
  });
}

function renderPhotosHtml(i){
  var stagePhotos=photos[i]||{};
  var ids=Object.keys(stagePhotos);
  var ei=escAttr(i);
  var html='<div class="j-photos" id="photos-'+ei+'">';
  ids.forEach(function(id){
    var src=stagePhotos[id];
    var eid=escAttr(id);
    html+='<div class="j-photo-wrap">'+
      '<img src="'+escAttr(src)+'" onclick="openLightbox(\''+eid+'\',\''+ei+'\')">'+
      (isAdmin?'<button class="j-photo-del" onclick="deletePhoto(\''+ei+'\',\''+eid+'\')">&#x2715;</button>':'')+
      '</div>';
  });
  if(isAdmin){
    html+='<div class="j-photo-add" id="photos-add-'+ei+'" onclick="uploadPhoto(\''+ei+'\')">'+
      '<span class="j-photo-add-icon">&#x1f4f7;</span><span>Ajouter</span></div>';
  }
  html+='</div>';
  return html;
}
function patchPhotos(i){
  var container=document.getElementById('photos-'+i);
  if(!container)return;
  var tmp=document.createElement('div');
  tmp.innerHTML=renderPhotosHtml(i);
  container.replaceWith(tmp.firstChild);
}
