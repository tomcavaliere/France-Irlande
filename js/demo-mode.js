// demo-mode.js
// Couche I/O du mode démo : remplace les globales window._fb* (RTDB, Auth,
// Storage) par des stubs alimentés par DEMO_DATA (arbre en mémoire, volatil —
// le rechargement réinitialise la démo). Affiche le bandeau démo.
// La logique pure (navigation d'arbre, snapshots, flag) vit dans demo-core.js.

// Entrée dans la démo — appelée depuis le gate visiteur, donc définie aussi hors démo.
function enterDemoMode(){
  try{localStorage.setItem('ev1-demo','1');}catch(e){console.error('[demo/enter]',e);}
  location.reload();
}

// Sortie de la démo : retire le flag et le hash #demo, puis recharge (gate normal).
function exitDemoMode(){
  try{localStorage.removeItem('ev1-demo');}catch(e){console.error('[demo/exit]',e);}
  if(location.hash==='#demo'){
    try{history.replaceState(null,'',location.pathname+location.search);}
    catch(e){console.error('[demo/exit-hash]',e);}
  }
  location.reload();
}

// Bascule admin sans mot de passe (bouton du bandeau démo).
function demoToggleAdmin(){
  if(!window.DEMO_MODE)return;
  if(isAdmin){logoutAdmin();return;}
  window._fbSignIn(window._fbAuth,'demo@biketrip.app','demo')
    .catch(function(err){console.error('[demo/admin]',err);});
}

(function(){
  if(!window.DEMO_MODE)return;
  var Core=window.DemoCore;
  var _tree=JSON.parse(JSON.stringify(window.DEMO_DATA||{}));
  var _listeners=[];

  /** Clone JSON-safe d'une valeur écrite (les appelants mutent leurs objets après set). */
  function _cloneVal(v){
    return (v===null||v===undefined)?null:JSON.parse(JSON.stringify(v));
  }
  function _snapshotAt(path){
    return Core.makeSnapshot(Core.pathGet(_tree,path));
  }
  // Re-notifie tous les listeners après chaque écriture (données minuscules :
  // couvre la sémantique ancêtre/descendant de Firebase sans complexité).
  function _notifyAll(){
    _listeners.slice().forEach(function(l){
      setTimeout(function(){if(l.active)l.cb(_snapshotAt(l.path));},0);
    });
  }

  // ---- Stub RTDB ----
  window._fbDb={demo:true};
  window._fbRef=function(db,path){return {path:path};};
  window._fbGet=function(ref){return Promise.resolve(_snapshotAt(ref.path));};
  window._fbSet=function(ref,value){
    Core.pathSet(_tree,ref.path,_cloneVal(value));
    _notifyAll();
    return Promise.resolve();
  };
  window._fbRemove=function(ref){
    Core.pathRemove(_tree,ref.path);
    _notifyAll();
    return Promise.resolve();
  };
  window._fbOnValue=function(ref,cb){
    var l={path:ref.path,cb:cb,active:true};
    _listeners.push(l);
    setTimeout(function(){if(l.active)cb(_snapshotAt(l.path));},0);
    return function(){
      l.active=false;
      var i=_listeners.indexOf(l);
      if(i!==-1)_listeners.splice(i,1);
    };
  };

  // ---- Stub Auth ----
  var _authObservers=[];
  function _notifyAuth(){
    _authObservers.slice().forEach(function(cb){
      setTimeout(function(){cb(window._fbAuth.currentUser);},0);
    });
  }
  window._fbAuth={currentUser:null};
  window._fbOnAuth=function(auth,cb){
    _authObservers.push(cb);
    setTimeout(function(){cb(window._fbAuth.currentUser);},0);
    return function(){
      var i=_authObservers.indexOf(cb);
      if(i!==-1)_authObservers.splice(i,1);
    };
  };
  window._fbSignIn=function(auth,email){
    window._fbAuth.currentUser={email:email||'demo@biketrip.app',uid:'demo-admin'};
    _notifyAuth();
    return Promise.resolve({user:window._fbAuth.currentUser});
  };
  window._fbSignOut=function(){
    window._fbAuth.currentUser=null;
    _notifyAuth();
    return Promise.resolve();
  };

  // ---- Stub Storage ----
  // L'upload "réussit" localement : l'URL retournée est un object URL du blob,
  // affichable dans la session (photos et vidéos), perdu au rechargement.
  window._fbStorage={demo:true};
  window._fbStorageRef=function(storage,path){return {path:path};};
  window._fbUploadResumable=function(ref,blob){
    var task={
      _cancelled:false,
      snapshot:{
        ref:{path:ref.path,_blob:blob},
        bytesTransferred:(blob&&blob.size)||0,
        totalBytes:(blob&&blob.size)||0
      },
      on:function(evt,onProgress,onError,onDone){
        setTimeout(function(){
          if(task._cancelled)return;
          try{if(onProgress)onProgress(task.snapshot);}
          catch(e){console.error('[demo/upload-progress]',e);}
          if(onDone)onDone();
        },50);
      },
      cancel:function(){task._cancelled=true;return true;}
    };
    return task;
  };
  window._fbGetDownloadURL=function(ref){
    if(ref&&ref._blob)return Promise.resolve(URL.createObjectURL(ref._blob));
    return Promise.resolve('');
  };
  window._fbDeleteObject=function(){return Promise.resolve();};

  // ---- Bandeau démo ----
  function _updateAdminBtn(){
    var btn=document.getElementById('demoAdminBtn');
    if(btn)btn.textContent=isAdmin?'🚪 Quitter l\'admin':'🔑 Tester le mode admin';
  }
  function _initBanner(){
    document.body.classList.add('demo-mode');
    var banner=document.createElement('div');
    banner.id='demoBanner';
    banner.setAttribute('role','status');
    banner.innerHTML='<span class="demo-banner-label">🎬 Mode démo — données fictives</span>'+
      '<button type="button" class="demo-banner-btn" id="demoAdminBtn" data-action="demoToggleAdmin"></button>'+
      '<button type="button" class="demo-banner-btn demo-banner-exit" data-action="exitDemoMode">✕ Quitter</button>';
    document.body.appendChild(banner);
    _updateAdminBtn();
    if(window.Events)Events.on('admin:toggled',_updateAdminBtn);
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',_initBanner);
  }else{
    _initBanner();
  }
})();
