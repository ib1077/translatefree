"""Generate PWA index, data.js, versioned SW, and a self-contained HTML.
Usage: python tools/build.py [--standalone ../chizu-diagram.html]
"""
from pathlib import Path
import json,hashlib,argparse,re
ROOT=Path(__file__).resolve().parent.parent
def build(standalone):
 data=json.loads((ROOT/'diagram-data.json').read_text(encoding='utf-8'))
 packed=json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
 template=(ROOT/'index.template.html').read_text(encoding='utf-8');css=(ROOT/'styles.css').read_text(encoding='utf-8');js=(ROOT/'app.js').read_text(encoding='utf-8')
 single=template.replace('__DATA__',packed).replace('<!-- STYLE -->','<style>'+css+'</style>').replace('<!-- APP -->','<script>'+js+'</script>').replace('<!-- MANIFEST -->','').replace('<!-- REGISTER -->','')
 Path(standalone).write_text(single,encoding='utf-8')
 pwa=re.sub(r'<script id="diagram-data".*?</script>','<script src="data.js"></script>',template,flags=re.S)
 pwa=pwa.replace('<!-- STYLE -->','<link rel="stylesheet" href="styles.css">').replace('<!-- APP -->','<script src="app.js"></script>').replace('<!-- MANIFEST -->','<link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icons/icon-192.png">').replace('<!-- REGISTER -->','<script src="register.js"></script>')
 (ROOT/'index.html').write_text(pwa,encoding='utf-8');(ROOT/'data.js').write_text('window.PWA_BUILD=true;window.DIAGRAM_DATA='+packed+';',encoding='utf-8')
 assets=['./','./index.html','./styles.css','./app.js','./data.js','./register.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png']
 version=hashlib.sha256(b''.join((ROOT/a.removeprefix('./')).read_bytes() for a in assets[1:])).hexdigest()[:16]
 sw="""const PREFIX='chizu-diagram-'+encodeURIComponent(self.registration.scope)+'-';
const CACHE=PREFIX+'__VERSION__';
const ASSETS=__ASSETS__;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;event.respondWith(caches.open(CACHE).then(async cache=>{const hit=await cache.match(event.request,{ignoreSearch:true});if(hit)return hit;if(event.request.mode==='navigate')return cache.match('./index.html');return fetch(event.request)}))});
""".replace('__VERSION__',version).replace('__ASSETS__',json.dumps(assets))
 (ROOT/'sw.js').write_text(sw,encoding='utf-8');print('Built '+version+' / '+str(standalone))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--standalone',default=str(ROOT.parent/'chizu-diagram.html'));args=p.parse_args();build(args.standalone)
