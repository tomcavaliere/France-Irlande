// warmshowers.js
// WarmShowers hosts POI layer — admin only. Uses pre-fetched WARMSHOWERS_DATA static file.

function toggleWarmshowers() {
  warmshowersVisible = !warmshowersVisible;
  var btn = document.getElementById('wsToggle');
  btn.classList.toggle('on-ws', warmshowersVisible);
  if (!warmshowersVisible) {
    if (warmshowersLayer) { map.removeLayer(warmshowersLayer); warmshowersLayer = null; }
    btn.textContent = '\u{1F3E0} WarmShowers';
    return;
  }
  loadWarmshowers();
}

function loadWarmshowers() {
  if (typeof WARMSHOWERS_DATA === 'undefined' || !WARMSHOWERS_DATA.length) {
    showToast('Donn\u00e9es WarmShowers non charg\u00e9es', 'warn');
    return;
  }
  var pos = getCurrentPos();
  var rangeKm = parseInt(document.getElementById('campRange').value) || 150;
  var aheadPts = routePointsAhead(pos ? pos.idx : 0, rangeKm);
  if (!aheadPts.length) return;
  var accounts = WARMSHOWERS_DATA.map(function(d) {
    return { latitude: d[0], longitude: d[1], fullname: d[2], uid: d[3], currently_available: d[4], maxcyclists: d[5] };
  });
  renderWarmshowers(accounts, aheadPts);
}

function renderWarmshowers(accounts, aheadPts) {
  if (warmshowersLayer) { map.removeLayer(warmshowersLayer); warmshowersLayer = null; }

  var wsIcon = L.divIcon({
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    html: '<div class="poi-icon poi-icon-ws">&#x1f3e0;</div>'
  });

  var markers = [];
  accounts.forEach(function(a) {
    var lat = parseFloat(a.latitude);
    var lon = parseFloat(a.longitude);
    if (!lat || !lon) return;
    if (!window.CampingsCore) return;
    if (!CampingsCore.nearTrace(lat, lon, aheadPts, 10)) return;

    var name = escHtml(a.fullname || a.name || 'H\u00f4te WarmShowers');
    var available = a.currently_available === '1' || a.currently_available === true;
    var badge = available
      ? '<span class="camp-tag camp-tag-ws-ok">Disponible</span>'
      : '<span class="camp-tag camp-tag-ws-off">Indisponible</span>';
    var capacity = a.maxcyclists
      ? '<span class="camp-popup-muted">Max ' + escHtml(String(a.maxcyclists)) + ' cyclistes</span><br>'
      : '';
    var profileUrl = 'https://www.warmshowers.org/users/' + encodeURIComponent(a.uid || a.name || '');
    var dist = campingDistHtml(lat, lon);

    var popup = '<div class="camp-popup">' +
      '<b class="camp-popup-title-ws">' + name + '</b>' +
      '<div class="camp-tags">' + badge + '</div>' +
      capacity +
      dist +
      '<a href="' + escAttr(profileUrl) + '" target="_blank" class="camp-link camp-link-ws">Voir profil</a>' +
      '</div>';

    markers.push(L.marker([lat, lon], { icon: wsIcon }).bindPopup(popup));
  });

  warmshowersLayer = L.layerGroup(markers).addTo(map);
  document.getElementById('wsToggle').textContent = '\u{1F3E0} ' + markers.length + ' h\u00f4tes';
}
