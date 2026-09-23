(() => {
'use strict';
const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
const COLORS={up:'#be3438',down:'#285eba',hakuto:'#00a5d9',inaba:'#ddb900',other:'#252525'};
const SERVICE={hakuto:'スーパーはくと',inaba:'スーパーいなば',ordinary:'普通',other:'その他'};
const KEY='chizu-diagram-user-data-v1';
const bundled=window.DIAGRAM_DATA||JSON.parse($('diagram-data').textContent);
let data=bundled, selected='', start=18000, span=10800, stationMap;
function validate(d){
 if(d?.schemaVersion!==1||!Array.isArray(d.stations)||!Array.isArray(d.trains)||d.stations.length<2||d.trains.length<1)throw Error('対応するダイヤJSONではありません。');
 if(d.trains.length>1000||d.stations.length>200)throw Error('データ量が上限を超えています。');
 const ids=new Set(),km=new Map();
 for(const s of d.stations){if(typeof s.id!=='string'||typeof s.name!=='string'||!Number.isFinite(s.km)||s.km<0||km.has(s.id))throw Error('駅名・距離に不正または重複があります。');km.set(s.id,s.km)}
 if(new Set(km.values()).size<2)throw Error('駅距離の範囲がありません。');
 for(const t of d.trains){
  if(typeof t.id!=='string'||ids.has(t.id)||!['up','down'].includes(t.direction)||!Object.keys(SERVICE).includes(t.service)||!Array.isArray(t.points)||t.points.length<2||t.points.length>1000)throw Error('列車ID・種別・方向・点数を確認してください。');
  ids.add(t.id);let prev=-1,prevKm;
  for(const p of t.points){if(!Number.isInteger(p.seconds)||p.seconds<0||p.seconds>172800||p.seconds<prev||!km.has(p.station))throw Error(t.id+' の時刻順または駅が不正です。');const v=km.get(p.station);if(prevKm!==undefined&&(v-prevKm)*(t.direction==='up'?1:-1)>0)throw Error(t.id+' の距離の順序が不正です。');prev=p.seconds;prevKm=v;}
 }
 if(!d.view||!Number.isInteger(d.view.startSeconds)||!Number.isInteger(d.view.endSeconds)||d.view.endSeconds<=d.view.startSeconds||d.view.startSeconds<0||d.view.endSeconds>172800)throw Error('表示範囲が不正です。');
 const points=d.trains.flatMap(t=>t.points);if(points.some(p=>p.seconds<d.view.startSeconds||p.seconds>d.view.endSeconds))throw Error('表示範囲の外に時刻があります。view の範囲を広げてください。');
 return d;
}
function clock(sec,seconds=false){const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return h+':'+String(m).padStart(2,'0')+(seconds?':'+String(s).padStart(2,'0'):'')}
function ink(t){return COLORS[t.service]||COLORS[t.direction]||COLORS.other}
function el(tag,attrs={},text,parent=$('chart')){const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;if(parent)parent.appendChild(e);return e}
function option(value,text){const o=document.createElement('option');o.value=value;o.textContent=text;return o}
function setup(){
 validate(data);stationMap=new Map(data.stations.map(s=>[s.id,s]));selected='';$('details').hidden=true;
 $('start').replaceChildren();for(let s=data.view.startSeconds;s<data.view.endSeconds;s+=3600)$('start').append(option(s,clock(s)));
 $('span').replaceChildren();const total=data.view.endSeconds-data.view.startSeconds;for(const v of [10800,21600])if(v<total)$('span').append(option(v,v/3600+'時間'));$('span').append(option(total,'全日'));
 start=data.view.startSeconds;span=Math.min(10800,total);$('start').value=start;$('span').value=span;
 $('train').replaceChildren(option('','すべて'));for(const t of data.trains)$('train').append(option(t.id,t.id+' '+(t.direction==='up'?'上り':'下り')));
 $('source-info').textContent=`資料：${data.source?.file||'読み込みデータ'} ／ ${data.trains.length}列車・${data.stations.length}駅地点。${data.source?.note||''}`;
 draw();
}
function draw(){
 const svg=$('chart'),box=$('chart-wrap').getBoundingClientRect(),w=Math.max(280,box.width-2),h=Math.max(230,box.height-2),left=w<500?66:88,right=20,top=31,bottom=29,pw=w-left-right,ph=h-top-bottom;
 svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
 const end=Math.min(start+span,data.view.endSeconds),distances=data.stations.map(s=>s.km),lo=Math.min(...distances),hi=Math.max(...distances);
 const x=s=>left+(s-start)/(end-start)*pw,y=k=>top+(k-lo)/(hi-lo)*ph;
 el('title',{},`${data.title} ${clock(start)}–${clock(end)}。上郡側を上、智頭側を下に表示。`);
 const defs=el('defs');const cp=el('clipPath',{id:'plot-clip'},undefined,defs);el('rect',{x:left,y:top-2,width:pw,height:ph+4},undefined,cp);
 const labelHours=Math.max(1,Math.ceil((end-start)/3600*44/pw));
 for(let s=Math.ceil(start/600)*600;s<=end;s+=600){const hourly=s%3600===0;el('line',{x1:x(s),y1:top,x2:x(s),y2:h-bottom,class:hourly?'hour-line':'ten-line'});if((hourly&&(Math.round(s/3600)-Math.ceil(start/3600))%labelHours===0)||((end-start)<=10800&&s%1800===0&&pw>550))el('text',{x:x(s),y:18,'text-anchor':'middle',class:'axis-label'},clock(s));}
 // Keep true distance coordinates. Small station-name collisions are offset only in the label margin.
 let lastLabel=-100;
 for(const s of [...data.stations].sort((a,b)=>a.km-b.km)){
  const sy=y(s.km);el('line',{x1:left,y1:sy,x2:w-right,y2:sy,class:'station-line'});
  const ly=Math.max(sy,lastLabel+12);lastLabel=ly;
  if(ly!==sy)el('line',{x1:left-5,y1:sy,x2:left-15,y2:ly,stroke:'#9caea8','stroke-width':.6});
  el('text',{x:left-8,y:ly+3,'text-anchor':'end',class:'station-label'},s.name);
 }
 el('text',{x:left,y:h-8,class:'axis-label'},clock(start));el('text',{x:w-right,y:h-8,'text-anchor':'end',class:'axis-label'},clock(end));
 const visible=data.trains.filter(t=>$(t.direction).checked&&t.points[0].seconds<=end&&t.points.at(-1).seconds>=start);
 const lines=el('g',{'clip-path':'url(#plot-clip)'}),labels=[],boxes=[];
 for(const t of visible){
  const coords=t.points.map(p=>[x(p.seconds),y(stationMap.get(p.station).km)]),points=coords.map(p=>p.join(',')).join(' '),isSelected=t.id===selected;
  const group=el('g',{'data-train':t.id,opacity:selected&&!isSelected?.19:1},undefined,lines);
  const path=el('polyline',{points,fill:'none',stroke:ink(t),'stroke-width':isSelected?3.3:['hakuto','inaba'].includes(t.service)?2.15:1.25,'stroke-linejoin':'round','stroke-linecap':'round',class:'train-line'},undefined,group);
  el('title',{},`${t.id} ${SERVICE[t.service]} ${clock(t.points[0].seconds)}–${clock(t.points.at(-1).seconds)}`,path);
  const hit=el('polyline',{points,class:'hit-line',tabindex:0,role:'button','aria-label':t.id+' の時刻を表示'},undefined,group);
  hit.addEventListener('click',()=>choose(t.id));hit.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(t.id)}});
  const candidates=[];
  for(let i=0;i<coords.length-1;i++){
   const a=coords[i],b=coords[i+1];if(b[0]<left||a[0]>w-right)continue;
   for(const f of [.2,.5,.8]){const px=a[0]+(b[0]-a[0])*f,py=a[1]+(b[1]-a[1])*f;if(px<left||px>w-right)continue;for(const offset of [-7,14])candidates.push([px+3,py+offset]);}
  }
  if(!candidates.length)candidates.push([Math.min(w-right-40,Math.max(left+3,coords[0][0])),Math.min(h-bottom-4,Math.max(top+12,coords[0][1]))]);
  labels.push({t,candidates});
 }
 for(const {t,candidates} of labels){
  const tw=t.id.length*7+7,th=14;let best,score=Infinity;
  for(const [cx,cy] of candidates){const bx=Math.min(w-right-tw,Math.max(left+2,cx)),by=Math.min(h-bottom-3,Math.max(top+12,cy));const rect=[bx,by-th,tw,th];const overlaps=boxes.reduce((sum,b)=>sum+(rect[0]<b[0]+b[2]+4&&rect[0]+tw+4>b[0]&&rect[1]<b[1]+b[3]+3&&rect[1]+th+3>b[1]?1:0),0);if(overlaps<score){score=overlaps;best=rect}if(!overlaps)break;}
  boxes.push(best);const label=el('text',{x:best[0],y:best[1]+th-2,class:'train-label','data-label':t.id,opacity:selected&&selected!==t.id?.2:1},t.id);label.addEventListener('click',()=>choose(t.id));
 }
 $('summary').textContent=`${clock(start)}–${clock(end)} ／ 表示 ${visible.length}列車 ／ 10分目盛`;
 $('prev').disabled=start<=data.view.startSeconds;$('next').disabled=end>=data.view.endSeconds;
 window.diagramDebug={trainCount:data.trains.length,visibleCount:visible.length,labelCount:labels.length,start,end,colors:COLORS};
}
function choose(id){selected=id;$('train').value=id;const t=data.trains.find(t=>t.id===id);if(!t){$('details').hidden=true;draw();return}
 $(t.direction).checked=true;
 if(t.points.at(-1).seconds<start||t.points[0].seconds>start+span){start=Math.max(data.view.startSeconds,Math.min(data.view.endSeconds-span,Math.floor(t.points[0].seconds/3600)*3600));syncStart()}
 $('details').hidden=false;$('detail-title').textContent=`${t.id}　${SERVICE[t.service]}　${t.direction==='up'?'上り 智頭 → 上郡':'下り 上郡 → 智頭'}`;
 $('detail-note').textContent='元資料の時刻を秒まで表示。発欄だけの地点は停車・通過を断定していません。';$('detail-body').replaceChildren();
 for(const p of t.points){const tr=document.createElement('tr');for(const value of [stationMap.get(p.station).name,stationMap.get(p.station).km.toFixed(2),p.event||'空欄',clock(p.seconds,true),p.sourceCell||'—']){const td=document.createElement('td');td.textContent=value;tr.append(td)}$('detail-body').append(tr)}draw();
}
function syncStart(){if(![...$('start').options].some(o=>Number(o.value)===start))$('start').append(option(start,clock(start)));$('start').value=start;}
function move(delta){start=Math.max(data.view.startSeconds,Math.min(data.view.endSeconds-span,start+delta));syncStart();draw()}
try{const saved=localStorage.getItem(KEY);if(saved)data=validate(JSON.parse(saved))}catch(e){$('import-message').textContent='保存データを読み込めないため同梱データを表示します。'}
setup();
$('start').addEventListener('change',()=>{start=Number($('start').value);start=Math.min(start,data.view.endSeconds-span);syncStart();draw()});
$('span').addEventListener('change',()=>{span=Number($('span').value);move(0)});
$('prev').onclick=()=>move(-span);$('next').onclick=()=>move(span);
$('up').onchange=draw;$('down').onchange=draw;$('train').onchange=()=>choose($('train').value);$('close-detail').onclick=()=>choose('');
$('expand').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.body.requestFullscreen)await document.body.requestFullscreen();else $('expand').textContent='横向きで表示してください'}catch{ $('expand').textContent='全画面は利用できません'}};
$('import-data').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>10000000)throw Error('ファイルが大きすぎます。');const next=validate(JSON.parse(await file.text()));data=next;setup();try{localStorage.setItem(KEY,JSON.stringify(data));$('import-message').textContent='データを読み込み、この端末に保存しました。'}catch{$('import-message').textContent='データを読み込みました。この環境では保存できないため、次回は再度読み込んでください。'}}catch(err){$('import-message').textContent='読み込みできません：'+err.message}e.target.value=''};
$('reset-data').onclick=()=>{try{localStorage.removeItem(KEY)}catch{}data=bundled;setup();$('import-message').textContent='同梱データを表示しています。'};
new ResizeObserver(()=>draw()).observe($('chart-wrap'));
let touchStart; $('chart').addEventListener('touchstart',e=>{if(e.touches.length===1)touchStart=[e.touches[0].clientX,e.touches[0].clientY]},{passive:true});$('chart').addEventListener('touchend',e=>{if(!touchStart)return;const dx=e.changedTouches[0].clientX-touchStart[0],dy=e.changedTouches[0].clientY-touchStart[1];if(Math.abs(dx)>80&&Math.abs(dx)>Math.abs(dy)*2)move(dx<0?span:-span);touchStart=null},{passive:true});
if(location.protocol==='file:')$('offline-status').textContent='単独HTMLとしてオフラインで表示中。';
else if(!window.PWA_BUILD)$('offline-status').textContent='単独HTML版。ファイルを保存すればオフラインで開けます。';
})();
