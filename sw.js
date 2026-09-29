const CACHE='stack-moonvit-shell-v44.1';
const SHELL=['./','./index.html','./styles/app.css?v=44.1','./src/app.js?v=44.1','./src/data.js?v=44.1','./src/store.js?v=44.1','./src/ui.js?v=44.1','./manifest.webmanifest?v=44.1','./assets/planets/sleep.webp?v=44.1','./assets/planets/focus.webp?v=44.1','./assets/planets/train.webp?v=44.1','./assets/planets/balance.webp?v=44.1','./assets/planets/grow.webp?v=44.1','./assets/planets/capital.webp?v=44.1','./icon.svg','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./',copy));return response}).catch(()=>caches.match('./')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response})));
});
