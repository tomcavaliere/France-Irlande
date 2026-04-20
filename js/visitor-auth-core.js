(function(){
  function normalizeHash(v){
    var s=(typeof v==='string')?v.trim().toLowerCase():'';
    return /^[a-f0-9]{64}$/.test(s)?s:'';
  }
  function extractPasswordHash(cfg){
    if(!cfg)return '';
    if(typeof cfg==='string')return normalizeHash(cfg);
    if(typeof cfg==='object')return normalizeHash(cfg.passwordHash);
    return '';
  }
  function validatePasswordChange(password,confirm,opts){
    if(password.length<opts.min)return {ok:false,error:'Mot de passe trop court (min. '+opts.min+' caractères).'};
    if(password.length>opts.max)return {ok:false,error:'Mot de passe trop long (max. '+opts.max+' caractères).'};
    if(password!==confirm)return {ok:false,error:'Les deux mots de passe ne correspondent pas.'};
    return {ok:true};
  }
  var api={normalizeHash:normalizeHash,extractPasswordHash:extractPasswordHash,validatePasswordChange:validatePasswordChange};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.VisitorAuthCore=api;
})();
