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
  return '<div class="camp-dist">' +
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
  // Ferry Roscoff → Cork : surlignage bleu en vague + bateau au milieu
  var ferryStart=FULL_ROUTE_FR[FULL_ROUTE_FR.length-1];
  var ferryEnd=FULL_ROUTE_IRE[0];
  var ferryWavePts=[];
  // Densité des points de la vague (plus grand = ligne plus lisse).
  var ferryInterpolationSteps=14;
  // Nombre d'ondulations visuelles entre les deux ports.
  var ferryWaveFrequency=8;
  // Amplitude lat/lon de la vague autour de la ligne directe.
  var ferryWaveAmplitude=0.10;
  var ferryDegeneracyThreshold=1e-9;
  var dLat=ferryEnd[0]-ferryStart[0];
  var dLon=ferryEnd[1]-ferryStart[1];
  var norm=Math.sqrt(dLat*dLat+dLon*dLon);
  var ferryMid=[(ferryStart[0]+ferryEnd[0])/2,(ferryStart[1]+ferryEnd[1])/2];
  if(norm<=ferryDegeneracyThreshold){
    console.error('[map] ferry endpoints are identical or too close, using ferryStart as fallback', ferryStart, ferryEnd);
    ferryMid=[ferryStart[0],ferryStart[1]];
  }else{
    var pLat=-dLon/norm;
    var pLon=dLat/norm;
    for(var i=0;i<=ferryInterpolationSteps;i++){
      var t=i/ferryInterpolationSteps;
      var wave=Math.sin(t*Math.PI*ferryWaveFrequency)*ferryWaveAmplitude;
      ferryWavePts.push([
        ferryStart[0]+dLat*t+pLat*wave,
        ferryStart[1]+dLon*t+pLon*wave
      ]);
    }
  }
  if(ferryWavePts.length>1){
    L.polyline(ferryWavePts,{color:'#75c8ff',weight:9,opacity:.35,lineCap:'round'}).addTo(map);
    L.polyline(ferryWavePts,{color:'#1e88ff',weight:4,opacity:.95,dashArray:'10,10',lineCap:'round'}).addTo(map);
  }
  var mkFerry=L.divIcon({className:'',iconSize:[30,30],iconAnchor:[15,15],
    html:'<div class="marker-ferry">&#x26f4;</div>'});
  L.marker(ferryMid,{icon:mkFerry})
    .bindPopup('<b>Traversée ferry</b><br>Roscoff → Cork').addTo(map);

  // Trace complétée (orange)
  completedLayer=L.polyline([],{color:'#e8772e',weight:5,opacity:.9}).addTo(map);

  // Marqueur position actuelle
  posMarker=L.marker([0,0],{
    icon:L.divIcon({className:'',html:'<div class="marker-pos"></div>',iconSize:[16,16],iconAnchor:[8,8]}),
    pane:'markerPane'
  });

  // Pane dédié aux tracés GPX réels (entre overlayPane 400 et markerPane 600)
  if(!map.getPane('tracksPane')){
    map.createPane('tracksPane');
    map.getPane('tracksPane').style.zIndex='450';
  }

  // Fit sur les deux traces
  var allBounds=L.polyline(FULL_ROUTE_FR.concat(FULL_ROUTE_IRE)).getBounds();
  map.fitBounds(allBounds,{padding:[60,30]});

  initChateaux();
  initIrelandSites();
  updateMap();
}

function updateMap(){
  var pos=getCurrentPos();
  var effectiveTracks=getEffectiveTracks();
  var kmD=GPSCore.sumTrackKm(effectiveTracks);
  var kmL=pos?GPSCore.haversineKm(pos.lat,pos.lon,GPSCore.SLIGO_COORDS.lat,GPSCore.SLIGO_COORDS.lon):TOTAL_KM;
  var pct=Math.round((kmD/TOTAL_KM)*100);
  var progressPercentClamped=Math.max(0,Math.min(100,pct));
  var bikeMinPct=2;
  var bikeMaxPct=98;
  // Garde le vélo entièrement visible dans la barre à 0% et 100%.
  var bikeIndicatorPercent=Math.max(bikeMinPct,Math.min(bikeMaxPct,progressPercentClamped));

  // Tracé orange snappé désactivé : on force toujours le layer à vide,
  // même avec une position active, car seuls les GPX réels doivent être visibles.
  completedLayer.setLatLngs([]);
  if(pos){
    posMarker.setLatLng([pos.lat,pos.lon]);
    if(!map.hasLayer(posMarker))posMarker.addTo(map);
  } else {
    if(map.hasLayer(posMarker))map.removeLayer(posMarker);
  }

  // Badge position
  var badge=document.getElementById('posBadge');
  if(pos){
    badge.classList.add('vis');
    var seg=pos.idx<=FRANCE_END_IDX?'France':'Irlande';
    document.getElementById('posT').textContent=seg+' — '+Math.round(kmD)+' km parcourus';
    document.getElementById('posS').textContent='~'+Math.round(kmL)+' km restants (vol d\'oiseau)';
    document.getElementById('posB').style.width=progressPercentClamped+'%';
    var posBike=document.getElementById('posBike');
    if(posBike)posBike.style.left=bikeIndicatorPercent+'%';
  } else {
    badge.classList.remove('vis');
  }

  // Stats header carte
  document.getElementById('mapKmD').textContent=Math.round(kmD);
  document.getElementById('mapKmL').textContent=Math.round(kmL);
  var nbDays=Object.keys(stages).length;
  document.getElementById('mapDays').textContent='J'+nbDays;
}

// Châteaux de la Loire — marqueurs touristiques
function initChateaux(){
  var icon=L.divIcon({className:'',iconSize:[26,26],iconAnchor:[13,13],
    html:'<div class="marker-chateau">&#x1f3f0;</div>'});

  var chateaux=[
    {lat:47.6161,lon:1.5168,name:'Ch\u00e2teau de Chambord'},
    {lat:47.3247,lon:1.0697,name:'Ch\u00e2teau de Chenonceau'},
    {lat:47.5861,lon:1.3312,name:'Ch\u00e2teau de Blois'},
    {lat:47.4792,lon:1.1825,name:'Ch\u00e2teau de Chaumont-sur-Loire'},
    {lat:47.5001,lon:1.4567,name:'Ch\u00e2teau de Cheverny'},
    {lat:47.4098,lon:0.9835,name:'Ch\u00e2teau royal d\u2019Amboise'},
    {lat:47.3423,lon:0.5097,name:'Ch\u00e2teau de Villandry'},
    {lat:47.2608,lon:0.4662,name:'Ch\u00e2teau d\u2019Azay-le-Rideau'},
    {lat:47.1372,lon:0.3014,name:'Ch\u00e2teau du Rivau'},
    {lat:47.1825,lon:-0.0531,name:'Ch\u00e2teau de Br\u00e9z\u00e9'},
  ];

  chateaux.forEach(function(c){
    L.marker([c.lat,c.lon],{icon:icon})
      .bindPopup('<div class="chateau-popup"><b>'+c.name+'</b></div>')
      .addTo(map);
  });
}

// Wild Atlantic Way — sites incontournables Cork → Sligo
function initIrelandSites(){
  var icon=L.divIcon({className:'',iconSize:[26,26],iconAnchor:[13,13],
    html:'<div class="marker-ireland">&#x2618;&#xfe0f;</div>'});

  var sites=[
    {lat:51.706,lon:-8.521, name:'Kinsale',            desc:'Ville colorée, patrimoine maritime'},
    {lat:51.451,lon:-9.826, name:'Mizen Head',          desc:'Pointe la plus au sud d\u2019Irlande, falaises et phare'},
    {lat:51.773,lon:-10.539,name:'Skellig Michael',     desc:'UNESCO — monastère m\u00e9di\u00e9val perch\u00e9, site Star Wars'},
    {lat:52.099,lon:-10.459,name:'Slea Head',           desc:'Falaises, vue sur les Blasket Islands'},
    {lat:52.177,lon:-10.336,name:'Gallarus Oratory',    desc:'Oratoire en pierres s\u00e8ches du VIIIe s., intact'},
    {lat:52.141,lon:-10.268,name:'Dingle',              desc:'Ville vivante, sessions de musique irlandaise'},
    {lat:52.972,lon:-9.427, name:'Cliffs of Moher',     desc:'214 m de falaises sur 8 km'},
    {lat:53.015,lon:-9.062, name:'The Burren',          desc:'Paysage calcaire lunaire unique au monde'},
    {lat:53.022,lon:-9.383, name:'Doolin',              desc:'Village de musique traditionnelle irlandaise'},
    {lat:53.271,lon:-9.057, name:'Galway',              desc:'Capitale culturelle, Latin Quarter'},
    {lat:53.560,lon:-9.888, name:'Kylemore Abbey',      desc:'Abbaye n\u00e9o-gothique au bord d\u2019un lac noir'},
    {lat:53.490,lon:-10.025,name:'Clifden',             desc:'Capitale du Connemara, panoramas sauvages'},
    {lat:53.762,lon:-9.659, name:'Croagh Patrick',      desc:'Montagne sacr\u00e9e de Saint Patrick (764 m)'},
    {lat:53.970,lon:-10.199,name:'Achill Island \u2014 Keem Bay',desc:'Plage turquoise entour\u00e9e de falaises'},
    {lat:54.359,lon:-8.392, name:'Ben Bulben',          desc:'Table mountain de Yeats, silhouette iconique'},
  ];

  sites.forEach(function(s){
    L.marker([s.lat,s.lon],{icon:icon})
      .bindPopup('<div class="ireland-popup"><b>'+s.name+'</b><span>'+s.desc+'</span></div>')
      .addTo(map);
  });
}

// Retourne la position actuelle (dernier jour enregistré).
// lat/lon : coordonnées GPS réelles (pas snappées sur le tracé).
// idx/kmTotal : index et km cumulés snappés, pour le tracé orange et les calculs de progression.
function getCurrentPos(){
  if(!current)return null;
  var snapped=snapToRoute(current.lat,current.lon);
  return {
    idx: snapped.idx,
    kmTotal: snapped.kmTotal,
    lat: current.lat,
    lon: current.lon
  };
}

function updatePositionBadge(){
  var nbDays=Object.keys(stages).length;
  var el=document.getElementById('mapDays');
  if(el)el.textContent='J'+nbDays;
}

// Construit le HTML du popup affiché lors d'un clic sur un tracé GPX.
// Affiche les métadonnées de l'étape + un extrait du journal si disponible,
// ainsi qu'un bouton "Voir le journal" pour les visiteurs et l'admin.
function _buildTrackPopupHtml(date){
  var d=stages[date]||{};
  var dateLabel=JournalCore.formatJournalDateLabel(date);
  var note=d.note?escHtml(d.note):'Étape du jour';
  var kmDay=d.kmDay?'🚴 '+Math.round(d.kmDay)+' km':'';
  var elevGain=(typeof d.elevGain==='number'&&d.elevGain>0)?'⛰️ D+ '+Math.round(d.elevGain)+' m':'';
  var stats=[kmDay,elevGain].filter(Boolean).join(' · ');
  // Pour les visiteurs : n'affiche le bouton que si l'étape est publiée.
  // Si stages n'est pas encore chargé (map tab, avant ouverture du carnet),
  // on traite comme non publié pour respecter la politique d'accès visiteur.
  var pub=stages[date]?!!(d.published):false;
  var canViewJournal=isAdmin||pub;
  var edate=escAttr(date);
  var txt=journals[date]||'';
  var excerpt=(txt&&canViewJournal)
    ?'<div class="track-popup-excerpt">'+escHtml(txt.slice(0,120))+(txt.length>120?'…':'')+'</div>'
    :'';
  var btnHtml=canViewJournal
    ?'<button class="track-popup-btn" data-action="navigateToJournalEntry" data-arg="'+edate+'">📖 Voir le journal</button>'
    :'<div class="track-popup-nopub">Journal pas encore publié</div>';
  return '<div class="track-popup">'+
    '<div class="track-popup-date">'+dateLabel+'</div>'+
    '<div class="track-popup-title">'+note+'</div>'+
    (stats?'<div class="track-popup-stats">'+stats+'</div>':'')+
    excerpt+
    btnHtml+
    '</div>';
}

// Navigue vers l'entrée de journal correspondant à une date.
// Accessible depuis le popup de clic sur trace, pour visiteurs et admin.
function navigateToJournalEntry(date){
  if(map)map.closePopup();
  switchTab('journal');
  // Délai pour laisser le rendu du tab journal se terminer avant le scroll.
  setTimeout(function(){
    var entry=document.querySelector('#journalList .journal-entry[data-date="'+escAttr(date)+'"]');
    if(entry)entry.scrollIntoView({behavior:'smooth',block:'start'});
  },200);
}

// Affiche une L.polyline orange par étape ayant un tracé GPX réel dans /tracks.
// Style : orange plein, épaisseur 3px. Z-order : au-dessus du tracé prévu via
// le pane 'tracksPane' (z-index 450), en dessous du markerPane (z-index 600).
// Visible par tous. Chaque tracé est cliquable et affiche une popup avec les
// infos de l'étape. Le dernier point de chaque tracé reçoit un marqueur fin d'étape.
function renderTrackPolylines(){
  if(!map)return;
  if(tracksLayer){tracksLayer.clearLayers();}
  else{
    tracksLayer=L.layerGroup().addTo(map);
  }
  var effectiveTracks=getEffectiveTracks();
  if(!effectiveTracks)return;
  Object.keys(effectiveTracks).forEach(function(date){
    var t=effectiveTracks[date];
    if(!t||!Array.isArray(t.coords)||!t.coords.length)return;
    var poly=L.polyline(t.coords,{color:'#e8772e',weight:3,opacity:1,pane:'tracksPane'});
    poly.on('click',function(e){
      L.popup({maxWidth:280}).setLatLng(e.latlng).setContent(_buildTrackPopupHtml(date)).openOn(map);
    });
    poly.addTo(tracksLayer);
    // Marqueur fin d'étape au dernier point du tracé GPX
    var lastPt=t.coords[t.coords.length-1];
    var mkStageEnd=L.divIcon({className:'',iconSize:[20,20],iconAnchor:[10,10],
      html:'<div class="marker-stage-end">⛺</div>'});
    L.marker(lastPt,{icon:mkStageEnd,pane:'markerPane'}).addTo(tracksLayer)
      .on('click',function(){
        L.popup({maxWidth:280}).setLatLng(lastPt).setContent(_buildTrackPopupHtml(date)).openOn(map);
      });
  });
}
