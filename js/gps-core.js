// gps-core.js
// Fonctions GPS pures, sans DOM ni état global.
// Chargé en double : <script> dans le navigateur (window.GPSCore)
// et require() dans les tests Vitest (module.exports).

(function(){
  // Snap un point lat/lon au point le plus proche du tracé.
  // routePts: Array<[lat,lon]>, cumKm: Array<number> (longueur identique)
  // Retourne {idx, kmTotal, lat, lon}
  function snapToRoute(lat, lon, routePts, cumKm){
    if(!Array.isArray(routePts) || !routePts.length || !Array.isArray(cumKm) || !cumKm.length){
      return { idx: -1, kmTotal: 0, lat: Number(lat) || 0, lon: Number(lon) || 0 };
    }
    var best = -1, bestD = Infinity;
    for (var i = 0; i < routePts.length; i++){
      var p = routePts[i];
      var d = Math.pow(p[0]-lat, 2) + Math.pow(p[1]-lon, 2);
      if (d < bestD){ bestD = d; best = i; }
    }
    if(best < 0 || !routePts[best]){
      return { idx: -1, kmTotal: 0, lat: Number(lat) || 0, lon: Number(lon) || 0 };
    }
    return { idx: best, kmTotal: cumKm[best], lat: routePts[best][0], lon: routePts[best][1] };
  }

  // Renvoie les points du tracé jusqu'à distKm devant fromIdx.
  function routePointsAhead(fromIdx, distKm, routePts, cumKm){
    if(!Array.isArray(routePts) || !routePts.length || !Array.isArray(cumKm) || !cumKm.length){
      return [];
    }
    fromIdx = Math.max(0, Math.min(routePts.length - 1, Number(fromIdx) || 0));
    distKm = Math.max(0, Number(distKm) || 0);
    var targetKm = cumKm[fromIdx] + distKm;
    var pts = [];
    for (var i = fromIdx; i < routePts.length; i++){
      pts.push(routePts[i]);
      if (cumKm[i] >= targetKm) break;
    }
    return pts;
  }

  // Bbox englobant une liste de points avec marge en degrés.
  function ptsBbox(pts, margin){
    if(!Array.isArray(pts) || !pts.length){
      return { s: 0, n: 0, w: 0, e: 0 };
    }
    margin = Number(margin) || 0;
    var minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    pts.forEach(function(p){
      if (p[0] < minLat) minLat = p[0];
      if (p[0] > maxLat) maxLat = p[0];
      if (p[1] < minLon) minLon = p[1];
      if (p[1] > maxLon) maxLon = p[1];
    });
    return { s: minLat - margin, n: maxLat + margin, w: minLon - margin, e: maxLon + margin };
  }

  // Wrapper de plus haut niveau : à partir d'un point GPS, renvoie tout ce
  // qu'il faut pour afficher l'état d'une étape.
  // country: 'FR' si l'index snappé <= franceEndIdx, sinon 'IE'.
  function computeStageInfo(lat, lon, routePts, cumKm, totalKm, franceEndIdx){
    var snap = snapToRoute(lat, lon, routePts, cumKm);
    totalKm = Number(totalKm) || 0;
    if(snap.idx < 0){
      return {
        idx: -1,
        lat: snap.lat,
        lon: snap.lon,
        kmTotal: 0,
        kmRemaining: Math.max(0, totalKm),
        progressPct: 0,
        country: 'FR'
      };
    }
    var kmRemaining = Math.max(0, totalKm - snap.kmTotal);
    var progressPct = totalKm > 0 ? (snap.kmTotal / totalKm) * 100 : 0;
    return {
      idx: snap.idx,
      lat: snap.lat,
      lon: snap.lon,
      kmTotal: snap.kmTotal,
      kmRemaining: kmRemaining,
      progressPct: progressPct,
      country: snap.idx <= franceEndIdx ? 'FR' : 'IE'
    };
  }

  // Distance jusqu'à un point d'intérêt (camping, point d'eau...) :
  // - traceKm : km à parcourir le long du tracé pour rejoindre le point snappé
  //   le plus proche du POI (0 si le POI est derrière nous)
  // - detourKm : distance à vol d'oiseau entre ce point snappé et le POI
  // fromIdx : index courant du voyageur sur le tracé (0 si inconnu).
  function campingDist(fromIdx, campLat, campLon, routePts, cumKm){
    var snap = snapToRoute(campLat, campLon, routePts, cumKm);
    if(snap.idx < 0 || !Array.isArray(cumKm) || !cumKm.length){
      return { trace: 0, detour: 0 };
    }
    fromIdx = Math.max(0, Math.min(cumKm.length - 1, Number(fromIdx) || 0));
    var traceKm = cumKm[snap.idx] - cumKm[fromIdx];
    if (traceKm < 0) traceKm = 0;
    var cosLat = Math.cos(campLat * Math.PI / 180);
    var dlat = (snap.lat - campLat) * 111.12;
    var dlon = (snap.lon - campLon) * 111.12 * cosLat;
    var detourKm = Math.sqrt(dlat*dlat + dlon*dlon);
    return { trace: Math.round(traceKm), detour: Math.round(detourKm * 10) / 10 };
  }

  var api = {
    snapToRoute: snapToRoute,
    routePointsAhead: routePointsAhead,
    ptsBbox: ptsBbox,
    computeStageInfo: computeStageInfo,
    campingDist: campingDist
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.GPSCore = api;
})();
