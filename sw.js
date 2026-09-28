const CACHE='stack-moonvit-shell-v43.2';
const SHELL=['./','./index.html','./styles/app.css?v=43.2','./src/app.js?v=43.2','./src/data.js?v=43.2','./src/store.js?v=43.2','./src/ui.js?v=43.2','./manifest.webmanifest?v=43.2','./assets/planets/sleep.webp?v=43.2','./assets/planets/focus.webp?v=43.2','./assets/planets/train.webp?v=43.2','./assets/planets/balance.webp?v=43.2','./assets/planets/grow.webp?v=43.2','./assets/planets/capital.webp?v=43.2','./icon.svg','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];

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
