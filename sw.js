const CACHE = 'ev1-v9';
const PRECACHE = [
  '/',
  '/index.html',
  '/campspace-data.js',
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
     url.includes('gstatic.com/firebasejs') || url.includes('firebaseio')){
    return;
  }
  // App shell et libs : cache d'abord, réseau en fallback
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
