const PREFIX='chizu-diagram-'+encodeURIComponent(self.registration.scope)+'-';
const CACHE=PREFIX+'2c7f4a9c1af30b51';
const ASSETS=["./", "./index.html", "./styles.css", "./ui-config.js", "./diagram-core.js", "./diagram-view.js", "./pan-zoom.js", "./app.js", "./data.js", "./register.js", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;event.respondWith(caches.open(CACHE).then(async cache=>{const hit=await cache.match(event.request,{ignoreSearch:true});if(hit)return hit;if(event.request.mode==='navigate')return cache.match('./index.html');return fetch(event.request)}))});
