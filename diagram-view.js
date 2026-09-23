/* A mountable diagram viewer: no document IDs, storage or navigation. */
(() => {
'use strict';
const {COLORS,SERVICE,validate,clock,ink,planLabels,poseLabel}=window.ChizuDiagram;
let nextId=0;
function createViewer({svg,data:initialData,onSelect=()=>{},onViewChange=()=>{},width=0,height=0,printMode=false,labelOverrides=window.CHIZU_DIAGRAM_CONFIG?.labelOverrides||{}}){
 let data=validate(initialData),stationMap=new Map(data.stations.map(s=>[s.id,s]));
 let labelPlans=planLabels(data,{printMode,overrides:labelOverrides[printMode?'print':'screen']});
 let selected='',start=18000,span=64800,filters={up:true,down:true};
 const clipId='chizu-plot-'+(++nextId),fixedWidth=width,fixedHeight=height;
 let geometry={},lastRender={},pickLines=[],pickLabels=[],frame=0,destroyed=false;
 const NS='http://www.w3.org/2000/svg';
 function el(tag,attrs={},text,parent=svg){const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;if(parent)parent.appendChild(e);return e}
 function schedule(){if(!frame&&!destroyed)frame=requestAnimationFrame(()=>{frame=0;draw()})}
 function bounds(){return {min:0,max:Math.max(86400,data.view.endSeconds),minSpan:printMode?60:21600}}
 function setRange(nextStart,nextSpan=span){const b=bounds();span=Math.min(b.max-b.min,Math.max(b.minSpan,nextSpan));start=Math.max(b.min,Math.min(b.max-span,nextStart));schedule();}
 function setData(next){data=validate(next);stationMap=new Map(data.stations.map(s=>[s.id,s]));labelPlans=planLabels(data,{printMode,overrides:labelOverrides[printMode?'print':'screen']});selected='';filters={up:true,down:true};start=18000;span=64800;schedule()}
 function zoom(factor,fraction=.5){const b=bounds(),next=Math.max(b.minSpan,Math.min(b.max-b.min,span/factor)),anchor=start+span*fraction;setRange(anchor-next*fraction,next)}
 function fit(){setRange(18000,64800)}
 function select(id){const t=data.trains.find(t=>t.id===id);selected=t?id:'';if(t){filters[t.direction]=true;if(t.points.at(-1).seconds<start||t.points[0].seconds>start+span)setRange(t.points[0].seconds-span*.1)}schedule()}
 function point(clientX,clientY){const m=svg.getScreenCTM();if(!m)return {x:0,y:0};const p=new DOMPoint(clientX,clientY).matrixTransform(m.inverse());return {x:p.x,y:p.y}}
 function fraction(px){return Math.max(0,Math.min(1,(px-geometry.left)/geometry.pw))}
 function pick(p){
  if(p.x<geometry.left||p.x>geometry.w-geometry.right||p.y<geometry.top||p.y>geometry.h-geometry.bottom)return '';
  for(const label of pickLabels){const b=label.box,dx=p.x-b.x,dy=p.y-b.y;if(Math.abs(dx*b.ux+dy*b.uy)<=b.width/2+3&&Math.abs(-dx*b.uy+dy*b.ux)<=b.height/2+3)return label.id;}
  let id='',best=10;
  for(const line of pickLines)for(let i=1;i<line.coords.length;i++){const [ax,ay]=line.coords[i-1],[bx,by]=line.coords[i],dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy,f=len?Math.max(0,Math.min(1,((p.x-ax)*dx+(p.y-ay)*dy)/len)):0;const distance=Math.hypot(p.x-ax-f*dx,p.y-ay-f*dy);if(distance<best){best=distance;id=line.id}}
  return id;
 }
function draw(){
 const w=fixedWidth||svg.clientWidth,h=fixedHeight||svg.clientHeight;if(w<100||h<100)return;const left=w<500?66:76,right=18,top=28,bottom=16,pw=w-left-right,ph=h-top-bottom;geometry={w,h,left,right,top,bottom,pw,ph};
 svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
 const end=Math.min(start+span,bounds().max),distances=data.stations.map(s=>s.km),lo=Math.min(...distances),hi=Math.max(...distances);
 const x=s=>left+(s-start)/(end-start)*pw,y=k=>top+(k-lo)/(hi-lo)*ph;
 el('title',{},`${data.title} ${clock(start)}–${clock(end)}。上郡側を上、智頭側を下に表示。`);
 const defs=el('defs');const cp=el('clipPath',{id:clipId},undefined,defs);el('rect',{x:left,y:top-2,width:pw,height:ph+4},undefined,cp);
 const gridMinutes=printMode?10:(120*pw/span>=8?2:10),step=gridMinutes*60;
 const labelStep=[600,1800,3600,7200,10800,21600].find(s=>s*pw/span>=48)||21600;
 for(let s=Math.ceil(start/step)*step;s<=end+0.0001;s+=step){const hourly=s%3600===0,ten=s%600===0;el('line',{x1:x(s),y1:top,x2:x(s),y2:h-bottom,class:hourly?'hour-line':ten?(gridMinutes===2?'detail-ten-line':'ten-line'):'two-line','data-grid-seconds':s});}
 for(let s=Math.ceil(start/labelStep)*labelStep;s<=end;s+=labelStep)el('text',{x:x(s),y:17,'text-anchor':'middle',class:'axis-label'},clock(s));
 // Keep true distance coordinates. Small station-name collisions are offset only in the label margin.
 let lastLabel=-100;
 for(const s of [...data.stations].sort((a,b)=>a.km-b.km)){
  const sy=y(s.km);el('line',{x1:left,y1:sy,x2:w-right,y2:sy,class:'station-line'});
  const ly=Math.max(sy,lastLabel+12);lastLabel=ly;
  if(ly!==sy)el('line',{x1:left-5,y1:sy,x2:left-15,y2:ly,stroke:'#9caea8','stroke-width':.6});
  el('text',{x:left-8,y:ly+3,'text-anchor':'end',class:'station-label'},s.name);
 }

 const visible=data.trains.filter(t=>filters[t.direction]&&t.points[0].seconds<=end&&t.points.at(-1).seconds>=start);
 pickLines=[];pickLabels=[];
 const lines=el('g',{'clip-path':`url(#${clipId})`});
 for(const t of visible){
  const coords=t.points.map(p=>[x(p.seconds),y(stationMap.get(p.station).km)]),points=coords.map(p=>p.join(',')).join(' '),isSelected=t.id===selected;
  pickLines.push({id:t.id,coords});
  const group=el('g',{'data-train':t.id,opacity:selected&&!isSelected?.19:1},undefined,lines);
  const path=el('polyline',{points,fill:'none',stroke:ink(t),'stroke-width':isSelected?3.3:['hakuto','inaba'].includes(t.service)?2.15:1.25,'stroke-linejoin':'round','stroke-linecap':'round',class:'train-line'},undefined,group);
  el('title',{},`${t.id} ${SERVICE[t.service]} ${clock(t.points[0].seconds)}–${clock(t.points.at(-1).seconds)}`,path);
  const hit=el('polyline',{points,class:'hit-line',tabindex:0,role:'button','aria-label':t.id+' の時刻を表示'},undefined,group);
  hit.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(t.id)}});
 }
 // All labels retain their full-day anchor, including those outside the viewport.
 // Clipping hides them; neither panning nor filtering can pick another segment.
 const labelGroup=el('g',{'clip-path':`url(#${clipId})`,'data-fixed-labels':''});
 let labelCount=0;
 for(const t of data.trains.filter(t=>filters[t.direction])){
  const basePlan=labelPlans.get(t.id),scale=printMode?1:Math.max(.9,Math.min(1.05,pw/900)),plan={...basePlan,fontSize:basePlan.fontSize*scale,offset:basePlan.offset*scale,width:basePlan.width*scale},coords=t.points.map(p=>[x(p.seconds),y(stationMap.get(p.station).km)]),box=poseLabel(plan,coords);
  const a=t.points[plan.segment],b=t.points[plan.segment+1];
  el('text',{x:0,y:0,transform:`translate(${box.x} ${box.y}) rotate(${box.angle})`,
   'text-anchor':'middle','dominant-baseline':'central',style:`font-size:${plan.fontSize}px`,class:'train-label','data-label':t.id,
   'data-anchor-seconds':a.seconds+(b.seconds-a.seconds)*plan.fraction,
   'data-anchor-km':stationMap.get(a.station).km+(stationMap.get(b.station).km-stationMap.get(a.station).km)*plan.fraction,
   'data-segment':plan.segment,'data-fraction':plan.fraction,
   opacity:selected&&selected!==t.id?.2:1},t.id,labelGroup);
  pickLabels.push({id:t.id,box});labelCount++;
 }
 lastRender={trainCount:data.trains.length,visibleCount:visible.length,labelCount,start,end,span,gridMinutes,colors:COLORS,selected};
 onViewChange({...lastRender});
}
 const observer=new ResizeObserver(schedule);observer.observe(svg);schedule();
 return {setData,setRange,fit,zoom,select,point,fraction,pick,draw,schedule,
  setFilters(next){filters={...filters,...next};schedule()},
  getState(){return {start,span,end:start+span,selected,filters:{...filters},...bounds(),geometry:{...geometry}}},
  getDiagnostics(){return {...lastRender}},
  destroy(){destroyed=true;cancelAnimationFrame(frame);observer.disconnect();svg.replaceChildren()}
 };
}
window.ChizuDiagram.createViewer=createViewer;
})();
