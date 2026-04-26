const CACHE = 'ev1-v32';
const PRECACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/campspace-data.js',
  '/js/gps-core.js',
  '/js/utils.js',
  '/js/offline-core.js',
  '/js/weather-core.js',
  '/js/campings-core.js',
  '/js/route-data.js',
  '/js/state.js',
  '/js/events-core.js',
  '/js/ui.js',
  '/js/offline.js',
  '/js/admin.js',
  '/js/visitor-auth.js',
  '/js/map-core.js',
  '/js/campings.js',
  '/js/stages.js',
  '/js/photos.js',
  '/js/videos.js',
  '/js/comments.js',
  '/js/expenses.js',
  '/js/training.js',
  '/js/health.js',
  '/js/weather.js',
  '/js/journal.js',
  '/js/init.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(PRECACHE); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e){
  // Ne pas cacher les POST (Cache API ne supporte pas) ni les APIs externes
  if(e.request.method !== 'GET') return;
  var url = e.request.url;
  if(url.includes('firebasedatabase') || url.includes('googleapis') ||
     url.includes('gstatic.com/firebasejs') || url.includes('firebaseio') ||
     url.includes('open-meteo.com') || url.includes('overpass') ||
     url.includes('opencampingmap')){
    return;
  }
  // HTML/JS de l'app : network-first (pour récupérer les MAJ), cache en fallback offline
  var isAppShell = url.endsWith('/') || url.endsWith('/index.html') ||
                   url.endsWith('.js') || url.endsWith('.html');
  if(isAppShell && new URL(url).origin === self.location.origin){
    e.respondWith(
      fetch(e.request).then(function(resp){
        if(resp && resp.status === 200){
          var clone = resp.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
        }
        return resp;
      }).catch(function(){ return caches.match(e.request); })
    );
    return;
  }
  // Libs externes : cache d'abord, réseau en fallback
  e.respondWith(
    caches.match(e.request).then(function(cached){
      if(cached) return cached;
      return fetch(e.request).then(function(resp){
        if(!resp || resp.status !== 200 || resp.type === 'opaque') return resp;
        var clone = resp.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
        return resp;
      });
    })
  );
});
