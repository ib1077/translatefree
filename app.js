/* Standalone shell. The mountable viewer and gestures have no dependency on it. */
(() => {
'use strict';
const $=id=>document.getElementById(id),{validate,clock,SERVICE,createViewer,attachGestures}=window.ChizuDiagram;
const config=window.CHIZU_DIAGRAM_CONFIG,KEY='chizu-diagram-user-data-v1',bundled=window.DIAGRAM_DATA||JSON.parse($('diagram-data').textContent);
let data=bundled,active=false,viewer,gestures,printViewers=[];
try{const saved=localStorage.getItem(KEY);if(saved)data=validate(JSON.parse(saved))}catch{$('import-message').textContent='保存データを読み込めないため同梱データを表示します。'}
function option(value,text){const o=document.createElement('option');o.value=value;o.textContent=text;return o}
function edition(){return data.edition||(data===bundled?config.edition:'読込DATA')}
function updateMetadata(){
 $('edition').textContent=edition();document.querySelector('.version').textContent='ver.'+config.version;
 $('source-info').textContent=`${data.source?.file||'読み込みデータ'} ／ ${data.trains.length}列車・${data.stations.length}地点`;
 $('train').replaceChildren(option('','選択なし'));for(const t of data.trains)$('train').append(option(t.id,t.id));
 $('detail-panel').hidden=true;$('up').checked=true;$('down').checked=true;
 $('time-slider').min=0;$('move-start').textContent='0:00';$('move-end').textContent=clock(Math.max(86400,data.view.endSeconds));
}
function viewChanged(view){
 $('time-slider').max=Math.max(0,Math.max(86400,data.view.endSeconds)-view.span);$('time-slider').value=view.start;$('time-slider').disabled=view.span>=Math.max(86400,data.view.endSeconds)-.01;$('zoom-in').disabled=view.span<=21600.01;$('zoom-out').disabled=view.span>=Math.max(86400,data.view.endSeconds)-.01;
 window.diagramDebug={...view,active,rotated:document.body.classList.contains('fallback-landscape')};
 $('app-shell').dispatchEvent(new CustomEvent('chizu:viewportchange',{bubbles:true,detail:{startSeconds:view.start,endSeconds:view.end}}));
}
function closePanels(){for(const id of ['move','train']){$(id+'-panel').hidden=true;$(id+'-open').setAttribute('aria-expanded','false')}}
function showPanel(kind){gestures.stop();const show=$(kind+'-panel').hidden;choose('');closePanels();if(show){$(kind+'-panel').hidden=false;$(kind+'-open').setAttribute('aria-expanded','true')}}
function choose(id){
 const t=data.trains.find(t=>t.id===id);gestures.stop();viewer.select(id);$('train').value=t?id:'';$('detail-panel').hidden=!t;
 if(t){
  $(t.direction).checked=true;closePanels();
  $('detail-title').textContent=`${t.id} ${SERVICE[t.service]}・${t.direction==='up'?'上り':'下り'}`;
  const stationName=id=>id==='岩木'?'（岩木信号所）':(data.stations.find(s=>s.id===id)?.name||id);
  $('detail-body').replaceChildren();
  const rows=[];for(const p of t.points){let row=rows.at(-1);if(!row||row.station!==p.station){row={station:p.station,arrival:[],departure:[],unknown:[]};rows.push(row)}row[p.event==='着'?'arrival':p.event==='発'?'departure':'unknown'].push(p)}
  function stamp(p,parent){const e=document.createElement('span');e.className='event-time';e.dataset.seconds=p.seconds;e.dataset.event=p.event;e.dataset.source=p.sourceCell||'';e.textContent=clock(p.seconds,true);e.title=p.sourceCell?'元セル '+p.sourceCell:'';parent.append(e)}
  for(const row of rows){
   const tr=document.createElement('tr');if(['上郡','佐用','大原','智頭'].includes(row.station))tr.className='major-station';
   const name=document.createElement('th');name.scope='row';name.textContent=stationName(row.station);tr.append(name);
   for(const kind of ['arrival','departure']){const td=document.createElement('td');if(!row[kind].length)td.textContent='—';for(const p of row[kind])stamp(p,td);tr.append(td)}$('detail-body').append(tr);
   for(const p of row.unknown){const extra=document.createElement('tr'),td=document.createElement('td');td.colSpan=3;td.className='unknown-event';td.append(stationName(row.station)+' ');stamp(p,td);td.append('（着発区分空欄）');extra.append(td);$('detail-body').append(extra)}
  }
  $('detail-scroll').scrollTop=0;
 }
 $('app-shell').dispatchEvent(new CustomEvent('chizu:trainselect',{bubbles:true,detail:t?{trainId:t.id,direction:t.direction}:null}));
}
function orient(){
 const portrait=innerHeight>innerWidth,phone=matchMedia('(pointer:coarse)').matches||innerWidth<600;
 document.body.classList.toggle('fallback-landscape',active&&portrait&&phone);gestures?.reset();viewer?.schedule();
}
function enter(){active=true;$('launch-screen').hidden=true;$('app-shell').hidden=false;document.body.classList.remove('launch-waiting');orient();viewer.draw();$('chart').focus({preventScroll:true})}
function home(){choose('');active=false;gestures.reset();closePanels();$('app-shell').hidden=true;$('launch-screen').hidden=false;document.body.classList.add('launch-waiting');orient();$('launch').focus({preventScroll:true})}
function changeData(next){validate(next);gestures.reset();data=next;viewer.setData(data);updateMetadata();clearPrint();}
function clearPrint(){for(const v of printViewers)v.destroy();printViewers=[];}
function printSettings(report=true){
 const parse=id=>{const raw=$(id).value.trim(),m=/^(\d{1,2}):([0-5]\d)$/.exec(raw),v=m?Number(m[1])*3600+Number(m[2])*60:NaN;return v>=0&&v<=86400?v:NaN};
 for(const id of ['print-start','print-end','print-split'])$(id).setCustomValidity('');
 const mode=$('print-mode').value,start=parse('print-start'),end=parse('print-end'),split=parse('print-split');
 let invalid='',message='';
 if(!Number.isFinite(start)){invalid='print-start';message='0:00〜24:00の時刻を入力してください。'}
 else if(!Number.isFinite(end)||end<=start){invalid='print-end';message='開始より後、24:00までの時刻を入力してください。'}
 else if(mode==='split'&&(!Number.isFinite(split)||split<=start||split>=end)){invalid='print-split';message='開始と終了の間の時刻を入力してください。'}
 if(invalid){$(invalid).setCustomValidity(message);if(report)$(invalid).reportValidity();return null}
 return {mode,start,end,split};
}
let lastPrintSettings={mode:'repeat',start:18000,end:82800,split:50400};
function preparePrint(settings=lastPrintSettings){
 lastPrintSettings=settings;clearPrint();const {mode,start,end,split}=settings;
 const ranges=mode==='single'?[[start,end]]:mode==='split'?[[start,split],[split,end]]:[[start,end],[start,end]];
 $('print-sheet').classList.toggle('single',mode==='single');$('print-chart-2').closest('.print-diagram').hidden=mode==='single';
 $('print-summary').textContent='A4横・'+({repeat:'同じ範囲を上下2枚',split:'時間帯を上下に分割',single:'指定範囲を1枚'})[mode];
 for(let i=0;i<ranges.length;i++){
  const [a,b]=ranges[i],svg=$('print-chart-'+(i+1));svg.setAttribute('aria-label','印刷用ダイヤ '+clock(a)+'–'+clock(b));
  const v=createViewer({svg,data,width:1200,height:mode==='single'?820:400,printMode:true});v.setRange(a,b-a);v.draw();printViewers.push(v);
 }
}
updateMetadata();viewer=createViewer({svg:$('chart'),data,onSelect:choose,onViewChange:viewChanged});
gestures=attachGestures({surface:$('chart-wrap'),viewer,onTap:p=>{const id=viewer.pick(p),selected=viewer.getState().selected;choose(selected&&id!==selected?'':id)}});
$('launch').onclick=enter;$('home').onclick=home;
$('fit').onclick=()=>{choose('');gestures.stop();viewer.fit();closePanels()};
$('move-open').onclick=()=>showPanel('move');$('train-open').onclick=()=>showPanel('train');
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>{$(b.dataset.close).hidden=true;$(b.dataset.close.replace('-panel','-open')).setAttribute('aria-expanded','false')};
for(const b of document.querySelectorAll('[data-span]'))b.onclick=()=>{gestures.stop();const s=viewer.getState();if(b.dataset.span==='standard'){viewer.setRange(18000,64800);return}const span=b.dataset.span==='all'?s.max-s.min:Math.min(Number(b.dataset.span),s.max-s.min);viewer.setRange(s.start+s.span/2-span/2,span)};
$('zoom-in').onclick=()=>{gestures.stop();viewer.zoom(1.5)};$('zoom-out').onclick=()=>{gestures.stop();viewer.zoom(1/1.5)};
$('time-slider').oninput=()=>{gestures.stop();viewer.setRange(Number($('time-slider').value))};
$('up').onchange=$('down').onchange=()=>viewer.setFilters({up:$('up').checked,down:$('down').checked});
$('train').onchange=()=>choose($('train').value);$('clear-train').onclick=()=>choose('');
$('menu-open').onclick=()=>{$('settings').showModal()};$('menu-close').onclick=()=>{$('settings').close();$('menu-open').focus()};
$('import-data').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>10000000)throw Error('ファイルが大きすぎます。');const next=validate(JSON.parse(await f.text()));changeData(next);try{localStorage.setItem(KEY,JSON.stringify(data));$('import-message').textContent='データを読み込み、この端末に保存しました。'}catch{$('import-message').textContent='読み込みました。この環境では保存できないため、次回は再度開いてください。'}}catch(err){$('import-message').textContent='読み込みできません：'+err.message}e.target.value=''};
$('reset-data').onclick=()=>{try{localStorage.removeItem(KEY)}catch{}changeData(bundled);$('import-message').textContent='同梱データへ戻しました。'};
$('export-data').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='diagram-data.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('print-mode').onchange=()=>{$('print-split-field').hidden=$('print-mode').value!=='split'};
$('print-current').onclick=()=>{const s=viewer.getState();$('print-start').value=clock(s.start);$('print-end').value=clock(s.end);$('print-split').value=clock((s.start+s.end)/2)};
$('print-preview').onclick=()=>{const settings=printSettings();if(!settings)return;$('settings').close();$('print-preview-screen').hidden=false;preparePrint(settings);$('print-back').focus()};
$('print-edit').onclick=()=>{$('print-preview-screen').hidden=true;$('settings').showModal()};
$('print-back').onclick=()=>{$('print-preview-screen').hidden=true;home();$('menu-open').focus()};
$('print-now').onclick=()=>{preparePrint();window.print()};
window.addEventListener('beforeprint',()=>preparePrint(printSettings(false)||lastPrintSettings));
window.addEventListener('resize',orient);window.addEventListener('blur',()=>gestures.reset());
document.addEventListener('visibilitychange',()=>{if(document.hidden)gestures.reset()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active){choose('');closePanels();gestures.stop()}});
document.addEventListener('pointerdown',e=>{if(!$('chart-wrap').contains(e.target))gestures.stop()},{capture:true});
document.addEventListener('click',e=>{const path=e.composedPath();if(path.includes($('chart-wrap'))||path.includes($('detail-panel'))||path.includes($('train-panel')))return;if(active&&viewer.getState().selected)choose('');},{capture:true});
if(location.protocol==='file:')$('offline-status').textContent='単独HTMLとして通信なしで利用できます。';
else if(!window.PWA_BUILD)$('offline-status').textContent='単独HTML版です。ファイルを保存すれば通信なしで開けます。';
})();
