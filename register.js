if('serviceWorker' in navigator&&window.isSecureContext&&location.protocol!=='file:'){
 navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(async registration=>{
  await navigator.serviceWorker.ready;
  document.getElementById('offline-status').textContent='オフライン用の保存が完了しました。';
  registration.update().catch(()=>{});
 }).catch(()=>{document.getElementById('offline-status').textContent='オフライン保存を開始できませんでした。接続またはブラウザー設定を確認してください。'});
 let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reloading){reloading=true;location.reload()}});
}else document.getElementById('offline-status').textContent='PWAの保存にはHTTPSまたはこのPCのlocalhostで開いてください。';
