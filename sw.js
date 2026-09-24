const CACHE='stack-moonvit-shell-v40';
const SHELL=['./','./index.html','./styles/app.css?v=40','./src/app.js?v=40','./src/data.js?v=40','./src/store.js?v=40','./src/ui.js?v=40','./manifest.webmanifest?v=40','./assets/planets/sleep.webp?v=40','./assets/planets/focus.webp?v=40','./assets/planets/train.webp?v=40','./assets/planets/balance.webp?v=40','./assets/planets/grow.webp?v=40','./assets/planets/capital.webp?v=40','./icon.svg','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];

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
