/* Planned timetable miniature. No live train location is used. */
(() => {
'use strict';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
let data,seconds=18000,playing=false,last=0,frame=0,deer=null,nextDeer=0,deerEnabled=true,split=false;
const el=(parent,tag,attrs,text)=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;parent.append(n);return n};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const label=s=>String(Math.floor(s/3600)).padStart(2,'0')+':'+String(Math.floor(s%3600/60)).padStart(2,'0');
function position(t,map){const p=t.points;if(seconds<p[0].seconds||seconds>p.at(-1).seconds)return null;
 for(let i=0;i<p.length-1;i++){let a=p[i],b=p[i+1];if(seconds<a.seconds||seconds>b.seconds)continue;
  const ak=map.get(a.station),bk=map.get(b.station);if(ak===undefined||bk===undefined)return null;
  if(ak===bk||b.seconds===a.seconds)return ak;
  return ak+(bk-ak)*(seconds-a.seconds)/(b.seconds-a.seconds);
 }return map.get(p.at(-1).station)??null}
function draw(){if(!split)return;const svg=$('point-track');svg.replaceChildren();if(!data)return;
 const stations=[...data.stations].sort((a,b)=>a.km-b.km),lo=stations[0].km,hi=stations.at(-1).km,px=k=>38+(k-lo)/(hi-lo)*924;
 const hour=seconds/3600,day=Math.max(0,Math.sin(Math.PI*(hour-6)/12));
 $('point-pane').style.background=`linear-gradient(rgb(${Math.round(18+49*day)},${Math.round(32+76*day)},${Math.round(54+95*day)}),rgb(${Math.round(26+70*day)},${Math.round(42+90*day)},${Math.round(65+100*day)}))`;
 $('point-clock').textContent=label(seconds);
 el(svg,'path',{d:'M38 75H962',stroke:'#9cb9c8','stroke-width':5,opacity:.72});
 // Alternating label rows keep close stations legible.
 let last=[-100,-100];stations.forEach((s,i)=>{const x=px(s.km),major=['上郡','佐用','大原','智頭'].includes(s.name);el(svg,'circle',{cx:x,cy:75,r:major?4:2.4,fill:'#e4edf1'});
  let row=last[0]<last[1]?0:1,lx=clamp(x,46,952);if(lx-last[row]<55)row=1-row;lx=Math.max(lx,last[row]+53);lx=clamp(lx,46,952);last[row]=lx;const ly=row?153:118;
  el(svg,'path',{d:`M${x} 80L${lx} ${ly-12}`,stroke:'#a1b6c2','stroke-width':.7});el(svg,'text',{x:lx,y:ly,'text-anchor':i===0?'start':i===stations.length-1?'end':'middle',fill:major?'#fff1b9':'#dce7ef','font-size':major?13:11},s.name)});
 if(hour>=6&&hour<18){const phase=(hour-6)/12;el(svg,'circle',{cx:38+phase*924,cy:156-25*Math.sin(phase*Math.PI),r:7,fill:'#ffdda2',opacity:.65})}
 const map=new Map(data.stations.map(s=>[s.id,s.km]));for(const t of data.trains){const km=position(t,map);if(km===null)continue;
  const x=px(km),y=t.direction==='down'?62:89,c=t.service==='hakuto'?'#72c9ee':t.service==='inaba'?'#f6d359':'#e1e5e8',g=el(svg,'g',{transform:`translate(${x} ${y})`});
  el(g,'path',{d:t.direction==='down'?'M-8-5H5L9-1V5H-8Z':'M8-5H-5L-9-1V5H8Z',fill:c,stroke:'#172c3b','stroke-width':1.3});
  for(const wx of [-3.5,2])el(g,'rect',{x:wx,y:-3,width:3.2,height:2.6,rx:.5,fill:hour>=18?'#f5dea2':'#7694a7'});
  if(t.service!=='ordinary')el(svg,'text',{x,y:y+(t.direction==='down'?-12:19),'text-anchor':'middle',fill:c,'font-size':9,stroke:'#192a39','stroke-width':2,'paint-order':'stroke'},t.id);
 }
 if(deer&&performance.now()<deer.until)el(svg,'text',{x:px(deer.km),y:55,'text-anchor':'middle','font-size':17},'🦌');else deer=null;
}
function tick(now){if(playing){if(last)seconds+=Math.min((now-last)/1000,1)*Number($('point-rate').value);last=now;
 if(seconds>=82800){seconds=82800;playing=false;$('point-play').textContent='▶ 再生'}
 if(deerEnabled&&seconds>=72000&&seconds>=nextDeer&&seconds<82800){if(Math.random()<.35)deer={km:3+Math.random()*50,until:now+2800};nextDeer=seconds+5400+Math.random()*5400}
 $('point-seek').value=seconds;draw();}
 frame=requestAnimationFrame(tick)}
function show(on){split=on;$('point-pane').hidden=!on;document.body.classList.toggle('point-split',on);$('point-mode').setAttribute('aria-pressed',String(on));$('point-mode').querySelector('.side-label').textContent=on?'全画面':'点P';if(on)draw();requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')))}
window.ChizuPoint={setData(next){data=next;draw()},stop(){playing=false;last=0;$('point-play').textContent='▶ 再生'},hide(){show(false)}};
$('point-mode').onclick=()=>show(!split);
$('point-play').onclick=()=>{if(seconds>=82800)seconds=18000;playing=!playing;last=0;$('point-play').textContent=playing?'⏸ 停止':'▶ 再生';draw()};
$('point-seek').oninput=e=>{seconds=Number(e.target.value);deer=null;draw()};
$('point-deer').onclick=()=>{deerEnabled=!deerEnabled;deer=null;$('point-deer').textContent=deerEnabled?'🦌 ON':'🦌 OFF';draw()};
nextDeer=72000+Math.random()*3600;frame=requestAnimationFrame(tick);
})();
