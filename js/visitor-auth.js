// visitor-auth.js
// Visitor authentication gate: shared password + username.
// Password hash is resolved from Firebase (/visitorAuth/passwordHash).
// Fallback hash keeps backward compatibility if Firebase value is absent.
var VISITOR_DEFAULT_PASSWORD_HASH = '58e91fb9723f61f82e1de97cf0f6e459d00240a3f07f826e69efc4b7e8a07f8a';
var VISITOR_AUTH_CONFIG_PATH = 'visitorAuth';
var MIN_VISITOR_PASSWORD_LENGTH = 6;
var MAX_VISITOR_PASSWORD_LENGTH = 128;

var VISITOR_AUTH_KEY  = 'ev1-visitor-auth';
var VISITOR_NAME_KEY  = 'ev1-visitor-name';
var _visitorPasswordHashCache = VISITOR_DEFAULT_PASSWORD_HASH;
var _visitorPasswordHashLoaded = false;
var _visitorPasswordHashRevision = 0;
var _visitorGateHardLock = false;

function isVisitorAuthenticated(){
  return localStorage.getItem(VISITOR_AUTH_KEY)==='1';
}

function getVisitorName(){
  return localStorage.getItem(VISITOR_NAME_KEY)||'';
}

function _setVisitorSession(name){
  localStorage.setItem(VISITOR_AUTH_KEY,'1');
  localStorage.setItem(VISITOR_NAME_KEY,name);
}

function clearVisitorSession(){
  localStorage.removeItem(VISITOR_AUTH_KEY);
  localStorage.removeItem(VISITOR_NAME_KEY);
}

function _extractVisitorPasswordHash(cfg){
  return VisitorAuthCore.extractPasswordHash(cfg);
}

function _loadVisitorPasswordHash(force){
  if(!force&&_visitorPasswordHashLoaded)return Promise.resolve(_visitorPasswordHashCache);
  if(!window._fbDb||!window._fbGet||!window._fbRef){
    return Promise.resolve(_visitorPasswordHashCache||VISITOR_DEFAULT_PASSWORD_HASH);
  }
  var revision=++_visitorPasswordHashRevision;
  return window._fbGet(
    window._fbRef(window._fbDb,VISITOR_AUTH_CONFIG_PATH)
  )
    .then(function(snap){
      if(revision!==_visitorPasswordHashRevision){
        return _visitorPasswordHashCache||VISITOR_DEFAULT_PASSWORD_HASH;
      }
      var hash=_extractVisitorPasswordHash(snap&&snap.exists()?snap.val():null);
      if(hash)_visitorPasswordHashCache=hash;
      _visitorPasswordHashLoaded=true;
      return _visitorPasswordHashCache||VISITOR_DEFAULT_PASSWORD_HASH;
    })
    .catch(function(err){
      console.error('[visitor-auth/load-hash]',err);
      return _visitorPasswordHashCache||VISITOR_DEFAULT_PASSWORD_HASH;
    });
}

// Calcule le hash SHA-256 d'un mot de passe (retourne une Promise<string>).
function _hashPassword(password){
  var encoder=new TextEncoder();
  var data=encoder.encode(password);
  return crypto.subtle.digest('SHA-256',data).then(function(hash){
    return Array.from(new Uint8Array(hash))
      .map(function(b){return b.toString(16).padStart(2,'0');})
      .join('');
  });
}

function showVisitorGate(opts){
  opts=opts||{};
  _visitorGateHardLock=!!opts.hardLock;
  document.body.classList.toggle('visitor-lock',_visitorGateHardLock);
  var gate=document.getElementById('visitorGate');
  if(!gate)return;
  // Afficher le bouton de fermeture uniquement si déjà authentifié (changement de profil)
  var alreadyAuth=isVisitorAuthenticated()||isAdmin;
  gate.classList.toggle('can-close',!!alreadyAuth);
  // Pré-remplir le nom si déjà connu
  var nameEl=document.getElementById('visitorNameInput');
  if(nameEl&&getVisitorName())nameEl.value=getVisitorName();
  var pwEl=document.getElementById('visitorPwInput');
  if(pwEl)pwEl.value='';
  var errEl=document.getElementById('visitorGateErr');
  if(errEl)errEl.classList.remove('vis');
  gate.classList.add('vis');
  _loadVisitorPasswordHash(false);
  setTimeout(function(){
    if(nameEl&&!nameEl.value)nameEl.focus();
    else if(pwEl)pwEl.focus();
  },100);
}

function closeVisitorGate(){
  if(_visitorGateHardLock&&!isVisitorAuthenticated()&&!isAdmin)return;
  var gate=document.getElementById('visitorGate');
  if(gate)gate.classList.remove('vis');
  _visitorGateHardLock=false;
  document.body.classList.remove('visitor-lock');
}

function checkVisitorPw(){
  var nameEl=document.getElementById('visitorNameInput');
  var pwEl=document.getElementById('visitorPwInput');
  var errEl=document.getElementById('visitorGateErr');
  var name=nameEl?nameEl.value.trim():'';
  var password=pwEl?pwEl.value:'';

  if(errEl)errEl.classList.remove('vis');

  // Valider le nom en premier
  var nameV=Utils.validateVisitorName(name);
  if(!nameV.ok){
    if(errEl){errEl.textContent=nameV.error;errEl.classList.add('vis');}
    if(nameEl)nameEl.focus();
    return;
  }

  if(!password){
    if(pwEl)pwEl.focus();
    return;
  }

  Promise.all([_loadVisitorPasswordHash(true),_hashPassword(password)]).then(function(r){
    var expectedHash=r[0];
    var actualHash=r[1];
    if(actualHash===expectedHash){
      _setVisitorSession(name);
      trackActivityEvent('visitor_login',{
        name:name,
        visitorId:typeof getVisitorId==='function'?getVisitorId():''
      });
      var gate=document.getElementById('visitorGate');
      if(gate)gate.classList.remove('vis');
      _visitorGateHardLock=false;
      document.body.classList.remove('visitor-lock');
      showToast('Bienvenue, '+escHtml(name)+' \uD83D\uDEB4','success');
      // Rafraîchir les formulaires de commentaire ouverts
      if(typeof patchStageComments==='function'){
        document.querySelectorAll('.comment-form-visitor').forEach(function(form){
          var dateEl=form.closest('[data-stage-date]');
          if(dateEl)patchStageComments(dateEl.dataset.stageDate);
        });
      }
    }else{
      if(errEl){errEl.textContent='Mot de passe incorrect.';errEl.classList.add('vis');}
      if(pwEl){pwEl.value='';pwEl.focus();}
    }
  }).catch(function(err){
    console.error('[visitor-auth]',err);
    if(errEl){errEl.textContent='Erreur de vérification.';errEl.classList.add('vis');}
  });
}

function updateVisitorPassword(){
  if(!isAdmin)return;
  var pwEl=document.getElementById('profileVisitorPwNew');
  var confirmEl=document.getElementById('profileVisitorPwConfirm');
  var errEl=document.getElementById('profileVisitorPwErr');
  var saveBtn=document.getElementById('profileVisitorPwSave');
  var password=pwEl?pwEl.value:'';
  var passwordConfirm=confirmEl?confirmEl.value:'';
  if(errEl)errEl.classList.remove('vis');

  var validation=VisitorAuthCore.validatePasswordChange(password,passwordConfirm,{min:MIN_VISITOR_PASSWORD_LENGTH,max:MAX_VISITOR_PASSWORD_LENGTH});
  if(!validation.ok){
    if(errEl){errEl.textContent=validation.error;errEl.classList.add('vis');}
    if(validation.error.indexOf('correspondent pas')!==-1){if(confirmEl)confirmEl.focus();}
    else{if(pwEl)pwEl.focus();}
    return;
  }
  if(!window._fbDb||!window._fbSet||!window._fbRef){
    if(errEl){
      errEl.textContent='Firebase non disponible.';
      errEl.classList.add('vis');
    }
    return;
  }

  if(saveBtn)saveBtn.disabled=true;
  _hashPassword(password).then(function(hash){
    var user=window._fbAuth&&window._fbAuth.currentUser;
    var payload={
      passwordHash:hash,
      updatedAt:Date.now(),
      updatedBy:user&&user.email?user.email:''
    };
    return window._fbSet(window._fbRef(window._fbDb,VISITOR_AUTH_CONFIG_PATH),payload).then(function(){
      _visitorPasswordHashRevision++;
      _visitorPasswordHashCache=hash;
      _visitorPasswordHashLoaded=true;
      if(pwEl)pwEl.value='';
      if(confirmEl)confirmEl.value='';
      showToast('Mot de passe visiteur mis à jour.','success');
    });
  }).catch(function(err){
    console.error('[visitor-auth/update]',err);
    if(errEl){
      errEl.textContent='Impossible de mettre à jour le mot de passe.';
      errEl.classList.add('vis');
    }
  }).finally(function(){
    if(saveBtn)saveBtn.disabled=false;
  });
}

// Raccourcis clavier dans le modal visiteur
function _initVisitorGateKeys(){
  var nameEl=document.getElementById('visitorNameInput');
  var pwEl=document.getElementById('visitorPwInput');
  if(nameEl){
    nameEl.addEventListener('keydown',function(e){
      if(e.key==='Enter'&&pwEl)pwEl.focus();
    });
  }
  if(pwEl){
    pwEl.addEventListener('keydown',function(e){
      if(e.key==='Enter')checkVisitorPw();
    });
  }
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',_initVisitorGateKeys);
}else{
  _initVisitorGateKeys();
}
