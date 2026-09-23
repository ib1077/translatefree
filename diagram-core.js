/* Data rules are independent of the screen shell. */
window.ChizuDiagram=window.ChizuDiagram||{};
(() => {
'use strict';
const COLORS={up:'#be3438',down:'#285eba',hakuto:'#00a5d9',inaba:'#ddb900',other:'#252525'};
const SERVICE={hakuto:'スーパーはくと',inaba:'スーパーいなば',ordinary:'普通',other:'その他'};
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
function clock(sec,seconds=false){sec=Math.round(sec);const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return h+':'+String(m).padStart(2,'0')+(seconds?':'+String(s).padStart(2,'0'):'')}
function ink(t){return COLORS[t.service]||COLORS[t.direction]||COLORS.other}

Object.assign(window.ChizuDiagram,{COLORS,SERVICE,validate,clock,ink});
})();
