// demo-flag.js
// Chargé SANS defer (la CSP interdit les scripts inline) : évalué au parse,
// avant tout script différé — state.js lit window.DEMO_MODE à l'évaluation.
// Nécessite js/demo-core.js chargé juste avant (lui aussi sans defer).
window.DEMO_MODE=(function(){
  var stored=null;
  try{stored=localStorage.getItem('ev1-demo');}catch(e){console.error('[demo-flag]',e);}
  return window.DemoCore.isDemoRequested(location.hash,stored);
})();
