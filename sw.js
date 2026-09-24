const CACHE = 'ev1-v43';
// Chemins RELATIFS au scope du SW : le site est servi sous /France-Irlande/
// (GitHub Pages). Un chemin absolu ('/index.html') viserait la racine du
// domaine → 404 → cache.addAll rejette → le SW ne s'installe jamais.
// tests/static/sw-precache.test.js vérifie que cette liste couvre index.html.
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/leaflet.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './js/services/firebase-init.js',
  './js/core/demo-core.js',
  './js/demo/demo-flag.js',
  './js/core/gps-core.js',
  './js/core/utils.js',
  './js/core/offline-core.js',
  './js/core/weather-core.js',
  './js/core/campings-core.js',
  './js/core/events-core.js',
  './js/core/journal-core.js',
  './js/core/stages-core.js',
  './js/core/visitor-auth-core.js',
  './js/core/activity-core.js',
  './js/core/dashboard-core.js',
  './js/core/comments-core.js',
  './js/data/route-data.js',
  './js/app/state.js',
  './js/demo/demo-data.js',
  './js/demo/demo-mode.js',
  './js/services/db.js',
  './js/app/ui.js',
  './js/services/offline.js',
  './js/features/admin.js',
  './js/features/visitor-auth.js',
  './js/features/map.js',
  './js/features/campings.js',
  './js/features/stages.js',
  './js/features/photos.js',
  './js/features/videos.js',
  './js/features/comments.js',
  './js/features/expenses.js',
  './js/features/training.js',
  './js/features/health.js',
  './js/features/activity.js',
  './js/features/weather.js',
  './js/features/journal.js',
  './js/app/init.js'
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
  // Autres ressources (CSS, images, libs) : cache d'abord, réseau en fallback
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
