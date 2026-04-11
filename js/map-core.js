// map-core.js
// Map initialization (Leaflet), route display, position tracking,
// GPS wrapper functions delegating to gps-core.js.

// Fonctions GPS pures déléguées à js/gps-core.js (testé via Vitest).
function snapToRoute(lat,lon){ return GPSCore.snapToRoute(lat,lon,ALL_ROUTE_PTS,CUM_KM); }
function routePointsAhead(fromIdx,distKm){ return GPSCore.routePointsAhead(fromIdx,distKm,ALL_ROUTE_PTS,CUM_KM); }
function ptsBbox(pts,margin){ return GPSCore.ptsBbox(pts,margin); }

// Distance jusqu'à un camping : trace GPX + détour vol d'oiseau
function campingDist(campLat,campLon){
  var pos=getCurrentPos();
  var fromIdx=pos?pos.idx:0;
  return GPSCore.campingDist(fromIdx,campLat,campLon,ALL_ROUTE_PTS,CUM_KM);
}

function campingDistHtml(campLat,campLon){
  var d=campingDist(campLat,campLon);
  return '<div style="margin-top:4px;padding:3px 6px;background:#f5f5f5;border-radius:4px;font-size:11px;color:#333">' +
    '&#x1f6b4; <b>'+d.trace+' km</b> sur la trace' +
    (d.detour>0.2?' + <b>'+d.detour+' km</b> de détour':'') +
    '</div>';
}

function initMap(){
  if(map){map.remove();map=null;completedLayer=null;posMarker=null;campingLayer=null;campspaceLayer=null;waterLayer=null;}
  map=L.map('map',{zoomControl:false,attributionControl:true}).setView([47.5,-1.5],6);
  L.control.zoom({position:'bottomright'}).addTo(map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution:'&copy; OpenStreetMap',maxZoom:18
  }).addTo(map);

  // Deux traces : France (vert) + Irlande (vert)
  L.polyline(FULL_ROUTE_FR,{color:'#999',weight:3,opacity:.4}).addTo(map);
  L.polyline(FULL_ROUTE_FR,{color:'#1a5e1f',weight:3,opacity:.7,dashArray:'6,5'}).addTo(map);
  L.polyline(FULL_ROUTE_IRE,{color:'#999',weight:3,opacity:.4}).addTo(map);
  L.polyline(FULL_ROUTE_IRE,{color:'#1a5e1f',weight:3,opacity:.7,dashArray:'6,5'}).addTo(map);

  // Marqueurs de départ et arrivée
  var mkStart=L.divIcon({className:'',iconSize:[24,24],iconAnchor:[12,12],
    html:'<div class="marker-n st">&#x1f6a9;</div>'});
  var mkEnd=L.divIcon({className:'',iconSize:[24,24],iconAnchor:[12,12],
    html:'<div class="marker-n en">&#x1f3c1;</div>'});
  L.marker(FULL_ROUTE_FR[0],{icon:mkStart}).addTo(map);
  L.marker(FULL_ROUTE_IRE[FULL_ROUTE_IRE.length-1],{icon:mkEnd}).addTo(map);
  // Ferry : marqueur intermédiaire
  var mkFerry=L.divIcon({className:'',iconSize:[24,24],iconAnchor:[12,12],
    html:'<div class="marker-n" style="background:#3498db;font-size:14px">&#x26f4;</div>'});
  L.marker(FULL_ROUTE_FR[FULL_ROUTE_FR.length-1],{icon:mkFerry})
    .bindPopup('<b>Ferry</b><br>Roscoff → Cork').addTo(map);

  // Trace complétée (orange)
  completedLayer=L.polyline([],{color:'#e8772e',weight:5,opacity:.9}).addTo(map);

  // Marqueur position actuelle
  posMarker=L.marker([0,0],{
    icon:L.divIcon({className:'',html:'<div class="marker-pos"></div>',iconSize:[16,16],iconAnchor:[8,8]})
  });

  // Fit sur les deux traces
  var allBounds=L.polyline(FULL_ROUTE_FR.concat(FULL_ROUTE_IRE)).getBounds();
  map.fitBounds(allBounds,{padding:[60,30]});

  updateMap();
}

function updateMap(){
  var pos=getCurrentPos();
  var kmD=pos?pos.kmTotal:0;
  var pct=Math.round((kmD/TOTAL_KM)*100);

  // Trace orange jusqu'à la position
  if(pos){
    var orangePts=[];
    for(var i=0;i<=pos.idx&&i<ALL_ROUTE_PTS.length;i++) orangePts.push(ALL_ROUTE_PTS[i]);
    completedLayer.setLatLngs(orangePts);
    posMarker.setLatLng([pos.lat,pos.lon]);
    if(!map.hasLayer(posMarker))posMarker.addTo(map);
  } else {
    completedLayer.setLatLngs([]);
    if(map.hasLayer(posMarker))map.removeLayer(posMarker);
  }

  // Badge position
  var badge=document.getElementById('posBadge');
  if(pos){
    badge.classList.add('vis');
    var seg=pos.idx<=FRANCE_END_IDX?'France':'Irlande';
    document.getElementById('posT').textContent=seg+' — '+Math.round(kmD)+' km parcourus';
    document.getElementById('posS').textContent=Math.round(TOTAL_KM-kmD)+' km restants ('+pct+'%)';
    document.getElementById('posB').style.width=pct+'%';
  } else {
    badge.classList.remove('vis');
  }

  // Stats header carte
  document.getElementById('mapKmD').textContent=Math.round(kmD);
  document.getElementById('mapKmL').textContent=Math.round(TOTAL_KM-kmD);
  var nbDays=Object.keys(stages).length;
  document.getElementById('mapDays').textContent='J'+nbDays;
}

// Retourne la position actuelle (dernier jour enregistré)
function getCurrentPos(){
  if(!current)return null;
  return snapToRoute(current.lat,current.lon);
}

function calcKmD(){
  var pos=getCurrentPos();
  return pos?pos.kmTotal:0;
}

function updatePositionBadge(){
  var nbDays=Object.keys(stages).length;
  var el=document.getElementById('mapDays');
  if(el)el.textContent='J'+nbDays;
}
