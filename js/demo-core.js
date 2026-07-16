// demo-core.js
// Pure helpers for the demo mode in-memory backend: path navigation of a
// JSON tree (Firebase RTDB-like semantics), snapshot factory, demo flag logic.
// No DOM, no I/O — dual export (window.DemoCore + module.exports).
(function(){
  /**
   * Splits a Firebase-style path into segments, ignoring empty ones.
   * @param {string} path e.g. 'photos/2026-05-01/p1'
   * @returns {string[]}
   */
  function _segments(path){
    if(typeof path!=='string')return null;
    return path.split('/').filter(function(s){return s!=='';});
  }

  /**
   * Reads the value at path in tree. Returns undefined when absent.
   * @param {Object} tree
   * @param {string} path
   */
  function pathGet(tree,path){
    var segs=_segments(path);
    if(!segs||!tree||typeof tree!=='object')return undefined;
    var node=tree;
    for(var i=0;i<segs.length;i++){
      if(!node||typeof node!=='object')return undefined;
      node=node[segs[i]];
    }
    return node;
  }

  /**
   * Writes value at path in tree (mutates tree), creating intermediate
   * objects. Firebase semantics: set replaces entirely, set(null) removes.
   * @param {Object} tree
   * @param {string} path
   * @param {*} value
   * @returns {Object} tree
   */
  function pathSet(tree,path,value){
    if(value===null)return pathRemove(tree,path);
    var segs=_segments(path);
    if(!segs||!segs.length||!tree||typeof tree!=='object')return tree;
    var node=tree;
    for(var i=0;i<segs.length-1;i++){
      if(!node[segs[i]]||typeof node[segs[i]]!=='object')node[segs[i]]={};
      node=node[segs[i]];
    }
    node[segs[segs.length-1]]=value;
    return tree;
  }

  /**
   * Removes the value at path (mutates tree) and prunes ancestors left
   * empty — Firebase RTDB never stores empty objects.
   * @param {Object} tree
   * @param {string} path
   * @returns {Object} tree
   */
  function pathRemove(tree,path){
    var segs=_segments(path);
    if(!segs||!segs.length||!tree||typeof tree!=='object')return tree;
    var nodes=[tree];
    var node=tree;
    for(var i=0;i<segs.length-1;i++){
      node=node[segs[i]];
      if(!node||typeof node!=='object')return tree;
      nodes.push(node);
    }
    delete node[segs[segs.length-1]];
    // Prune ancestors that became empty
    for(var j=nodes.length-1;j>0;j--){
      if(Object.keys(nodes[j]).length===0)delete nodes[j-1][segs[j-1]];
      else break;
    }
    return tree;
  }

  /**
   * Builds a Firebase-like snapshot. val() deep-clones so callers can
   * mutate the result without corrupting the source tree.
   * @param {*} value
   * @returns {{val:function():*, exists:function():boolean}}
   */
  function makeSnapshot(value){
    var absent=value===null||value===undefined;
    return {
      val:function(){return absent?null:JSON.parse(JSON.stringify(value));},
      exists:function(){return !absent;}
    };
  }

  /**
   * True when demo mode is requested via URL hash or stored flag.
   * @param {string} hash location.hash
   * @param {string|null} storedFlag localStorage 'ev1-demo' value
   * @returns {boolean}
   */
  function isDemoRequested(hash,storedFlag){
    return hash==='#demo'||storedFlag==='1';
  }

  var api={pathGet:pathGet,pathSet:pathSet,pathRemove:pathRemove,makeSnapshot:makeSnapshot,isDemoRequested:isDemoRequested};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.DemoCore=api;
})();
