// campings-core.js
// Fonctions pures utilisées par campings.js.

(function(){
  function nearTrace(lat, lon, ptSet, radiusKm){
    if (!Array.isArray(ptSet) || !ptSet.length) return false;
    var radius = Number(radiusKm) || 0;
    if (radius <= 0) return false;
    var R2=Math.pow(radius/111,2);
    var cosLat=Math.cos(lat*Math.PI/180);
    for(var i=0;i<ptSet.length;i+=3){
      var p = ptSet[i];
      if(!p) continue;
      var dlat=p[0]-lat;
      var dlon=(p[1]-lon)*cosLat;
      if(dlat*dlat+dlon*dlon<R2)return true;
    }
    return false;
  }

  function normalizeWebsite(url){
    if (typeof url !== 'string') return '';
    return /^https?:\/\//i.test(url) ? url : '';
  }

  function campingTags(properties){
    var p = properties || {};
    var tags = [];
    if(p.shower==='yes'||p.showers==='yes')tags.push('🚿');
    if(p.drinking_water==='yes')tags.push('💧');
    if(p.toilets==='yes')tags.push('🚽');
    if(p.power_supply==='yes'||p.electricity==='yes')tags.push('⚡');
    if(p.internet_access==='wlan')tags.push('📶');
    if(p.fee==='no')tags.push('Gratuit');
    return tags;
  }

  function mapCampingFeature(feature){
    if(!feature || !feature.geometry || !Array.isArray(feature.geometry.coordinates)) return null;
    var c = feature.geometry.coordinates;
    if(c.length < 2) return null;
    var p = feature.properties || {};
    return {
      lat: c[1],
      lon: c[0],
      name: p.name || p['name:fr'] || 'Camping sans nom',
      operator: p.operator || '',
      tags: campingTags(p),
      website: normalizeWebsite(p.website || p['contact:website'] || '')
    };
  }

  var api = {
    nearTrace: nearTrace,
    normalizeWebsite: normalizeWebsite,
    campingTags: campingTags,
    mapCampingFeature: mapCampingFeature
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.CampingsCore = api;
})();
