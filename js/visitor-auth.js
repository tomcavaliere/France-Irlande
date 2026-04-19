// visitor-auth.js
// Visitor authentication gate: shared password + username.
// The shared password is stored as a SHA-256 hash (never in plain text).
//
// To change the visitor password, run this snippet in a browser console:
//   crypto.subtle.digest('SHA-256', new TextEncoder().encode('votre-mot-de-passe'))
//     .then(b => console.log(Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')))
// Then replace VISITOR_PASSWORD_HASH below with the resulting hex string.
//
// Default password: "eurovelo1"
var VISITOR_PASSWORD_HASH = '58e91fb9723f61f82e1de97cf0f6e459d00240a3f07f826e69efc4b7e8a07f8a';

var VISITOR_AUTH_KEY  = 'ev1-visitor-auth';
var VISITOR_NAME_KEY  = 'ev1-visitor-name';

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

function showVisitorGate(){
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
  if(errEl)errEl.style.display='none';
  gate.classList.add('vis');
  setTimeout(function(){
    if(nameEl&&!nameEl.value)nameEl.focus();
    else if(pwEl)pwEl.focus();
  },100);
}

function closeVisitorGate(){
  if(!isVisitorAuthenticated()&&!isAdmin)return;
  var gate=document.getElementById('visitorGate');
  if(gate)gate.classList.remove('vis');
}

function checkVisitorPw(){
  var nameEl=document.getElementById('visitorNameInput');
  var pwEl=document.getElementById('visitorPwInput');
  var errEl=document.getElementById('visitorGateErr');
  var name=nameEl?nameEl.value.trim():'';
  var password=pwEl?pwEl.value:'';

  if(errEl)errEl.style.display='none';

  // Valider le nom en premier
  var nameV=Utils.validateVisitorName(name);
  if(!nameV.ok){
    if(errEl){errEl.textContent=nameV.error;errEl.style.display='block';}
    if(nameEl)nameEl.focus();
    return;
  }

  if(!password){
    if(pwEl)pwEl.focus();
    return;
  }

  _hashPassword(password).then(function(hash){
    if(hash===VISITOR_PASSWORD_HASH){
      _setVisitorSession(name);
      var gate=document.getElementById('visitorGate');
      if(gate)gate.classList.remove('vis');
      showToast('Bienvenue, '+escHtml(name)+' \uD83D\uDEB4','success');
      // Rafraîchir les formulaires de commentaire ouverts
      if(typeof patchStageComments==='function'){
        document.querySelectorAll('.comment-form-visitor').forEach(function(form){
          var dateEl=form.closest('[data-stage-date]');
          if(dateEl)patchStageComments(dateEl.dataset.stageDate);
        });
      }
    }else{
      if(errEl){errEl.textContent='Mot de passe incorrect.';errEl.style.display='block';}
      if(pwEl){pwEl.value='';pwEl.focus();}
    }
  }).catch(function(err){
    console.error('[visitor-auth]',err);
    if(errEl){errEl.textContent='Erreur de vérification.';errEl.style.display='block';}
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
