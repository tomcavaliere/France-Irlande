// campings.js
// Campings (OpenCampingMap + Overpass fallback), Campspace, water points.
// All POI layers displayed on the Leaflet map.
var _campingsCoreWarned=false;

// Retourne true si le point (lat, lon) est à moins de radiusKm km d'un point du tableau ptSet.
// ptSet : tableau de [lat, lon, ...], sous-échantillonné tous les 3 éléments.
function nearTrace(lat, lon, ptSet, radiusKm){
  if(window.CampingsCore) return window.CampingsCore.nearTrace(lat, lon, ptSet, radiusKm);
  var R2=Math.pow(radiusKm/111,2);
  var cosLat=Math.cos(lat*Math.PI/180);
  for(var i=0;i<ptSet.length;i+=3){
    var dlat=ptSet[i][0]-lat;
    var dlon=(ptSet[i][1]-lon)*cosLat;
    if(dlat*dlat+dlon*dlon<R2)return true;
  }
  return false;
}

// ==== CAMPINGS ====
function toggleCampings(){
  campingsVisible=!campingsVisible;
  var btn=document.getElementById('campToggle');
  btn.classList.toggle('on',campingsVisible);
  if(!campingsVisible){
    if(campingLayer){map.removeLayer(campingLayer);campingLayer=null;}
    return;
  }
  loadCampings();
}

function onCampRangeChange(){
  if(campingsVisible)loadCampings();
  if(campspaceVisible)loadCampspace();
  if(waterVisible)loadWater();
}

function loadCampings(){
  var pos=getCurrentPos();
  var rangeKm=parseInt(document.getElementById('campRange').value)||150;
  var aheadPts=routePointsAhead(pos?pos.idx:0,rangeKm);
  if(!aheadPts.length){console.warn('[Campings] Aucun point ahead');return;}
  var bbox=ptsBbox(aheadPts,0.1);
  var bboxStr=bbox.w.toFixed(4)+','+bbox.s.toFixed(4)+','+bbox.e.toFixed(4)+','+bbox.n.toFixed(4);

  // Requête OpenCampingMap (x-www-form-urlencoded requis)
  Utils.safeFetch('https://opencampingmap.org/getcampsites',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:'bbox='+bboxStr
  },{retries:1,timeout:15000})
    .then(function(r){return r.json();})
    .then(function(geojson){renderCampings(geojson,aheadPts);})
    .catch(function(e){
      console.warn('[Campings] OpenCampingMap failed:',e);
      // Fallback : Overpass API
      loadCampingsOverpass(bbox,aheadPts);
    });
}

function loadCampingsOverpass(bbox,aheadPts){
  var q='[out:json][timeout:20];(node[tourism=camp_site]('+bbox.s+','+bbox.w+','+bbox.n+','+bbox.e+'););out body;';
  var url='https://overpass-api.de/api/interpreter?data='+encodeURIComponent(q);
  Utils.safeFetch(url,{},{retries:2,timeout:20000})
    .then(function(r){return r.json();})
    .then(function(d){
      // Convert to minimal GeoJSON
      var features=d.elements.map(function(el){
        return {type:'Feature',geometry:{type:'Point',coordinates:[el.lon,el.lat]},properties:el.tags||{}};
      });
      renderCampings({type:'FeatureCollection',features:features},aheadPts);
    })
    .catch(function(e){
      console.warn('[Campings] Overpass failed:',e);
      alert('Campings indisponibles (hors-ligne ?)');
    });
}

function renderCampings(geojson,aheadPts){
  if(campingLayer){map.removeLayer(campingLayer);campingLayer=null;}
  if(!geojson.features||!geojson.features.length)return;

  // Filtrer : garder uniquement les campings proches de la trace (max 5km)
  var ptSet=aheadPts;

  var campIcon=L.divIcon({className:'',iconSize:[20,20],iconAnchor:[10,10],
    html:'<div style="background:#2e7d32;color:#fff;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:11px;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,.3)">&#x1f3d5;</div>'});

  var markers=[];
  geojson.features.forEach(function(f){
    if(!window.CampingsCore){
      if(!_campingsCoreWarned){
        _campingsCoreWarned=true;
        console.warn('[Campings] CampingsCore module non chargé');
      }
      return;
    }
    var mapped = window.CampingsCore.mapCampingFeature(f);
    if(!mapped) return;
    if(!nearTrace(mapped.lat,mapped.lon,ptSet,5))return;
    var tags = mapped.tags || [];
    var popup='<div class="camp-popup"><b>'+escHtml(mapped.name)+'</b>'+
      (mapped.operator?'<span style="color:#666;font-size:11px">'+escHtml(mapped.operator)+'</span><br>':'')+
      (tags.length?'<div class="camp-tags">'+tags.map(function(t){return'<span class="camp-tag">'+t+'</span>';}).join('')+'</div>':'')+
      campingDistHtml(mapped.lat,mapped.lon)+
      (mapped.website?'<a href="'+escAttr(mapped.website)+'" target="_blank" style="color:var(--green);font-size:11px">Site web</a>':'')+
      '</div>';
    var m=L.marker([mapped.lat,mapped.lon],{icon:campIcon}).bindPopup(popup);
    markers.push(m);
  });

  campingLayer=L.layerGroup(markers).addTo(map);
  var btn=document.getElementById('campToggle');
  btn.textContent='🏕 '+markers.length+' campings';
}

// ==== CAMPSPACE (chez l'habitant) ====
function toggleCampspace(){
  campspaceVisible=!campspaceVisible;
  var btn=document.getElementById('campspaceToggle');
  btn.classList.toggle('on-cs',campspaceVisible);
  if(!campspaceVisible){
    if(campspaceLayer){map.removeLayer(campspaceLayer);campspaceLayer=null;}
    btn.textContent='🏡 Campspace';
    return;
  }
  loadCampspace();
}

function loadCampspace(){
  if(typeof CAMPSPACE_DATA==='undefined'||!CAMPSPACE_DATA.length)return;
  var pos=getCurrentPos();
  var rangeKm=parseInt(document.getElementById('campRange').value)||150;
  var aheadPts=routePointsAhead(pos?pos.idx:0,rangeKm);
  if(!aheadPts.length)return;

  if(campspaceLayer){map.removeLayer(campspaceLayer);campspaceLayer=null;}

  // Pré-filtre bbox rapide
  var bbox=ptsBbox(aheadPts,0.1);

  var csIcon=L.divIcon({className:'',iconSize:[20,20],iconAnchor:[10,10],
    html:'<div style="background:#e65100;color:#fff;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:11px;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,.3)">&#x1f3e1;</div>'});

  var markers=[];
  // CAMPSPACE_DATA: [lat, lng, title, price, href_suffix]
  for(var i=0;i<CAMPSPACE_DATA.length;i++){
    var d=CAMPSPACE_DATA[i];
    var lat=d[0],lng=d[1];
    // Filtre bbox rapide
    if(lat<bbox.s||lat>bbox.n||lng<bbox.w||lng>bbox.e)continue;
    // Filtre proximité trace
    if(!nearTrace(lat,lng,aheadPts,5))continue;
    var title=d[2]||'Campspace';
    var price=d[3]||'';
    var href=d[4]?'https://campspace.com/fr/s/'+d[4]:'';
    var popup='<div class="camp-popup"><b style="color:#e65100">'+title+'</b>'+
      (price?'<span style="color:#666;font-size:11px">'+price+'</span><br>':'')+
      campingDistHtml(lat,lng)+
      (href?'<a href="'+escAttr(href)+'" target="_blank" style="color:#e65100;font-size:11px">Voir sur Campspace</a>':'')+
      '</div>';
    markers.push(L.marker([lat,lng],{icon:csIcon}).bindPopup(popup));
  }

  campspaceLayer=L.layerGroup(markers).addTo(map);
  var btn=document.getElementById('campspaceToggle');
  btn.textContent='🏡 '+markers.length+' campspace';
}

// ==== POINTS D'EAU (Overpass API) ====
function toggleWater(){
  waterVisible=!waterVisible;
  var btn=document.getElementById('waterToggle');
  btn.classList.toggle('on-water',waterVisible);
  if(!waterVisible){
    if(waterLayer){map.removeLayer(waterLayer);waterLayer=null;}
    btn.textContent='💧 Eau';
    return;
  }
  loadWater();
}

function loadWater(){
  if(waterLoading)return;
  var pos=getCurrentPos();
  var rangeKm=parseInt(document.getElementById('campRange').value)||150;
  var aheadPts=routePointsAhead(pos?pos.idx:0,rangeKm);
  if(!aheadPts.length)return;
  var bbox=ptsBbox(aheadPts,0.02);
  var key=bbox.s.toFixed(1)+','+bbox.w.toFixed(1)+','+bbox.n.toFixed(1)+','+bbox.e.toFixed(1);

  // Cache hit
  if(key===waterCacheKey&&waterCacheData.length){
    renderWater(waterCacheData,aheadPts);
    return;
  }

  var btn=document.getElementById('waterToggle');
  btn.textContent='💧 chargement…';
  waterLoading=true;

  var q='[out:json][timeout:60];(node[amenity=drinking_water]('+bbox.s+','+bbox.w+','+bbox.n+','+bbox.e+');'+
    'node[amenity=water_point]('+bbox.s+','+bbox.w+','+bbox.n+','+bbox.e+');'+
    'node[natural=spring][drinking_water=yes]('+bbox.s+','+bbox.w+','+bbox.n+','+bbox.e+'););out body;';

  var fetchOpts={method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(q)};
  var safeCfg={retries:2,timeout:25000,backoff:1000,onError:function(e,n){
    console.warn('[Water] tentative '+n+' échouée:',e.message);
    btn.textContent='💧 retry…';
  }};
  var servers=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];

  Utils.safeFetch(servers[0],fetchOpts,safeCfg)
    .catch(function(e){
      console.warn('[Water] serveur primaire échoué, essai secondaire:',e.message);
      btn.textContent='💧 retry serveur 2…';
      return Utils.safeFetch(servers[1],fetchOpts,safeCfg);
    })
    .then(function(r){return r.json();})
    .then(function(d){
      waterLoading=false;
      waterCacheKey=key;
      waterCacheData=d.elements||[];
      renderWater(waterCacheData,aheadPts);
    })
    .catch(function(e){
      console.error('[Water] échec total:',e.message);
      waterLoading=false;
      btn.textContent='💧 erreur (réessayer)';
    });
}

function renderWater(elements,aheadPts){
  if(waterLayer){map.removeLayer(waterLayer);waterLayer=null;}
  if(!elements.length)return;

  var waterIcon=L.divIcon({className:'',iconSize:[18,18],iconAnchor:[9,9],
    html:'<div style="background:#1565c0;color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:10px;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,.3)">&#x1f4a7;</div>'});

  var markers=[];
  elements.forEach(function(el){
    if(!el.lat||!el.lon)return;
    if(!nearTrace(el.lat,el.lon,aheadPts,1))return;
    var t=el.tags||{};
    var name=t.name||t.description||'';
    var type=t.natural==='spring'?'Source':t.amenity==='water_point'?'Point d\'eau':'Fontaine';
    var tags=[];
    if(t.drinking_water==='yes'||t.amenity==='drinking_water')tags.push('Potable');
    if(t.bottle==='yes')tags.push('Remplissage');
    if(t.seasonal==='yes')tags.push('Saisonnier');
    if(t.access==='private')tags.push('Privé');
    var dist=campingDistHtml(el.lat,el.lon);
    var popup='<div class="camp-popup"><b style="color:#1565c0">'+escHtml(name||type)+'</b>'+
      (name?'<span style="color:#666;font-size:11px">'+escHtml(type)+'</span><br>':'')+
      (tags.length?'<div class="camp-tags">'+tags.map(function(t){return'<span class="camp-tag" style="background:#e3f2fd;color:#1565c0">'+t+'</span>';}).join('')+'</div>':'')+
      dist+'</div>';
    markers.push(L.marker([el.lat,el.lon],{icon:waterIcon}).bindPopup(popup));
  });

  waterLayer=L.layerGroup(markers).addTo(map);
  var btn=document.getElementById('waterToggle');
  btn.textContent='💧 '+markers.length+' pts d\'eau';
}
